import test from "node:test";
import assert from "node:assert/strict";
import { coverPoint } from "../hand.js";
test("hand coordinates match cover-cropped portrait preview and mirror", () => {
  assert.deepEqual(coverPoint({ x: 0.5, y: 0.5 }, 1280, 720, 400, 700), { x: 0.5, y: 0.5 });
  const a = coverPoint({ x: 0.6, y: 0.7 }, 1280, 720, 400, 700),
    b = coverPoint({ x: 0.6, y: 0.7 }, 1280, 720, 400, 700, true);
  assert.ok(a.x > 0.6);
  assert.ok(Math.abs(a.x + b.x - 1) < 1e-9);
  assert.equal(a.y, b.y);
});
