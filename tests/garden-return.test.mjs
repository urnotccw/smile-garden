import test from 'node:test';
import assert from 'node:assert/strict';
import { LaughGate, suppressGarden } from '../laugh.js';
import { plantGrowth } from '../plant-growth.js';

test('returning to a smile waits for the firework landing gate, with no extra expression delay', () => {
  const laugh = new LaughGate();
  for(let t=0;t<1200;t+=50) laugh.update(.9,true,t);
  assert.equal(laugh.active,true);
  assert.equal(suppressGarden(true,laugh.active,true),true);
  for(let t=1200;t<=1500;t+=50) laugh.update(0,true,t);
  assert.equal(laugh.active,false);
  assert.equal(suppressGarden(true,laugh.active,true),true,'airborne fireworks still block rain');
  assert.equal(suppressGarden(true,laugh.active,false),false,'rain may return as soon as the 60% landing gate opens');
  assert.equal(suppressGarden(false,false,true),true,'manual preview still suppresses the garden');
  assert.equal(suppressGarden(true,true,false),true,'ongoing laughter suppresses between volleys');
});

test('rooted growth is continuous, completes, and varies its rhythm without stretching the image', () => {
  for(const duration of [2.1,2.6,3.1]) {
    const p={age:0,growDuration:duration,growDelay:.1,growth:.85,seed:2};
    let previous=plantGrowth(p);
    assert.equal(previous.height,0);
    for(let t=0;t<3.4;t+=1/60) {
      p.age=t;const pose=plantGrowth(p);
      assert.ok(pose.height>=previous.height);
      assert.ok(pose.height-previous.height<.011);
      assert.ok(pose.scale>=0&&pose.scale<=.85);
      assert.equal(pose.scale,pose.height,'uniform scaling keeps the complete illustration in proportion');
      previous=pose;
    }
    assert.equal(previous.reveal,1);assert.equal(previous.height,.85);
  }
});
