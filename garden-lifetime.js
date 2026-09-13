export class GardenLifetime {
  constructor() {
    this.reset();
  }
  reset() {
    this.idle = 0;
    this.opacity = 1;
    this.fading = false;
  }
  update(dt, smiling, visible, fireworks = false) {
    // Laughter is also a smile: the firework transition must take precedence.
    // Hold the garden at zero until that mode ends, including between launches.
    if (fireworks) {
      this.idle = 0;
      this.fading = visible;
      this.opacity = Math.max(0, this.opacity - dt);
      return visible && this.opacity <= 0;
    }
    if (smiling || !visible) this.idle = 0;
    else this.idle += dt;
    this.fading = visible && this.idle >= 1;
    this.opacity = this.fading
      ? Math.max(0, this.opacity - dt / 2.2)
      : Math.min(1, this.opacity + dt / 0.3);
    return this.opacity <= 0;
  }
}
