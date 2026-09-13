// Portable browser checks. No personal photos are shipped. FACE_FIXTURE optionally
// supplies a local licensed face photo for real MediaPipe inference (not a live person).
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createRequire} from 'node:module';
import {fileURLToPath} from 'node:url';
import {spawn} from 'node:child_process';
import path from 'node:path';
const require=createRequire(import.meta.url);
const {chromium}=require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const root=fileURLToPath(new URL('../../',import.meta.url));
const output=path.join(root,'test-results');fs.mkdirSync(output,{recursive:true});
let server;
const base=process.env.DEMO_URL || 'http://127.0.0.1:4187';
if(!process.env.DEMO_URL){
 server=spawn(process.execPath,['server.mjs'],{cwd:root,env:{...process.env,PORT:'4187'},windowsHide:true,stdio:'ignore'});
 for(let i=0;i<50;i++){try{if((await fetch(base+'/health')).ok)break;}catch{}await new Promise(r=>setTimeout(r,100));}
}
let browser;
const results=[];
try {
 browser=await chromium.launch({headless:true,...(process.env.BROWSER_PATH?{executablePath:process.env.BROWSER_PATH}:{})});
 for(const [width,height] of (process.env.TRACKING_ONLY ? [] : [[1366,768],[1280,600],[390,844]])){
  const page=await browser.newPage({viewport:{width,height}}),errors=[];
  page.on('pageerror',e=>errors.push(e.message));await page.goto(base);
  await page.waitForFunction(()=>gardenDiagnostics().assetLoaded);
  assert.equal(await page.locator('#phonePreview').isChecked(),true);
  if(width>760){const bounds=await page.locator('.controls').boundingBox();assert.ok(bounds.y+bounds.height<=height);}
  await page.locator('#smileThreshold').fill('16');await page.locator('#laughThreshold').fill('65');
  await page.reload();await page.waitForFunction(()=>gardenDiagnostics().smileThreshold===.16&&gardenDiagnostics().laughThreshold===.65);
  await page.locator('#desktopPreview').check();await page.waitForFunction(()=>Math.abs(gardenDiagnostics().stageWidth/gardenDiagnostics().stageHeight-16/9)<.001);
  await page.locator('#phonePreview').check();
  assert.equal(await page.locator('#demoHero').count(),0);
  assert.equal(await page.evaluate(()=>gardenDiagnostics().drops),0);
  await page.evaluate(async()=>{
   const {GardenScene}=await import('/effects.js');const original=GardenScene.prototype.update;
   GardenScene.prototype.update=function(...args){window.testScene=this;return original.apply(this,args);};
  });
  await page.waitForFunction(()=>window.testScene);
  await page.evaluate(()=>{
   const s=window.testScene;s.clear();s.grassLevel=1;
   for(let i=0;i<100;i++)s.waterSeed(.7,.99);
   for(const p of s.plants){p.age=4;p.watered=s.time;}
   const first=s.visiblePlants();if(first!==s.visiblePlants())throw Error('layout cache missed');
  });
  await page.screenshot({path:path.join(output,`garden-${width}.png`),fullPage:true});
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
  await page.click('#clean');await page.waitForFunction(()=>document.querySelector('#stage').classList.contains('clean'));
  await page.keyboard.press('Escape');await page.waitForFunction(()=>!document.querySelector('#stage').classList.contains('clean'));
  assert.deepEqual(errors,[]);results.push({viewport:[width,height],layoutAndSettings:'passed',errors});await page.close();
 }
 for(const fallback of [false,true]){
  const page=await browser.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
  const face=process.env.FACE_FIXTURE?fs.readFileSync(process.env.FACE_FIXTURE).toString('base64'):null;
  await page.addInitScript(({fallback,face})=>{
   if(fallback)window.Worker=undefined;
   const canvas=document.createElement('canvas');canvas.width=canvas.height=640;
   const c=canvas.getContext('2d'),img=new Image();if(face)img.src='data:image/jpeg;base64,'+face;
   window.showFace=true;window.rejectCamera=true;
   setInterval(()=>{c.fillStyle='#29463f';c.fillRect(0,0,640,640);if(face&&window.showFace&&img.complete&&img.naturalWidth)c.drawImage(img,0,0,640,640);},40);
   navigator.mediaDevices.getUserMedia=async()=>{
    if(window.rejectCamera)throw new DOMException('Test permission denial','NotAllowedError');
    return canvas.captureStream(25);
   };
  },{fallback,face});
  // Loading starts alongside camera permission, including a denied request.
  let release;const modelGate=new Promise(r=>release=r);
  await page.route('**/face_landmarker.task',async route=>{await modelGate;await route.continue();});
  await page.goto(base+'/?debug=1');await page.click('#start');
  await page.waitForFunction(()=>document.querySelector('#message').textContent.includes('权限被拒绝'));
  await page.evaluate(()=>window.rejectCamera=false);
  // Hold model requests to test the otherwise brief loading state.
  await page.click('#start');await page.waitForFunction(()=>gardenDiagnostics().camera&&!gardenDiagnostics().tracker);release();
  await page.waitForFunction(()=>gardenDiagnostics().tracker&&gardenDiagnostics().handReady,null,{timeout:60000});
  if(face)await page.waitForFunction(()=>gardenDiagnostics().face,null,{timeout:20000});
  // Wait for a full diagnostic window, not just the first inference result.
  await page.waitForTimeout(2200);
  const diagnostics=await page.evaluate(()=>gardenDiagnostics());
  assert.equal(diagnostics.trackerMode,fallback?'main':'worker');
  if(face)assert.ok(diagnostics.faceHz>0);
  await page.evaluate(()=>window.showFace=false);await page.waitForFunction(()=>!gardenDiagnostics().face,null,{timeout:2500});
  // A photo can contain a hand or cause a false positive. Check absent-hand
  // scheduling against a blank stream after the active-hand hold has expired.
  await page.waitForTimeout(2700);
  const idle=await page.evaluate(()=>gardenDiagnostics());
  assert.ok(idle.handHz<=9,JSON.stringify({reason:'blank-stream probe cadence',idle}));
  await page.emulateMedia({reducedMotion:'reduce'});await page.waitForFunction(()=>gardenDiagnostics().reducedMotion);
  await page.click('#start');assert.equal(await page.evaluate(()=>gardenDiagnostics().camera),false);
  await page.click('#start');await page.waitForFunction(()=>gardenDiagnostics().tracker&&gardenDiagnostics().camera);
  const resources=await page.evaluate(()=>gardenDiagnostics().modelResources);
  assert.deepEqual(errors,[]);results.push({fallback,fixture:!!face,diagnostics,idle,resources,permissionsRecovery:'passed',errors});await page.close();
 }
 const failed=await browser.newPage();
 await failed.addInitScript(()=>{window.Worker=undefined;const c=document.createElement('canvas');c.width=c.height=100;setInterval(()=>c.getContext('2d').fillRect(0,0,100,100),40);navigator.mediaDevices.getUserMedia=async()=>c.captureStream(25);});
 await failed.route('**/face_landmarker.task',r=>r.abort());await failed.goto(base);await failed.click('#start');
 await failed.waitForFunction(()=>document.querySelector('#cameraTag').textContent==='识别需重试',null,{timeout:30000});
 assert.equal(await failed.locator('#message').isVisible(),true);await failed.click('#start');
 assert.equal(await failed.locator('#cameraTag').textContent(),'未开启');await failed.close();
 results.push({modelFailureRecovery:'passed'});
 fs.writeFileSync(path.join(output,'browser-results.json'),JSON.stringify({date:new Date().toISOString(),note:'Synthetic camera streams; not real-device or live-person acceptance',results},null,2));
 console.log(JSON.stringify(results));
} finally {await browser?.close();server?.kill();}
