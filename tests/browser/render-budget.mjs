// Synthetic scene states exercise the real app render loop. No camera permission
// or personal images are needed; this is not a real-phone performance benchmark.
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {spawn} from 'node:child_process';
import {fileURLToPath} from 'node:url';
const {chromium}=createRequire(import.meta.url)(process.env.PLAYWRIGHT_MODULE||'playwright');
const root=fileURLToPath(new URL('../../',import.meta.url));
const base=process.env.DEMO_URL||'http://127.0.0.1:4191';
const server=process.env.DEMO_URL?null:spawn(process.execPath,['server.mjs'],{cwd:root,env:{...process.env,PORT:'4191'},windowsHide:true,stdio:'ignore'});
let browser;
try {
 if(server)for(let i=0;i<50;i++){try{if((await fetch(base+'/health')).ok)break;}catch{}await new Promise(r=>setTimeout(r,100));}
 browser=await chromium.launch({headless:true,...(process.env.BROWSER_PATH?{executablePath:process.env.BROWSER_PATH}:{})});
 const page=await browser.newPage({viewport:{width:1280,height:1000}}),errors=[];
 page.on('pageerror',e=>errors.push(e.message));
 await page.goto(base,{waitUntil:'domcontentloaded'});
 await page.waitForFunction(()=>gardenDiagnostics().assetLoaded&&gardenDiagnostics().crayonRainReady&&gardenDiagnostics().crayonStarsReady);
 await page.evaluate(async()=>{
  const {GardenScene}=await import('/effects.js'),{Fireworks}=await import('/fireworks.js'),{PalmRain}=await import('/palm-rain.js');
  window.renderRefs={};
  window.advanceGarden=GardenScene.prototype.update;
  for(const [name,Type] of [['garden',GardenScene],['fireworks',Fireworks],['palm',PalmRain]])Type.prototype.update=function(){renderRefs[name]=this;};
  window.hasPixels=id=>{const c=document.getElementById(id),data=c.getContext('2d').getImageData(0,0,c.width,c.height).data;for(let i=3;i<data.length;i+=4)if(data[i])return true;return false;};
 });
 await page.waitForFunction(()=>renderRefs.garden&&renderRefs.fireworks&&renderRefs.palm);
 for(const phone of [true,false]){
  await page.locator(phone?'#phonePreview':'#desktopPreview').check();
  await page.evaluate(()=>{
   const s=renderRefs.garden;for(let i=0;i<240;i++)advanceGarden.call(s,1/60,true,0,.6,true,1/60,false);
  });
  await page.waitForFunction(()=>hasPixels('scene')&&hasPixels('plants'));
  assert.ok(await page.evaluate(()=>renderRefs.garden.plants.length>0));
  assert.ok(await page.evaluate(()=>renderRefs.garden.grass.height/renderRefs.garden.grassSourceHeight<.17));
  await page.evaluate(()=>renderRefs.garden.clear());
  await page.waitForFunction(()=>!hasPixels('scene')&&!hasPixels('plants'));
  // A fading water wash has no airborne particles but must remain visible.
  await page.evaluate(()=>renderRefs.fireworks.waterGround.opacity=.25);
  await page.waitForFunction(()=>hasPixels('fireworks'));
  await page.evaluate(()=>renderRefs.fireworks.waterGround.clear());
  await page.waitForFunction(()=>!hasPixels('fireworks'));
  // Smoke can outlive its firework. Do not use just the particle count to sleep.
  await page.evaluate(()=>{const f=renderRefs.fireworks;f.atmosphere.add(f.w*.5,f.h*.2,50,0,f.w,f.h);f.atmosphere.events[0].age=1.6;});
  await page.waitForFunction(()=>hasPixels('fireworks'));
  await page.evaluate(()=>renderRefs.fireworks.atmosphere.clear());
  await page.waitForFunction(()=>!hasPixels('fireworks'));
  // Rain-catch stars share the fireworks canvas while fireworks themselves idle.
  await page.evaluate(()=>{const f=renderRefs.fireworks;renderRefs.palm.particles=[{age:.5,life:2.4,x:f.w/2,y:f.h*.7,positioned:true,size:18,variant:0,tilt:.2}];});
  await page.waitForFunction(()=>hasPixels('fireworks'));
  await page.evaluate(()=>renderRefs.palm.clear());
  await page.waitForFunction(()=>!hasPixels('fireworks'));
  const draws=await page.evaluate(async()=>{
   let calls=0;const proto=CanvasRenderingContext2D.prototype,original={};
   for(const key of ['drawImage','clearRect']){original[key]=proto[key];proto[key]=function(...args){if(['scene','plants','fireworks'].includes(this.canvas.id))calls++;return original[key].apply(this,args);};}
   await new Promise(r=>setTimeout(r,250));
   for(const key of Object.keys(original))proto[key]=original[key];return calls;
  });
  assert.equal(draws,0,'settled empty layers do no canvas work');
  console.log(`PASS ${phone?'portrait':'landscape'}: rain wake/clear, water/smoke tail, palm-only stars, zero idle painting.`);
 }
 assert.deepEqual(errors,[]);
}finally{await browser?.close();server?.kill();}
