// Run this same probe against both revisions' local servers for an A/B check.
// Counts are canvas commands / retained pixels, not GPU time or battery usage.
import fs from 'node:fs';
import {createRequire} from 'node:module';
import {spawn} from 'node:child_process';
import {fileURLToPath} from 'node:url';
const {chromium}=createRequire(import.meta.url)(process.env.PLAYWRIGHT_MODULE||'playwright');
const root=fileURLToPath(new URL('../../',import.meta.url));
const base=process.env.DEMO_URL||'http://127.0.0.1:4192';
const server=process.env.DEMO_URL?null:spawn(process.execPath,['server.mjs'],{cwd:root,env:{...process.env,PORT:'4192'},windowsHide:true,stdio:'ignore'});
let browser;
try {
 if(server)for(let i=0;i<50;i++){try{if((await fetch(base+'/health')).ok)break;}catch{}await new Promise(r=>setTimeout(r,100));}
 browser=await chromium.launch({headless:true,...(process.env.BROWSER_PATH?{executablePath:process.env.BROWSER_PATH}:{})});
 const page=await browser.newPage({viewport:{width:1280,height:1000},deviceScaleFactor:1});
 await page.goto(base,{waitUntil:'domcontentloaded'});
 await page.waitForFunction(()=>gardenDiagnostics().assetLoaded&&gardenDiagnostics().crayonRainReady);
 const idle=await page.evaluate(async()=>{
  const counts={clearRect:0,drawImage:0},proto=CanvasRenderingContext2D.prototype,original={};
  for(const key of Object.keys(counts)){original[key]=proto[key];proto[key]=function(...args){if(['scene','plants','fireworks'].includes(this.canvas.id))counts[key]++;return original[key].apply(this,args);};}
  await new Promise(r=>setTimeout(r,1500));
  for(const key of Object.keys(counts))proto[key]=original[key];return counts;
 });
 const textures=await page.evaluate(async()=>{
  const {GardenScene}=await import('/effects.js'),{LiveComposition}=await import('/live-composition.js');
  const result=[];
  for(const [w,h] of [[393,852],[1200,675]]){
   const c=document.createElement('canvas');c.style.width=w+'px';c.style.height=h+'px';document.body.append(c);
   const s=new GardenScene(c);s.observer.disconnect();
   const m=new LiveComposition();m.apply(c.getContext('2d'),w,h,true);
   result.push({w,h,grassPixels:s.grass.width*s.grass.height,maskPixels:m.mask.width*m.mask.height});c.remove();
  }return result;
 });
 const report={browser:browser.version(),note:'Desktop Chromium, no camera; not real-device FPS, memory or power measurements',idleWindowMs:1500,idle,textures};
 fs.mkdirSync(new URL('../../test-results/',import.meta.url),{recursive:true});
 fs.writeFileSync(new URL('../../test-results/render-cost.json',import.meta.url),JSON.stringify(report,null,2));
 console.log(JSON.stringify(report));
}finally{await browser?.close();server?.kill();}
