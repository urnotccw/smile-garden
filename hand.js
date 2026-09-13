export function coverPoint(p, sourceWidth, sourceHeight, width, height, mirror = false) {
  const scale = Math.max(width / sourceWidth, height / sourceHeight);
  const x = (p.x * sourceWidth * scale - (sourceWidth * scale - width) / 2) / width;
  const y = (p.y * sourceHeight * scale - (sourceHeight * scale - height) / 2) / height;
  return { x: mirror ? 1 - x : x, y };
}
// One Euro filter: strong damping at rest, less damping during intentional motion.
export class HandFilter {
  reset() {
    this.point = null;
    this.raw = null;
    this.velocity = { x: 0, y: 0 };
    this.time = 0;
  }
  constructor({ minCutoff = 2.8, beta = 7 } = {}) {
    this.minCutoff = minCutoff;
    this.beta = beta;
    this.reset();
  }
  update(p, time) {
    if (
      !this.point ||
      time - this.time > 180 ||
      Math.hypot(p.x - this.raw.x, p.y - this.raw.y) > 0.22
    ) {
      this.point = { ...p };
      this.raw = { ...p };
      this.velocity = { x: 0, y: 0 };
      this.time = time;
      return { ...p };
    }
    const dt = Math.max(0.001, (time - this.time) / 1000),
      alpha = (cutoff) => 1 / (1 + 1 / (2 * Math.PI * cutoff * dt));
    const speedAlpha = alpha(1.5);
    for (const axis of ["x", "y"])
      this.velocity[axis] += speedAlpha * ((p[axis] - this.raw[axis]) / dt - this.velocity[axis]);
    const cutoff = this.minCutoff + this.beta * Math.hypot(this.velocity.x, this.velocity.y),
      a = alpha(cutoff);
    for (const axis of ["x", "y"]) this.point[axis] += a * (p[axis] - this.point[axis]);
    this.raw = { ...p };
    this.time = time;
    return { ...this.point };
  }
}
