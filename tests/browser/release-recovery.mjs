import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createRequire} from 'node:module';
import {spawn} from 'node:child_process';
import {fileURLToPath} from 'node:url';
const {chromium}=createRequire(import.meta.url)(process.env.PLAYWRIGHT_MODULE||'playwright');
const root=fileURLToPath(new URL('../../',import.meta.url)),base=process.env.DEMO_URL||'http://127.0.0.1:4193';
const server=process.env.DEMO_URL?null:spawn(process.execPath,['server.mjs'],{cwd:root,env:{...process.env,PORT:'4193'},windowsHide:true,stdio:'ignore'});
let browser;
try{
 if(server)for(let i=0;i<50;i++){try{if((await fetch(base+'/health')).ok)break;}catch{}await new Promise(r=>setTimeout(r,100));}
 browser=await chromium.launch({headless:true,...(process.env.BROWSER_PATH?{executablePath:process.env.BROWSER_PATH}:{})});
 const page=await browser.newPage({viewport:{width:390,height:844}}),errors=[];
 page.on('pageerror',e=>errors.push(e.message));
 await page.addInitScript(()=>{
  const c=document.createElement('canvas');c.width=640;c.height=480;
  setInterval(()=>c.getContext('2d').fillRect(0,0,640,480),40);
  navigator.mediaDevices.getUserMedia=async()=>c.captureStream(25);
 });
 // A late error previously missed the one-off 4-second artwork check.
 const requests=new Map();let offline=true;
 await page.route('**/plants-crayon*.webp*',async route=>{
  const key=new URL(route.request().url()).pathname,n=(requests.get(key)||0)+1;requests.set(key,n);
  if(n===1)await new Promise(r=>setTimeout(r,5200));
  if(offline)await route.abort();else await route.continue();
 });
 await page.goto(base,{waitUntil:'domcontentloaded'});
 await page.waitForFunction(()=>gardenDiagnostics().artwork.failed===2,null,{timeout:15000});
 assert.ok(await page.locator('#previewRetry').isVisible());
 const bounds=await page.locator('#previewStatus').boundingBox();assert.ok(bounds.y>0&&bounds.y+bounds.height<844);
 if(process.env.CAPTURE_QA){fs.mkdirSync(new URL('../../test-results/',import.meta.url),{recursive:true});await page.screenshot({path:fileURLToPath(new URL('../../test-results/recovery-mobile.png',import.meta.url))});}
 assert.ok([...requests.values()].every(n=>n===3),'three requests per failed image');
 offline=false;await page.evaluate(()=>window.dispatchEvent(new Event('online')));
 await page.waitForFunction(()=>gardenDiagnostics().assetLoaded);
 assert.ok([...requests.values()].every(n=>n===4));
 // Failed hand initialization is not a successful hand-ready performance mark.
 await page.route('**/hand_landmarker.task',r=>r.abort());
 await page.click('#startHero');
 await page.waitForFunction(()=>gardenDiagnostics().faceHz>0&&gardenDiagnostics().startupMs.handFailed!==undefined,null,{timeout:20000});
 const d=await page.evaluate(()=>gardenDiagnostics());assert.equal(d.handReady,false);assert.equal(d.startupMs.handReady,undefined);
 // Browser video pauses recover in place, without reloading face models.
 await page.evaluate(()=>{document.getElementById('camera').pause();document.dispatchEvent(new Event('visibilitychange'));});
 await page.waitForFunction(()=>!document.getElementById('camera').paused&&gardenDiagnostics().faceHz>0&&!gardenDiagnostics().videoStalled);
 // When playback is denied, keep a visible manual recovery action, not a face hint.
 await page.evaluate(()=>{const v=document.getElementById('camera');v.pause();v.play=()=>Promise.reject(new DOMException('controlled block','NotAllowedError'));});
 await page.waitForFunction(()=>gardenDiagnostics().videoStalled&&document.getElementById('previewRetry').dataset.action==='video'&&!document.getElementById('previewRetry').disabled);
 assert.match(await page.locator('#cameraTag').textContent(),/画面暂停/);
 if(process.env.CAPTURE_QA)await page.screenshot({path:fileURLToPath(new URL('../../test-results/recovery-paused.png',import.meta.url))});
 await page.evaluate(()=>delete document.getElementById('camera').play);
 await page.locator('#previewRetry').click();
 await page.waitForFunction(()=>gardenDiagnostics().faceHz>0&&!gardenDiagnostics().videoStalled);
 await page.locator('#start').click();
 await page.evaluate(()=>document.dispatchEvent(new Event('visibilitychange')));
 assert.equal(await page.evaluate(()=>gardenDiagnostics().camera),false,'visibility never reopens a user-stopped camera');
 assert.deepEqual(errors,[]);
 console.log('PASS late artwork failure, bounded retries, online recovery, first-screen status, hand-failure metrics, video pause/retry and intentional stop. Synthetic camera only.');
}finally{await browser?.close();server?.kill();}
