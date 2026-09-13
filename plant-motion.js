import { clamp } from "./smile.js";

// Distance to the swept hand path in the plant's elliptical contact area.
export function sweptInfluence(a, b, cx, cy, rx, ry) {
  const ax = (a.x - cx) / rx,
    ay = (a.y - cy) / ry;
  const dx = (b.x - a.x) / rx,
    dy = (b.y - a.y) / ry;
  const t = clamp(-(ax * dx + ay * dy) / (dx * dx + dy * dy || 1));
  return Math.max(0, 1 - Math.hypot(ax + dx * t, ay + dy * t));
}

export function stepSway(plant, dt) {
  // Small fixed substeps keep the spring stable on slower phones.
  const steps = Math.max(1, Math.ceil(dt / 0.012)),
    step = dt / steps;
  for (let i = 0; i < steps; i++) {
    plant.bendVelocity += (-22 * plant.bend - 4.6 * plant.bendVelocity) * step;
    plant.bend += plant.bendVelocity * step;
    if (Math.abs(plant.bend) > 0.62) {
      plant.bend = clamp(plant.bend, -0.62, 0.62);
      if (plant.bend * plant.bendVelocity > 0) plant.bendVelocity = 0;
    }
  }
}
