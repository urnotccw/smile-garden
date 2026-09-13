import test from 'node:test';
import assert from 'node:assert/strict';
import {catchMorph,waterImpactScale,updateLandedStar,WATER_STAR_LIMIT} from '../star-landing.js';
import {updateHandVortex,swirlSpark} from '../hand-current.js';
import {RenderQuality} from '../render-quality.js';
import {Fireworks,patternPoints} from '../fireworks.js';
const palm={x:200,y:300,rx:40,ry:45,angle:0,vx:0,vy:0};
test('a caught heart pauses before turning into a star and must be held before a throw',()=>{
 assert.equal(catchMorph(0),0);assert.equal(catchMorph(.15),0);assert.ok(catchMorph(.3)>.4);assert.equal(catchMorph(.4),1);
 const p={star:'palm',x:200,y:300,age:.2,life:4.2,palmGeneration:1,palmOffset:{x:0,y:-30},starSize:30,tilt:0};
 updateLandedStar(p,{...palm,vx:500},1,.02,400,600);assert.equal(p.star,'palm');
 p.age=.5;updateLandedStar(p,palm,1,.02,400,600);assert.equal(p.throwReady,true);
 updateLandedStar(p,{...palm,vx:460,vy:-100},1,.02,400,600);assert.equal(p.star,'tossed');assert.ok(p.vx>400&&p.vy<0);
 const before={x:p.x,y:p.y};p.age+=.1;updateLandedStar(p,null,2,.1,400,600);assert.ok(p.x>before.x&&p.y<before.y);
});
test('a thrown star can splash down without exceeding the water-star budget',()=>{
 const make=()=>({star:'tossed',x:200,y:569,vx:0,vy:200,age:1,life:3,tilt:0,starSize:30});
 const p=make(),counts={water:0,waterSites:[]};updateLandedStar(p,null,0,.05,400,600,counts);
 assert.equal(p.star,'water');assert.equal(counts.water,1);assert.equal(p.age,0);
 const crowded=make();updateLandedStar(crowded,null,0,.05,400,600,{water:WATER_STAR_LIMIT,waterSites:[]});assert.equal(crowded.life,0);
});
test('large stars make visibly larger water impacts than small stars',()=>{
 assert.ok(waterImpactScale(44)>waterImpactScale(10)*2);assert.ok(waterImpactScale(24)>waterImpactScale(14));
});
test('fast hand swipes create a local swirl that dissipates after the hand stops',()=>{
 const v=updateHandVortex(null,{...palm,vx:500},.016);assert.ok(v);
 const p={x:220,y:300,vx:0,vy:0,released:true};assert.equal(swirlSpark(p,v,.05),true);assert.ok(p.vy>0);
 const heart={...p,heart:true},before={...heart};assert.equal(swirlSpark(heart,v,.05),false);assert.deepEqual(heart,before);
 let tail=v;for(let i=0;i<50;i++)tail=updateHandVortex(tail,null,.016);assert.equal(tail,null);
 assert.equal(updateHandVortex(null,palm,.016),null);
});
test('quality reduces decoration after sustained slowness and recovers slowly without oscillation',()=>{
 const q=new RenderQuality();q.observe(.16);assert.equal(q.level,0);
 for(let i=0;i<120;i++)q.observe(.04);assert.equal(q.level,2);
 for(let i=0;i<180;i++)q.observe(1/60);assert.equal(q.level,2);
 for(let i=0;i<1000;i++)q.observe(1/60);assert.equal(q.level,0);
 q.observe(1);assert.equal(q.level,0);
});
test('dense fresh fireworks postpone another launch until the falling field clears',()=>{
 const fx=Object.assign(Object.create(Fireworks.prototype),{w:900,h:600,patterns:Array.from({length:4},(_,i)=>patternPoints(i)),particles:Array.from({length:600},(_,i)=>({fireworkId:i%2,age:1,releaseAt:1.05})),rockets:[],launchLanes:[],nextPattern:0,time:3,lastLaunch:0,headTracker:{head:null},launched:2});
 assert.equal(fx.launch(1),false);
 fx.particles.forEach(p=>p.age=4);assert.equal(fx.launch(1),true);assert.equal(fx.activeFireworkCount,3);
});
