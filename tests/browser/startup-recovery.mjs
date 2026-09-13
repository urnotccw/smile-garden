// Real bundled models with controlled network/browser failures; synthetic video.
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {spawn} from 'node:child_process';
import {fileURLToPath} from 'node:url';
const {chromium}=createRequire(import.meta.url)(process.env.PLAYWRIGHT_MODULE||'playwright');
const root=fileURLToPath(new URL('../../',import.meta.url));
const base=process.env.DEMO_URL||'http://127.0.0.1:4189';
const server=process.env.DEMO_URL?null:spawn(process.execPath,['server.mjs'],{cwd:root,env:{...process.env,PORT:'4189'},windowsHide:true,stdio:'ignore'});
let browser;
try {
 if(server)for(let i=0;i<50;i++){try{if((await fetch(base+'/health')).ok)break;}catch{}await new Promise(r=>setTimeout(r,100));}
 browser=await chromium.launch({headless:true,...(process.env.BROWSER_PATH?{executablePath:process.env.BROWSER_PATH}:{})});
 for(const mode of ['stalled-download','worker-webgl-unavailable']) {
  const page=await browser.newPage(),errors=[];let pending;
  page.on('pageerror',e=>errors.push(e.message));
  await page.addInitScript(()=>{
   const c=document.createElement('canvas');c.width=640;c.height=480;
   setInterval(()=>c.getContext('2d').fillRect(0,0,640,480),40);
   navigator.mediaDevices.getUserMedia=async()=>c.captureStream(25);
   // Enumerating devices may never resolve in an embedded browser. Face
   // initialization and inference must still proceed without it.
   navigator.mediaDevices.enumerateDevices=()=>new Promise(()=>{});
  });
  if(mode==='stalled-download')await page.route('**/face_landmarker.task',r=>{pending=r;});
  else await page.route('**/tracker-worker.js',async r=>{
   const response=await r.fetch();
   await r.fulfill({response,body:'self.OffscreenCanvas=class{getContext(){return null;}};\n'+await response.text()});
  });
  await page.goto(base,{waitUntil:'domcontentloaded'});await page.click('#start');
  if(mode==='stalled-download'){
   await page.waitForFunction(()=>gardenDiagnostics().startupProgress?.loaded>0);
   assert.match(await page.locator('#cameraTag').textContent(),/下载识别资源/);
   await page.waitForFunction(()=>gardenDiagnostics().cameraStatus==='识别需重试',null,{timeout:18000});
   assert.match(await page.locator('#message').textContent(),/超时/);
   await page.unroute('**/face_landmarker.task');await pending?.abort().catch(()=>{});
   await page.click('#start');await page.click('#start');
  }
  await page.waitForFunction(()=>gardenDiagnostics().faceHz>0&&gardenDiagnostics().handReady,null,{timeout:20000});
  const d=await page.evaluate(()=>gardenDiagnostics());
  assert.equal(d.trackerMode,mode==='stalled-download'?'worker':'main');
  assert.deepEqual(errors,[]);console.log(`PASS ${mode}: models initialize and infer despite unresolved device enumeration.`);
  await page.close();
 }
}finally{await browser?.close();server?.kill();}
