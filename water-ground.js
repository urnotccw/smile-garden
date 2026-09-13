// A shallow, cached wax-pigment wash, revealed by actual water impacts.
export const WATER_GROUND_HEIGHT = 0.075;

export class CrayonWaterGround {
  constructor() {
    this.texture = null;
    this.clear();
  }
  clear() {
    this.idle = Infinity;
    this.opacity = 0;
  }
  impact() {
    this.idle = 0;
  }
  update(dt) {
    this.idle += dt;
    // Keep the wash beneath the 2.6-second floating stars, then dissolve it.
    this.opacity = this.idle <= 2.6
      ? Math.min(1, this.opacity + dt / 0.55)
      : Math.max(0, this.opacity - dt / 0.9);
  }
  paint(w, h) {
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(Math.min(w, 1000)));
    canvas.height = Math.max(8, Math.ceil(h * WATER_GROUND_HEIGHT * canvas.width / w));
    const c = canvas.getContext('2d'), W = canvas.width, H = canvas.height;
    let seed = 91027;
    const rand = () => ((seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0) / 4294967296);
    const wash = c.createLinearGradient(0, 0, 0, H);
    wash.addColorStop(0, 'rgba(170,218,237,0)');
    wash.addColorStop(0.22, 'rgba(170,218,237,0.16)');
    wash.addColorStop(0.56, 'rgba(153,207,232,0.44)');
    wash.addColorStop(1, 'rgba(139,197,225,0.62)');
    c.fillStyle = wash;
    c.beginPath();
    c.moveTo(0, H);
    for (let x = 0; x <= W + 5; x += 5)
      c.lineTo(x, H * (0.04 + 0.027 * Math.sin(x / W * 19) + 0.016 * Math.sin(x / W * 47)));
    c.lineTo(W, H);
    c.closePath();
    c.fill();
    c.globalCompositeOperation = 'source-atop';
    const colors = ['#d1edf3', '#b8e1ee', '#96cddd', '#8cbfda'];
    c.lineCap = 'round';
    // Short, overlapping sideways strokes leave a rubbed-crayon surface.
    for (let i = 0; i < W * H / 32; i++) {
      const x = rand() * W, y = rand() * H, length = 7 + rand() * 34;
      c.strokeStyle = colors[i % colors.length];
      c.globalAlpha = 0.12 + rand() * 0.22;
      c.lineWidth = 0.5 + rand() * 1.5;
      c.beginPath();c.moveTo(x, y);
      c.lineTo(x + length * 0.55, y + rand() - 0.5);
      c.lineTo(x + length, y + rand() * 1.6 - 0.8);c.stroke();
    }
    c.globalAlpha = 1;
    const pixels = c.getImageData(0, 0, W, H), data = pixels.data;
    for (let i = 0; i < data.length; i += 4) {
      const grain = rand();
      if (grain < 0.12) data[i + 3] *= 0.25 + rand() * 0.45;
      else if (grain > 0.77) {
        data[i] += (255 - data[i]) * 0.24;
        data[i + 1] += (255 - data[i + 1]) * 0.24;
        data[i + 2] += (255 - data[i + 2]) * 0.24;
      }
    }
    c.putImageData(pixels, 0, 0);
    this.texture = canvas;
    this.width = w;this.height = h;
  }
  draw(c, w, h) {
    if (this.opacity <= 0) return;
    if (!this.texture || this.width !== w || this.height !== h) this.paint(w, h);
    c.save();
    c.globalCompositeOperation = 'source-over';
    c.globalAlpha = this.opacity;
    c.drawImage(this.texture, 0, h * (1 - WATER_GROUND_HEIGHT), w, h * WATER_GROUND_HEIGHT);
    c.restore();
  }
}
