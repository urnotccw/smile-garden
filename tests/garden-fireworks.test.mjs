import test from 'node:test';
import assert from 'node:assert/strict';
import {GardenLifetime} from '../garden-lifetime.js';

test('fireworks fade the garden in one second even while the user keeps smiling',()=>{
  for(const dt of [1/30,1/60,1/120]){
    const life=new GardenLifetime();let endedAt=0;
    for(let t=dt;t<1.1;t+=dt)if(life.update(dt,true,true,true)){endedAt=t;break;}
    assert.ok(endedAt>=.99&&endedAt<=1+dt+.001);
    assert.equal(life.opacity,0);
    assert.equal(life.update(.5,true,false,true),false);
    assert.equal(life.opacity,0,'empty garden stays hidden throughout fireworks');
    life.update(.15,true,false,false);assert.ok(life.opacity>0&&life.opacity<1);
    life.update(.2,true,false,false);assert.equal(life.opacity,1);
  }
});

test('a short laugh transition reverses smoothly and ordinary smile release still waits one second',()=>{
  const life=new GardenLifetime();life.update(.4,true,true,true);assert.equal(life.opacity,.6);
  life.update(.06,true,true,false);assert.ok(life.opacity>.6&&life.opacity<1);
  life.reset();life.update(.9,false,true);assert.equal(life.opacity,1);
  life.update(.2,false,true);assert.ok(life.opacity<1&&life.opacity>.8);
});
