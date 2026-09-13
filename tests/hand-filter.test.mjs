import test from "node:test";
import assert from "node:assert/strict";
import { HandFilter } from "../hand.js";
test("adaptive filter reduces stationary fingertip jitter", () => {
  const f = new HandFilter(),
    raw = [],
    filtered = [];
  for (let i = 0; i < 120; i++) {
    const x = 0.5 + Math.sin(i * 2.2) * 0.003,
      p = f.update({ x, y: 0.5 }, i * 33);
    if (i > 20) {
      raw.push(x - 0.5);
      filtered.push(p.x - 0.5);
    }
  }
  const rms = (a) => Math.sqrt(a.reduce((s, x) => s + x * x, 0) / a.length);
  assert.ok(rms(filtered) < rms(raw) * 0.6);
});
test("moving finger stays responsive without predicting past its observed location", () => {
  const f = new HandFilter();
  for (let i = 0; i < 60; i++) {
    const x = 0.2 + i * 0.007,
      p = f.update({ x, y: 0.5 }, i * 33);
    assert.ok(p.x <= x + 1e-9);
    assert.ok(x - p.x < 0.025);
  }
});
test("long tracking gap and large jumps reset filter instead of drawing a stale bridge", () => {
  const f = new HandFilter();
  f.update({ x: 0.2, y: 0.4 }, 0);
  assert.deepEqual(f.update({ x: 0.8, y: 0.4 }, 33), { x: 0.8, y: 0.4 });
  assert.deepEqual(f.update({ x: 0.75, y: 0.45 }, 500), { x: 0.75, y: 0.45 });
});
