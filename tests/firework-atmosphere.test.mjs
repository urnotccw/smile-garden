import test from 'node:test';
import assert from 'node:assert/strict';
import {FireworkAtmosphere,atmosphereEnvelope,ATMOSPHERE_LIMIT} from '../firework-atmosphere.js';

test('rim light rises with the bloom, smoke waits for explosion, and both fully disappear',()=>{
  assert.deepEqual(atmosphereEnvelope(0),{edge:0,smoke:0});
  assert.equal(atmosphereEnvelope(.8).smoke,0);
  assert.ok(atmosphereEnvelope(.8).edge>.5);
  assert.deepEqual(atmosphereEnvelope(1.5),{edge:1,smoke:1});
  assert.ok(atmosphereEnvelope(3).edge<.3);
  assert.deepEqual(atmosphereEnvelope(4.2),{edge:0,smoke:0});
  let previous=atmosphereEnvelope(0);
  for(let age=.01;age<5;age+=.01){
    const next=atmosphereEnvelope(age);
    for(const key of ['edge','smoke'])assert.ok(Math.abs(next[key]-previous[key])<.06);
    previous=next;
  }
});

test('atmosphere stores only three recent normalized blooms and clears after expiry or reset',()=>{
  const atmosphere=new FireworkAtmosphere(null);
  for(let kind=0;kind<4;kind++)atmosphere.add(120,80,40,kind,400,600);
  assert.equal(atmosphere.events.length,ATMOSPHERE_LIMIT);
  assert.deepEqual(atmosphere.events.map(e=>e.kind),[1,2,3]);
  assert.equal(atmosphere.events[0].x,.3);assert.equal(atmosphere.events[0].radius,.1);
  atmosphere.update(4.21);assert.equal(atmosphere.events.length,0);
  atmosphere.add(100,100,40,0,400,600);atmosphere.clear();
  assert.equal(atmosphere.events.length,0);assert.equal(atmosphere.sampleAt,-Infinity);
});
