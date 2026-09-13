export const clamp = (x, a = 0, b = 1) => Math.max(a, Math.min(b, x));
export function smileScore(categories) {
  const s = Object.fromEntries(categories.map((c) => [c.categoryName, c.score]));
  const l = s.mouthSmileLeft || 0,
    r = s.mouthSmileRight || 0;
  return clamp((0.55 * (l + r)) / 2 + 0.45 * Math.min(l, r) - 0.06 * (s.jawOpen || 0));
}
export class SmileGate {
  constructor(threshold = 0.45) {
    this.threshold = threshold;
    this.reset();
  }
  reset() {
    this.value = 0;
    this.active = false;
    this.aboveSince = null;
    this.belowSince = null;
    this.lastTime = null;
    this.lastFaceTime = null;
    this.recovering = false;
    this.wind = 0;
  }
  update(score, hasFace, time, tilt = 0) {
    const dt = this.lastTime === null ? 50 : Math.max(0, time - this.lastTime);
    this.lastTime = time;
    if (!hasFace) {
      // Hold a confirmed expression through a brief dropout; missing samples
      // never count toward confirming a new smile or keep steering the wind.
      this.wind = 0;
      if (this.lastFaceTime !== null && time - this.lastFaceTime <= 280) {
        this.recovering = true;
        return this.snapshot(true);
      }
      this.reset();
      this.lastTime = time;
      return this.snapshot(false);
    }
    if (this.recovering) {
      if (time - this.lastFaceTime > 280) this.reset();
      else if (this.aboveSince !== null) this.aboveSince += time - this.lastFaceTime;
      this.belowSince = null;
    }
    this.recovering = false;
    this.lastFaceTime = time;
    this.lastTime = time;
    const alpha = 1 - Math.exp(-Math.min(dt, 150) / 80);
    this.value += (clamp(score) - this.value) * alpha;
    this.wind += (clamp(tilt, -1, 1) - this.wind) * alpha;
    if (!this.active) {
      if (this.value >= this.threshold) {
        this.aboveSince ??= time;
        if (time - this.aboveSince >= 120) {
          this.active = true;
          this.belowSince = null;
        }
      } else this.aboveSince = null;
    } else {
      if (this.value < this.threshold - Math.min(0.12,this.threshold*.4)) {
        this.belowSince ??= time;
        if (time - this.belowSince >= 550) {
          this.active = false;
          this.aboveSince = null;
        }
      } else this.belowSince = null;
    }
    return this.snapshot(true);
  }
  snapshot(face) {
    return { value: this.value, active: this.active, wind: this.wind, face };
  }
}
