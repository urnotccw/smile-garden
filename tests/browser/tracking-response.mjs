// Controlled detector outputs exercise the real app event loop. This is a
// regression test for timing/state handling, not a model accuracy benchmark.
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {spawn} from 'node:child_process';
import {fileURLToPath} from 'node:url';
const require=createRequire(import.meta.url);
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const root=fileURLToPath(new URL('../../',import.meta.url));
const base=process.env.DEMO_URL||'http://127.0.0.1:4188';
const server=process.env.DEMO_URL?null:spawn(process.execPath,['server.mjs'],{cwd:root,env:{...process.env,PORT:'4188'},windowsHide:true,stdio:'ignore'});
let browser;
try {
 for(let i=0;i<50;i++){try{if((await fetch(base+'/health')).ok)break;}catch{}await new Promise(r=>setTimeout(r,100));}
 browser=await chromium.launch({headless:true,...(process.env.BROWSER_PATH?{executablePath:process.env.BROWSER_PATH}:{})});
 const page=await browser.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.addInitScript(()=>{
  window.input={face:true,score:0,age:0,missing:0,frames:0,workers:0};
  const canvas=document.createElement('canvas');canvas.width=640;canvas.height=480;
  setInterval(()=>canvas.getContext('2d').fillRect(0,0,640,480),40);
  navigator.mediaDevices.getUserMedia=async()=>canvas.captureStream(25);
  window.Worker=class {
   constructor(){input.workers++;}
   postMessage(d){
    if(d.type==='init'){setTimeout(()=>this.onmessage({data:{type:'ready',handReady:false}}),0);return;}
    if(d.type!=='frame')return;
    d.bitmap.close();
    setTimeout(()=>{
     if(d.wantFace){
      input.frames++;
      const face=input.face&&input.missing===0;if(input.missing>0)input.missing--;
      this.onmessage({data:{type:'face',time:d.time-input.age,epoch:d.epoch,inferenceMs:input.age,
       eyes:face?[{x:.4,y:.4},{x:.6,y:.4}]:null,head:null,
       categories:['mouthSmileLeft','mouthSmileRight'].map(categoryName=>({categoryName,score:input.score}))}});
     }
     this.onmessage({data:{type:'result',epoch:d.epoch,faceUpdated:false}});
    },0);
   }
   terminate(){}
  };
 });
 await page.goto(base);await page.click('#start');
 await page.waitForFunction(()=>gardenDiagnostics().face);
 await page.evaluate(()=>input.score=.6);
 await page.waitForFunction(()=>gardenDiagnostics().triggered&&gardenDiagnostics().drops>=2,null,{timeout:1500});
 await page.evaluate(()=>input.missing=1);
 await page.waitForFunction(()=>gardenDiagnostics().faceRecovering);
 assert.equal(await page.evaluate(()=>gardenDiagnostics().triggered),true);
 await page.waitForFunction(()=>!gardenDiagnostics().faceRecovering);
 await page.evaluate(()=>input.face=false);
 await page.waitForFunction(()=>!gardenDiagnostics().face,null,{timeout:1500});
 assert.equal(await page.evaluate(()=>gardenDiagnostics().triggered),false);
 // 500ms-old expressions used to reset the entire interaction every result.
 await page.evaluate(()=>{input.face=true;input.age=500;});
 await page.waitForFunction(()=>gardenDiagnostics().triggered,null,{timeout:1800});
 await page.evaluate(()=>input.age=900);
 await page.waitForFunction(()=>gardenDiagnostics().trackingDelayed);
 await page.waitForFunction(()=>!gardenDiagnostics().triggered,null,{timeout:1800});
 assert.match(await page.locator('#cameraTag').textContent(),/识别稍慢/);
 await page.evaluate(()=>input.age=0);
 await page.waitForFunction(()=>gardenDiagnostics().triggered&&!gardenDiagnostics().trackingDelayed,null,{timeout:1500});
 assert.equal(await page.evaluate(()=>input.workers),1,'no detector reinitialization after lag');
 assert.deepEqual(errors,[]);
 console.log('PASS: actual app handles brief dropout, sustained loss, delayed results, timeout and recovery; no worker restart. Synthetic outputs only.');
} finally {await browser?.close();server?.kill();}
