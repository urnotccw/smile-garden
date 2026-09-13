import test from 'node:test';
import assert from 'node:assert/strict';
import {GardenScene} from '../effects.js';
import {GardenLifetime} from '../garden-lifetime.js';
import {SmileGate} from '../smile.js';

function scene(phonePreview) {
  return Object.assign(Object.create(GardenScene.prototype), {
    canvas:{style:{}}, plantCanvas:{style:{}}, lifetime:new GardenLifetime(),
    drops:[],ripples:[],splashes:[],plants:[],water:[],grassLevel:0,
    rain:0,credit:0,wind:0,time:0,dropSerial:0,density:10,grow:true,
    w:phonePreview?393:1200,h:phonePreview?852:675,phonePreview,
    rainWasActive:false,onCount:()=>{},
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
