// Track each burst separately: an older completed firework cannot release rain
// while a newer pattern is still forming. Converted hearts/stars have their own
// interactions; expired/offscreen sparks also finish so they cannot lock rain.
export class FireworkRainGate {
  constructor() { this.clear(); }
  clear() { this.bursts = new Map(); this.progress = 1; }
  begin(id, total) {
    if (total > 0) { this.bursts.set(id, total); this.progress = 0; }
  }
  update(particles) {
    const airborne = new Map();
    for (const p of particles) {
      if (p.falling !== false && !p.heart && !p.star && p.age < p.life && this.bursts.has(p.fireworkId))
        airborne.set(p.fireworkId, (airborne.get(p.fireworkId) || 0) + 1);
    }
    this.progress = 1;
    for (const [id, total] of this.bursts) {
      const remaining = airborne.get(id) || 0;
      this.progress = Math.min(this.progress, 1 - remaining / total);
      if (remaining <= Math.floor(total * .4 + 1e-8)) this.bursts.delete(id);
    }
  }
  get blocked() { return this.bursts.size > 0; }
}
