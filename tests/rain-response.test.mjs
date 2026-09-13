import test from 'node:test';
import assert from 'node:assert/strict';
import {GardenScene} from '../effects.js';
import {GardenLifetime} from '../garden-lifetime.js';
import {SmileGate} from '../smile.js';
import {plantGrowth} from '../plant-growth.js';

function scene(phonePreview) {
  return Object.assign(Object.create(GardenScene.prototype), {
    canvas:{style:{}}, plantCanvas:{style:{}}, lifetime:new GardenLifetime(),
    drops:[],ripples:[],splashes:[],plants:[],water:[],grassLevel:0,
    rain:0,credit:0,wind:0,time:0,dropSerial:0,density:10,grow:true,
    w:phonePreview?393:1200,h:phonePreview?852:675,phonePreview,
    rainWasActive:false,onCount:()=>{},
    seedDelay:0,nextPlant:0,plantSequence:[2,6,1,8],
    heightRanges:Array.from({length:16},()=>[.15,.22]),
    rects:Array.from({length:16},()=>[0,0,100,200]),
  });
}
for(const phone of [false,true])test(`first visible rain follows smile confirmation on the next update (portrait=${phone})`,()=>{
  const s=scene(phone),g=new SmileGate(.1);
  g.update(.6,true,0);g.update(.6,true,110);g.update(.6,true,220);
  assert.equal(g.active,true);
  s.update(1/60,g.active,0,g.value);
  assert.equal(s.drops.length,2);
  assert.ok(s.drops.every(d=>d.y>0&&d.y<.1));
  for(let i=0;i<5;i++)s.update(1/60,true,0,g.value);
  assert.equal(s.drops.length,2,'starter drops are not added every frame');
});
test('firework suppression blocks starter rain; releasing it starts rain immediately',()=>{
  const s=scene(true);
  for(let i=0;i<60;i++)s.update(1/60,true,0,.6,true,1/60,true);
  assert.equal(s.drops.length,0);
  s.update(1/60,true,0,.6,true,1/60,false);
  assert.equal(s.drops.length,2);
});
test('relaxed face and disabled density cannot spawn acknowledgement drops',()=>{
  const s=scene(true);
  s.update(1/60,false,0,0,false);
  assert.equal(s.drops.length,0);
  s.density=0;s.update(1/60,true,0,.6);
  assert.equal(s.drops.length,0);
});

test('a landed drop grows the first flower before the grass is fully revealed at 10 and 60 FPS',()=>{
 const original=Math.random;Math.random=()=>.5;
 try {
  const times=[];
  for(const fps of [10,60]){
   const s=scene(true);s.density=0;
   s.drops=[{x:.25,y:.05,floor:.95,vy:150,vx:0,age:0,size:6}];
   let first=null;
   for(let i=1;i<=fps*4;i++){
    s.update(Math.min(.05,1/fps),true,0,.5,true,1/fps);
    if(s.plants.length && first===null){first=i/fps;assert.ok(s.grassLevel<1);assert.ok(first>1.5,'cannot sprout before a real landing');}
   }
   assert.ok(first!==null&&first<3.2,`first flower at ${first}s (${fps} FPS)`);
   assert.ok(plantGrowth(s.plants[0]).reveal>.5,'first flower is visibly grown at 4s');
   times.push(first);
  }
  assert.ok(Math.abs(times[0]-times[1])<.2,`timings ${times}`);
 }finally{Math.random=original;}
});
test('green grass alone cannot spawn plants; early watered points wait for visible ground',()=>{
 const s=scene(false);s.density=0;
 for(let i=0;i<100;i++)s.update(.05,true,0,.6);
 assert.equal(s.plants.length,0);
 s.grassLevel=.1;s.waterSeed(.3,.95);assert.equal(s.plants.length,0);assert.equal(s.water.length,1);
 for(let i=0;i<22;i++)s.update(.05,true,0,.6);
 assert.equal(s.plants.length,1);assert.ok(s.grassLevel<1);
});
test('rain caught in the palm does not also grow flowers on the ground',()=>{
 const s=scene(true);s.catchRain=()=>true;
 for(let i=0;i<120;i++)s.update(.05,true,0,.6);
 assert.equal(s.plants.length,0);
 assert.equal(s.ripples.length,0);
});
test('fireworks do not germinate queued seeds and still clear the garden',()=>{
 const s=scene(true);s.waterSeed(.3,.95);s.grassLevel=.5;
 for(let i=0;i<30;i++)s.update(.05,true,0,.6,true,.05,true);
 assert.equal(s.plants.length,0);assert.equal(s.water.length,0);
});
test('a ready extra plant atlas can draw while the first atlas is still loading',()=>{
 const s=scene(false),drawn=[];
 s.atlas={complete:false,naturalWidth:0};s.extraAtlas={complete:true,naturalWidth:100};
 s.plants=[{type:8,age:3,growth:.9,seed:1,watered:0,x:.5,y:.98,height:.2,opacity:.8,flip:1,bend:0}];
 s.plantCtx=new Proxy({drawImage:atlas=>drawn.push(atlas)},{get:(target,key)=>target[key]??(()=>{})});
 s.drawPlants();assert.deepEqual(drawn,[s.extraAtlas]);
});
