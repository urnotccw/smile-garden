import test from 'node:test';
import assert from 'node:assert/strict';
import {sampleSize,RuntimeMetrics} from '../runtime.js';
import {fitPattern,patternPoints} from '../fireworks.js';

test('portrait and landscape frames share the same bounded inference pixel budget',()=>{
  assert.deepEqual(sampleSize(1280,720),{width:640,height:360});
  assert.deepEqual(sampleSize(720,1280),{width:360,height:640});
  assert.deepEqual(sampleSize(320,240),{width:320,height:240});
});
test('metrics distinguish drawing from inference and discard stale rates',()=>{
  const m=new RuntimeMetrics();for(let t=0;t<=1000;t+=20)m.record('render',t);
  for(let t=0;t<=1000;t+=125)m.record('face',t,80);
  const s=m.snapshot(1000);assert.equal(s.renderFps,50);assert.equal(s.faceHz,8);assert.equal(s.handHz,0);assert.equal(s.trackingP95Ms,80);
  assert.equal(m.snapshot(4000).faceHz,0);m.reset();assert.equal(m.snapshot(4000).trackingP95Ms,0);
});
test('every tilted motif fits entirely above the crown at all size bands',()=>{
 for(const [w,h,crown] of [[390,700,180],[1280,720,290],[390,700,50]])for(let k=0;k<4;k++)for(const angle of [-.55,0,.55])for(const scale of [.13,.17,.245]){
  const points=patternPoints(k),target={x:w*.5,y:crown*.6,headroom:crown*.4};
  const p=fitPattern(points,w,h,target,angle,scale);
  for(const q of points){const y=p.y+(q.x*Math.sin(angle)+q.y*Math.cos(angle))*p.radius,x=p.x+(q.x*Math.cos(angle)-q.y*Math.sin(angle))*p.radius;
   assert.ok(y>=8.99&&y<=crown-3.99);assert.ok(x>=8.99&&x<=w-8.99);}
 }
});
