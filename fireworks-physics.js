import { clamp } from "./smile.js";
import { coverPoint } from "./hand.js";

export class HeartLimiter {
  constructor() {
    this.reset();
  }
  reset() {
    this.next = -Infinity;
  }
  allow(time, active) {
    if (active >= 20 || time < this.next) return false;
    this.next = time + 0.08;
    return true;
  }
}

export function mapHead(points, sourceWidth, sourceHeight, width, height, mirror) {
  if (!points || points.length !== 4) return null;
  const [top, bottom, left, right] = points.map((p) => {
    const q = coverPoint(p, sourceWidth, sourceHeight, width, height, mirror);
    return { x: q.x * width, y: q.y * height };
  });
  const span = Math.hypot(right.x - left.x, right.y - left.y),
    length = Math.hypot(bottom.x - top.x, bottom.y - top.y);
  if (span < 12 || length < 18) return null;
  let angle = Math.atan2(right.y - left.y, right.x - left.x);
  if (angle > Math.PI / 2) angle -= Math.PI;
  if (angle < -Math.PI / 2) angle += Math.PI;
  return {
    x: (top.x + bottom.x) / 2 + Math.sin(angle) * length * 0.07,
    y: (top.y + bottom.y) / 2 - Math.cos(angle) * length * 0.07,
    rx: span * 0.61,
    ry: length * 0.66,
    angle,
  };
}

export class HeadTracker {
  constructor() {
    this.reset();
  }
  reset() {
    this.head = null;
    this.target = null;
    this.lastSeen = -Infinity;
  }
  observe(head, time) {
    if (!head) {
      this.reset();
      return;
    }
    if (!this.head || Math.hypot(head.x - this.head.x, head.y - this.head.y) > head.ry * 1.6) {
      this.head = { ...head, previousX: head.x, previousY: head.y, vx: 0, vy: 0 };
    }
    this.target = head;
    this.lastSeen = time;
  }
  update(dt, time) {
    if (time - this.lastSeen > 350) {
      this.reset();
      return null;
    }
    if (!this.head || !this.target) return null;
    const h = this.head,
      a = 1 - Math.exp(-dt / 0.065);
    h.previousX = h.x;
    h.previousY = h.y;
    for (const key of ["x", "y", "rx", "ry", "angle"]) h[key] += (this.target[key] - h[key]) * a;
    h.vx = clamp((h.x - h.previousX) / Math.max(0.001, dt), -700, 700);
    h.vy = clamp((h.y - h.previousY) / Math.max(0.001, dt), -700, 700);
    return h;
  }
}

// Only falling particles entering the upper crown can bounce; cheeks and the jaw are not targets.
export function bounceOnHead(p, previous, head, dt) {
  if (!head || p.vy <= 0 || p.y <= previous.y) return false;
  const cos = Math.cos(head.angle),
    sin = Math.sin(head.angle),
    rx = head.rx + p.radius,
    ry = head.ry + p.radius;
  const local = (x, y) => ({ x: (x * cos + y * sin) / rx, y: (-x * sin + y * cos) / ry });
  const a = local(previous.x - (head.previousX ?? head.x), previous.y - (head.previousY ?? head.y));
  const b = local(p.x - head.x, p.y - head.y),
    dx = b.x - a.x,
    dy = b.y - a.y;
  const A = dx * dx + dy * dy,
    B = 2 * (a.x * dx + a.y * dy),
    C = a.x * a.x + a.y * a.y - 1;
  // A particle that already formed inside the face is not a landing on the crown.
  if (C < -1e-5) return false;
  let t = 0;
  if (C > 0) {
    const disc = B * B - 4 * A * C;
    if (A < 1e-12 || disc < 0) return false;
    t = (-B - Math.sqrt(disc)) / (2 * A);
    if (t < 0 || t > 1) return false;
  }
  let ux = a.x + dx * t,
    uy = a.y + dy * t,
    length = Math.hypot(ux, uy);
  if (length < 1e-6) {
    ux = 0;
    uy = -1;
    length = 1;
  }
  ux /= length;
  uy /= length;
  if (uy > -0.5) return false;
  let nx = (ux / rx) * cos - (uy / ry) * sin,
    ny = (ux / rx) * sin + (uy / ry) * cos;
  const n = Math.hypot(nx, ny);
  nx /= n;
  ny /= n;
  if (ny > -0.35) return false;
  const rvx = p.vx - (head.vx || 0),
    rvy = p.vy - (head.vy || 0),
    normal = rvx * nx + rvy * ny;
  if (normal >= 0) return false;
  p.vx -= 1.78 * normal * nx;
  p.vy -= 1.78 * normal * ny;
  // A small outward impulse makes a soft brush visibly bounce, even near rest.
  p.vx += nx * 24;
  p.vy += ny * 24;
  p.x = head.x + ux * rx * cos - uy * ry * sin + nx * 2;
  p.y = head.y + ux * rx * sin + uy * ry * cos + ny * 2;
  // Save the contact before integrating the rest of the frame: the mark stays on
  // the crown instead of following the already-rebounding heart.
  p.contact = {x:p.x-nx*2,y:p.y-ny*2,nx,ny};
  const remainder = Math.min(dt * (1 - t), 0.018);
  p.x += p.vx * remainder;
  p.y += p.vy * remainder;
  return true;
}
