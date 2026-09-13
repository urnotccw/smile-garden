import test from 'node:test';
import assert from 'node:assert/strict';
import {FireworkLayers, motifEnvelope} from '../firework-layers.js';

test('pigment forms with the sparks then dissolves quickly at detonation', () => {
  assert.equal(motifEnvelope(0).opacity, 0);
  assert.equal(motifEnvelope(.8).scale, 1);
  const before = motifEnvelope(1.05), after = motifEnvelope(1.050001);
  assert.ok(Math.abs(before.opacity - after.opacity) < .00001);
  assert.ok(motifEnvelope(1.16).opacity > .45 && motifEnvelope(1.16).opacity < .55);
  assert.equal(motifEnvelope(1.27).opacity, 0, 'no solid pigment remains in the scattering phase');
});

test('visual bursts remain bounded, resize proportionally, and clear independently of physics', () => {
  const layer = Object.assign(Object.create(FireworkLayers.prototype), {events: []});
  for(let i=0;i<20;i++) layer.add(100, 160, 80, i%4, .2, 400, 800);
  assert.equal(layer.events.length, 3);
  assert.equal(layer.events[0].x * 800, 200);
  assert.equal(layer.events[0].y * 1600, 320);
  layer.update(1.28); assert.equal(layer.events.length, 0);
  layer.add(100, 160, 80, 0, 0, 400, 800);
  layer.clear(); assert.equal(layer.events.length, 0);
});
