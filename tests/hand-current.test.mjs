import test from 'node:test';
import assert from 'node:assert/strict';
import {moveSparkWithHand} from '../hand-current.js';
import {PalmTracker,catchOnPalm} from '../palm.js';

const palm={x:200,y:300,rx:35,ry:40,angle:0,previousX:200,previousY:300,vx:240,vy:-90};
const spark=()=>({x:210,y:290,vx:0,vy:80,released:true});
test('moving hand transfers its horizontal and vertical motion to nearby released sparks',()=>{
 const p=spark();for(let i=0;i<30;i++){p.x+=p.vx/60;p.y+=p.vy/60;moveSparkWithHand(p,palm,1/60,600,800);}
 assert.ok(p.x>260);assert.ok(p.y<290);assert.ok(p.vx>100);assert.ok(p.vy<0);
 const left=spark();moveSparkWithHand(left,{...palm,vx:-240},.05,600,800);assert.ok(left.vx<0);
});
test('hand motion ignores distant particles, held patterns, hearts, landed stars, stationary hands and tracking loss',()=>{
 for(const [p,hand] of [[{...spark(),x:900},palm],[{...spark(),released:false},palm],[{...spark(),heart:true},palm],[{...spark(),star:'water'},palm],[spark(),{...palm,vx:4,vy:3}],[spark(),null]]){
  const original={...p};assert.equal(moveSparkWithHand(p,hand,.05,600,800),false);assert.deepEqual(p,original);
 }
});
test('hand influence remains consistent at 30, 60 and 120 Hz',()=>{
 const run=hz=>{const p=spark();for(let i=0;i<hz;i++){p.x+=p.vx/hz;p.y+=p.vy/hz;moveSparkWithHand(p,{...palm,x:200+100*(i+1)/hz},1/hz,600,800);}return p;};
 const reference=run(120);for(const hz of [30,60]){const p=run(hz);assert.ok(Math.hypot(p.x-reference.x,p.y-reference.y)<2);}
});
test('an upward scooping hand catches a slow heart and existing upper-palm overlap can settle',()=>{
 const hit=catchOnPalm({x:200,y:270,vy:0,radius:10},{x:200,y:270},{...palm,previousY:330});
 assert.ok(hit);
 assert.ok(catchOnPalm({x:200,y:275,vy:90,radius:10},{x:200,y:270},palm));
 assert.ok(catchOnPalm({x:200,y:330,vy:90,radius:10},{x:200,y:325},palm));
 assert.equal(catchOnPalm({x:200,y:330,vy:90,radius:10},{x:200,y:325},palm,'rain'),null);
});
test('a single missing hand sample preserves attachment, while loss or a jump removes stale velocity',()=>{
 const tracker=new PalmTracker();tracker.observe(palm,0);tracker.update(.02,20);const id=tracker.generation;
 tracker.observe({...palm,x:220},40);tracker.update(.02,40);assert.ok(tracker.palm.vx>0);
 tracker.observe(null,80);assert.equal(tracker.generation,id);assert.ok(tracker.update(.02,80));
 assert.equal(tracker.update(.02,270),null);
 tracker.observe({...palm,x:500},280);assert.equal(tracker.palm.vx,0);assert.notEqual(tracker.generation,id);
});
