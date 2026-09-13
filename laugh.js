import { clamp } from "./smile.js";

// Expression changes quickly; rain additionally waits for the current bursts
// to finish 60% of their original spark flights.
export function suppressGarden(liveCamera, laughing, fireworksPending) {
  return (liveCamera && laughing) || fireworksPending;
}

export function laughScore(categories) {
  const s = Object.fromEntries(categories.map((c) => [c.categoryName, c.score]));
  const smile = Math.min(s.mouthSmileLeft || 0, s.mouthSmileRight || 0);
  const jaw = s.jawOpen || 0;
  // A broad bilateral smile plus an open mouth, rather than speech or a yawn alone.
  if (smile < 0.4 || jaw < 0.06) return 0;
  return clamp(smile * 0.72 + clamp(jaw / 0.32) * 0.28);
}
export class LaughGate {
  constructor(threshold = 0.6) {
    this.threshold = threshold;
    this.reset();
  }
  reset() {
    this.value = 0;
    this.active = false;
    this.below = null;
    this.since = null;
    this.time = null;
    this.lastLaunch = -Infinity;
  }
  update(score, face, time) {
    if (!face) {
      this.value = 0;
      this.active = false;
      this.below = null;
      this.since = null;
      this.time = time;
      return false;
    }
    const dt = this.time === null ? 50 : Math.max(0, time - this.time);
    this.time = time;
    this.value += (score - this.value) * (1 - Math.exp(-dt / 90));
    if (score <= 0 || this.value < this.threshold) {
      this.since = null;
      this.below ??= time;
      if (time - this.below >= 250) this.active = false;
      return false;
    }
    this.below = null;
    this.since ??= time;
    if (time - this.since >= 150) this.active = true;
    if (this.active && time - this.lastLaunch >= 1600) {
      this.lastLaunch = time;
      return true;
    }
    return false;
  }
  get volleySize() {
    return this.active && this.since !== null && this.time - this.since >= 1400 ? 2 : 1;
  }
}
