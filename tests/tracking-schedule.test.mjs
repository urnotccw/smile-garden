import test from 'node:test';
import assert from 'node:assert/strict';
import {TrackingSchedule,cameraStatus,faceResultFreshness} from '../tracking-schedule.js';
import {RuntimeMetrics} from '../runtime.js';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';

test('absent hands are probed without delaying face work; active hands get fast cadence',()=>{
 const s=new TrackingSchedule();
 assert.deepEqual(s.plan(0,true),{wantFace:true,wantHand:true});
 assert.deepEqual(s.plan(120,true),{wantFace:true,wantHand:false});
 assert.equal(s.plan(160,true).wantHand,true);
 s.observeHand(true,170);assert.equal(s.plan(200,true).wantHand,true);
 assert.equal(s.plan(240,true,true).wantFace,true);
 assert.equal(s.plan(280,true).wantHand,true);
 assert.equal(s.plan(650,true).wantHand,true);
 assert.equal(s.plan(700,true).wantHand,false);
 s.reset();assert.deepEqual(s.plan(0,false),{wantFace:true,wantHand:false});
});
test('camera state separates permissions, model loading, missing face and recovery',()=>{
 assert.equal(cameraStatus({busy:true}),'等待摄像头授权');
 assert.equal(cameraStatus({stream:true}),'正在准备识别…');
 assert.equal(cameraStatus({stream:true,trackingReady:true}),'请让面部入镜');
 assert.equal(cameraStatus({stream:true,trackingReady:true,face:true,handLoading:true}),'表情就绪 · 手势准备中');
 assert.equal(cameraStatus({stream:true,trackingError:true}),'识别需重试');
 assert.equal(cameraStatus({stream:true,trackingReady:true,trackingDelayed:true}),'识别稍慢 · 正在恢复');
 assert.equal(cameraStatus({stream:true,trackingReady:true,faceRecovering:true}),'正在重新跟踪面部…');
});
test('moderately slow expression results remain usable but stale head positions do not',()=>{
 assert.deepEqual(faceResultFreshness(0,200),{age:200,expression:true,position:true});
 assert.deepEqual(faceResultFreshness(0,500),{age:500,expression:true,position:false});
 assert.equal(faceResultFreshness(0,701).expression,false);
 assert.equal(faceResultFreshness(undefined,800).expression,false);
});
test('face and hand latency and inference costs are reported independently',()=>{
 const m=new RuntimeMetrics();m.record('face',100,30);m.record('hand',100,110);
 m.recordInference('face',20);m.recordInference('hand',70);
 const d=m.snapshot(100);assert.equal(d.faceP95Ms,30);assert.equal(d.handP95Ms,110);
 assert.equal(d.faceInferenceP95Ms,20);assert.equal(d.handInferenceP95Ms,70);
 m.beginCamera();m.markStartup('cameraReady');assert.ok(m.snapshot(100).startupMs.cameraReady>=0);
});
test('Worker publishes face before hand and releases frame only after both complete',async()=>{
 const events=[], calls=[];
 const context=vm.createContext({self:{postMessage:m=>events.push(m)},performance:{now:()=>10}});
 vm.runInContext(readFileSync(new URL('../tracker-worker.js',import.meta.url),'utf8')+`
 detector={detectForVideo(){calls.push('face');return {faceLandmarks:[],faceBlendshapes:[]};}};
 handDetector={detectForVideo(){calls.push('hand');return {landmarks:[]};}};
 canvas={width:640,height:480};ctx={drawImage(){}};
 `,vm.createContext({...context,calls}));
 await context.self.onmessage({data:{type:'frame',time:1,epoch:3,wantFace:true,wantHand:true,bitmap:{width:640,height:480,close(){}}}});
 assert.deepEqual(calls,['face','hand']);assert.deepEqual(events.map(e=>e.type),['face','hand','result']);
 assert.equal(events.at(-1).faceUpdated,false);
});

test('Worker defers hand initialization until after first face result with a one-second head start',async()=>{
 const events=[],timers=[];
 const context=vm.createContext({self:{postMessage:m=>events.push(m)},performance:{now:()=>10},setTimeout:(fn,ms)=>timers.push({fn,ms})});
 vm.runInContext(readFileSync(new URL('../tracker-worker.js',import.meta.url),'utf8')+`
 detector={detectForVideo:()=>({faceLandmarks:[],faceBlendshapes:[]})};
 canvas={width:640,height:480};ctx={drawImage(){}};beginHands=()=>{};
 `,context);
 for(let i=0;i<2;i++)await context.self.onmessage({data:{type:'frame',time:i+1,epoch:1,wantFace:true,wantHand:false,bitmap:{width:640,height:480,close(){}}}});
 assert.equal(timers.length,1);assert.equal(timers[0].ms,1000);assert.equal(events[0].type,'face');
});
