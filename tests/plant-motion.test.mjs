import test from "node:test";
import assert from "node:assert/strict";
import { sweptInfluence, stepSway } from "../plant-motion.js";
import { PlantBrush } from "../plant-brush.js";

test("a fast sweep hits the crossed flower but leaves distant flowers alone", () => {
  const a = { x: 0, y: 300 },
    b = { x: 600, y: 300 };
  assert.equal(sweptInfluence(a, b, 300, 300, 30, 60), 1);
  assert.equal(sweptInfluence(a, b, 300, 50, 30, 60), 0);
});
test("spring bends in the impulse direction, rebounds and settles at different frame rates", () => {
  for (const fps of [20, 60, 120]) {
    const plant = { bend: 0, bendVelocity: 3 };
    let peak = 0,
      reversed = false;
    for (let i = 0; i < fps * 5; i++) {
      stepSway(plant, 1 / fps);
      peak = Math.max(peak, plant.bend);
      if (plant.bend < 0) reversed = true;
      assert.ok(Math.abs(plant.bend) <= 0.62);
    }
    assert.ok(peak > 0.2);
    assert.ok(reversed);
    assert.ok(Math.abs(plant.bend) < 0.001);
  }
});
test("stationary hands and hands reappearing after loss never sweep stale positions", () => {
  const hits = [];
  const scene = {
    w: 640,
    h: 480,
    plantCanvas: { addEventListener() {} },
    brush(...args) {
      hits.push(args);
    },
  };
  const brush = new PlantBrush(scene, { videoWidth: 640, videoHeight: 480 });
  const hand = (x) => Array.from({ length: 21 }, () => ({ x, y: 0.8, z: 0 }));
  brush.hand(hand(0.3), 100, false);
  for (let i = 0; i < 10; i++) brush.hand(hand(0.3), 120 + i * 30, false);
  assert.equal(hits.length, 0);
  brush.hand(hand(0.34), 430, false);
  assert.ok(hits.length > 0);
  brush.hand(null, 460, false);
  hits.length = 0;
  brush.hand(hand(0.7), 490, false);
  assert.equal(hits.length, 0);
  brush.tick(800);
  brush.hand(hand(0.6), 820, false);
  assert.equal(hits.length, 0);
});
