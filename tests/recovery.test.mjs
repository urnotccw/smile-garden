import test from 'node:test';
import assert from 'node:assert/strict';
import {Artwork} from '../artwork.js';
import {VideoHealth} from '../video-health.js';
import {cameraStatus} from '../tracking-schedule.js';

test('artwork retries are bounded, share readiness and recover only failed images',async()=>{
 let failing=true,requests=0;
 const loader=new Artwork({timeout:200,delays:[1,1],makeImage:()=>({
  set src(value){requests++;queueMicrotask(()=>value.includes('good')||!failing?this.onload?.():this.onerror?.());},
 })});
 const good=loader.get('good.webp'),bad=loader.get('bad.webp');
 assert.equal(loader.get('bad.webp'),bad);
 await good.ready;
 while(loader.status().failed===0)await new Promise(r=>setTimeout(r,5));
 assert.equal(requests,4);assert.equal(loader.status().failed,1);
 await new Promise(r=>setTimeout(r,20));assert.equal(requests,4,'no infinite retry loop');
 failing=false;loader.retry();await bad.ready;
 assert.equal(requests,5,'successful artwork was not reloaded');assert.equal(loader.status().failed,0);
});

test('a stuck image times out and a late callback cannot overturn a failed attempt',async()=>{
 let saved;
 const loader=new Artwork({timeout:5,delays:[],makeImage:()=>({set src(_){saved=this.onload;}})});
 const asset=loader.get('stuck.webp');await new Promise(r=>setTimeout(r,15));
 assert.equal(asset.state,'failed');saved();assert.equal(asset.state,'failed');
});

test('paused, muted and nonadvancing video are distinct from a missing face',()=>{
 const health=new VideoHealth(),video={paused:false,currentTime:1,readyState:4};
 assert.equal(health.stalled(video,0),false);
 assert.equal(health.stalled(video,1500),true);
 video.currentTime=2;assert.equal(health.stalled(video,1510),false);
 video.paused=true;assert.equal(health.stalled(video,1520),true);
 video.paused=false;assert.equal(health.stalled(video,1530,true),true);
 const state={stream:{},trackingReady:true,firstInference:true,face:false,videoStalled:true};
 assert.equal(cameraStatus(state),'画面暂停 · 请恢复摄像头');
 state.videoStalled=false;assert.equal(cameraStatus(state),'请让面部入镜');
 health.reset(3000);assert.equal(health.stalled(video,3000),false);
});
