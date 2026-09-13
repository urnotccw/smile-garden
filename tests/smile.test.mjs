import test from "node:test";
import assert from "node:assert/strict";
import { SmileGate, smileScore } from "../smile.js";
const feed = (g, score, start, end) => {
  for (let t = start; t <= end; t += 50) g.update(score, true, t);
};
test("sustained smile triggers; one brief spike does not", () => {
  const g = new SmileGate();
  feed(g, 0.05, 0, 400);
  feed(g, 0.99, 450, 500);
  feed(g, 0.05, 550, 1000);
  assert.equal(g.active, false);
  feed(g, 0.85, 1050, 1600);
  assert.equal(g.active, true);
});
test("hysteresis tolerates threshold jitter, sustained relaxed expression stops rain", () => {
  const g = new SmileGate();
  feed(g, 0.85, 0, 800);
  assert.equal(g.active, true);
  feed(g, 0.38, 850, 1800);
  assert.equal(g.active, true);
  feed(g, 0.02, 1850, 2800);
  assert.equal(g.active, false);
});
test("lost face immediately resets rain and wind; return needs new dwell", () => {
  const g = new SmileGate();
  feed(g, 0.9, 0, 800);
  g.update(0.9, true, 850, 0.8);
  assert.ok(g.wind > 0);
  const state = g.update(0, false, 900);
  assert.deepEqual(state, { value: 0, active: false, wind: 0, face: false });
  g.update(0.9, true, 950);
  assert.equal(g.active, false);
});
test("asymmetric mouth and open jaw alone cannot pass default smile threshold", () => {
  const values = (l, r, j) => [
    { categoryName: "mouthSmileLeft", score: l },
    { categoryName: "mouthSmileRight", score: r },
    { categoryName: "jawOpen", score: j },
  ];
  assert.ok(smileScore(values(1, 0, 0)) < 0.45);
  assert.equal(smileScore(values(0, 0, 1)), 0);
  assert.ok(smileScore(values(0.8, 0.8, 0.2)) > 0.7);
});
