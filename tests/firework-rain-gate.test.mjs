import test from 'node:test';
import assert from 'node:assert/strict';
import { FireworkRainGate } from '../firework-rain-gate.js';
import { Fireworks } from '../fireworks.js';
const sparks=(id,n)=>Array.from({length:n},()=>({fireworkId:id,age:2,life:7}));

test('rain waits through formation and 59% completion, then releases at exactly 60%',()=>{
  const gate=new FireworkRainGate();gate.begin(1,100);
  gate.update(sparks(1,100));assert.equal(gate.blocked,true);
  gate.update(sparks(1,41));assert.equal(gate.blocked,true);
  gate.update(sparks(1,40));assert.equal(gate.blocked,false);assert.equal(gate.progress,.6);
});
test('a new burst or rising rocket blocks rain even after older bursts settle',()=>{
  const gate=new FireworkRainGate();gate.begin(1,100);gate.update(sparks(1,10));
  gate.begin(2,100);gate.update([...sparks(1,10),...sparks(2,90)]);assert.equal(gate.blocked,true);
  gate.update([...sparks(1,10),...sparks(2,20)]);assert.equal(gate.blocked,false);
  const fx=Object.assign(Object.create(Fireworks.prototype),{rockets:[{}],rainGate:gate});
  assert.equal(fx.rainBlocked,true);fx.rockets=[];assert.equal(fx.rainBlocked,false);
});
test('water stars, converted hearts and expired/out-of-view sparks cannot indefinitely block rain',()=>{
  const gate=new FireworkRainGate();gate.begin(1,100);
  gate.update([...sparks(1,20),...sparks(1,20).map(p=>({...p,heart:true})),...sparks(1,20).map(p=>({...p,star:'water'})),...sparks(1,20).map(p=>({...p,age:8}))]);
  assert.equal(gate.blocked,false);
  gate.begin(2,12);gate.clear();assert.equal(gate.blocked,false);assert.equal(gate.progress,1);
});
