import { clamp } from "./smile.js";
import { loadCrayonSprites, loadCrayonHearts, loadCrayonStars, crayonHeartRadius } from "./crayon.js";
import { HeadTracker, HeartLimiter, mapHead, bounceOnHead } from "./fireworks-physics.js";

import { PalmTracker, mapPalm } from "./palm.js";
import { landStar, updateLandedStar, drawLandedStar } from "./star-landing.js";
import { moveSparkWithHand, updateHandVortex, swirlSpark } from "./hand-current.js";
import { RenderQuality } from "./render-quality.js";
import { SPARK_COLORS, PATTERN_PALETTES, makeInkSpark, faceSparkOpacity } from "./firework-ink.js";
import { FireworkAtmosphere } from "./firework-atmosphere.js";
import { CrayonWaterGround } from "./water-ground.js";
import { FireworkRainGate } from "./firework-rain-gate.js";
import { FireworkLayers } from "./firework-layers.js";

const random = (a, b) => a + Math.random() * (b - a);
const PATTERN_EXPLODE_AT = 1.05;
const EXPLOSION_RAMP = 0.07;
export function heartStretch(age) {
  const spring = Math.exp(-Math.max(0, age) * 11) * Math.cos(age * 23);
  return { x: 1 + spring * 0.15, y: 1 - spring * 0.13 };
}
export const PATTERN_NAMES = ["星河星球", "星环礼花", "心愿爱心", "星海鲸鱼"];

export function launchPosition(w, h, head, lane) {
  const crown = head
    ? head.y -
      Math.hypot(head.rx * Math.sin(head.angle || 0), head.ry * Math.cos(head.angle || 0)) -
      12
    : h * 0.58;
  if (crown < 32) return null;
  const ceiling = Math.min(crown, h * 0.62);
  const y = ceiling * random(0.48, 0.66);
  return { x: w * ([0.37, 0.5, 0.63][lane] + random(-0.025, 0.025)), y, headroom: crown - y };
}

export function fitPattern(points, w, h, target, angle, sizeScale) {
  const cos = Math.cos(angle),
    sin = Math.sin(angle);
  const xs = points.map((p) => p.x * cos - p.y * sin);
  const ys = points.map((p) => p.x * sin + p.y * cos);
  const left = Math.min(...xs),
    right = Math.max(...xs),
    top = Math.min(...ys),
    bottom = Math.max(...ys);
  const crown = target.y + target.headroom,
    margin = 9;
  const radius = Math.min(
    Math.min(w, h) * sizeScale,
    (w - margin * 2) / (right - left),
    (h - margin * 2) / (bottom - top),
    (crown - margin - 4) / (bottom - top),
  );
  return {
    radius,
    x: clamp(target.x, margin - left * radius, w - margin - right * radius),
    y: clamp(target.y, margin - top * radius, Math.min(crown - 4 - bottom * radius, h - margin - bottom * radius)),
  };
}

export function patternPoints(kind) {
  const points = [];
  const curve = (fn, n, color = 0, ink = 1) => {
    n = Math.max(3, Math.ceil(n * 0.62));
    for (let i = 0; i < n; i++) {
      if(ink<1 && i%13>9)continue;
      const t=(i+.16*Math.sin(i*2.4))/n,q=fn(t),next=fn(Math.min(1,t+.002));
      points.push({...q,color,ink,angle:Math.atan2(next.y-q.y,next.x-q.x)});
    }
  };
  const ellipse = (cx, cy, rx, ry, n, color = 0, tilt = 0, ink = 1) =>
    curve(
      (t) => {
        const a = t * Math.PI * 2,
          x = Math.cos(a) * rx,
          y = Math.sin(a) * ry;
        return {
          x: cx + x * Math.cos(tilt) - y * Math.sin(tilt),
          y: cy + x * Math.sin(tilt) + y * Math.cos(tilt),
        };
      },
      n,
      color,
      ink,
    );
  const line = (a, b, n, color = 0) =>
    curve((t) => ({ x: a[0] + (b[0] - a[0]) * t, y: a[1] + (b[1] - a[1]) * t }), n, color);
  const star = (cx, cy, r, color = 2) => {
    const vertices = Array.from({ length: 10 }, (_, i) => {
      const a = (i * Math.PI) / 5 - Math.PI / 2,
        R = i % 2 ? r * 0.42 : r;
      return [cx + Math.cos(a) * R, cy + Math.sin(a) * R];
    });
    vertices.forEach((p, i) => line(p, vertices[(i + 1) % 10], 5, color));
  };
  const bezier = (a, b, c, d, n, color = 0) =>
    curve(
      (t) => {
        const u = 1 - t;
        return {
          x: u * u * u * a[0] + 3 * u * u * t * b[0] + 3 * u * t * t * c[0] + t * t * t * d[0],
          y: u * u * u * a[1] + 3 * u * u * t * b[1] + 3 * u * t * t * c[1] + t * t * t * d[1],
        };
      },
      n,
      color,
    );
  if (kind === 0) {
    ellipse(0, -0.12, 0.62, 0.62, 115);
    for (const y of [-0.45, -0.23, 0, 0.23, 0.45]) {
      const rx = Math.sqrt(0.62 * 0.62 - y * y);
      ellipse(0, y - 0.12, rx, 0.055, Math.round(rx * 36), 1, 0, .62);
    }
    ellipse(0, -0.08, 0.99, 0.22, 125, 1, -0.35);
    star(-0.88, -0.62, 0.14);
    star(0.85, 0.57, 0.14);
    for (const sign of [-1, 1])
      curve(
        (t) => {
          const a = t * Math.PI * 4,
            r = 0.22 * (1 - t);
          return { x: sign * 0.63 + r * Math.cos(a), y: 0.75 + r * Math.sin(a) };
        },
        48,
        1,
      );
  } else if (kind === 1) {
    star(0, 0, 0.73, 0);
    ellipse(0, 0, 0.99, 0.99, 150, 1);
    for (let i = 0; i < 12; i++) {
      const a = (i * Math.PI) / 6;
      line(
        [Math.cos(a) * 0.8, Math.sin(a) * 0.8],
        [Math.cos(a) * 1.1, Math.sin(a) * 1.1],
        9,
        i % 3,
      );
    }
    star(-0.9, -0.8, 0.12);
    star(0.85, -0.78, 0.12);
  } else if (kind === 2) {
    for (const scale of [1, 0.82])
      curve(
        (t) => {
          const a = t * Math.PI * 2;
          return {
            x: Math.pow(Math.sin(a), 3) * 0.93 * scale,
            y:
              (-(13 * Math.cos(a) - 5 * Math.cos(2 * a) - 2 * Math.cos(3 * a) - Math.cos(4 * a)) /
                17) *
              scale,
          };
        },
        155,
        scale === 1 ? 0 : 1,
        scale === 1 ? 1 : .72,
      );
    star(-0.93, -0.53, 0.13);
    star(0.93, -0.53, 0.13);
    star(0, -1, 0.13);
    for (let i = 0; i < 9; i++) {
      const a = i * 2.4,
        r = 0.3 * Math.sqrt(i / 9);
      points.push({ x: Math.cos(a) * r, y: Math.sin(a) * r, color: 2, ink:.65 });
    }
  } else {
    bezier([-0.95, 0.04], [-0.7, -0.61], [0.1, -0.61], [0.45, -0.05], 95);
    bezier([0.45, -0.05], [0.57, -0.02], [0.78, -0.27], [0.94, -0.42], 36, 1);
    bezier([0.94, -0.42], [0.92, -0.05], [0.87, 0.04], [0.7, 0.1], 24, 1);
    bezier([0.7, 0.1], [0.92, 0.13], [0.99, 0.3], [1.02, 0.4], 25, 1);
    bezier([1.02, 0.4], [0.71, 0.44], [0.62, 0.26], [0.46, 0.2], 35, 1);
    bezier([0.46, 0.2], [0.08, 0.71], [-0.66, 0.6], [-0.95, 0.04], 95);
    bezier([-0.76, 0.14], [-0.47, 0.37], [-0.03, 0.41], [0.28, 0.3], 45, 1);
    bezier([-0.12, 0.32], [-0.24, 0.75], [0.14, 0.61], [0.22, 0.33], 35, 1);
    ellipse(-0.51, -0.08, 0.037, 0.037, 10, 2);
    bezier([-0.57, -0.4], [-0.78, -0.83], [-0.48, -0.87], [-0.43, -0.6], 22);
    bezier([-0.51, -0.43], [-0.38, -0.85], [-0.13, -0.78], [-0.18, -0.61], 22);
    star(0.57, -0.72, 0.18);
    star(-0.89, 0.69, 0.13);
  }
  // Scattered satellites keep the outlines feeling like fireworks, not solid drawings.
  for (let i = 0; i < 7; i++) {
    const a = i * 2.39996,
      r = 0.88 + (i % 5) * 0.057;
    points.push({ x: Math.cos(a) * r, y: Math.sin(a) * r, color: i % 3, ink:.58 });
  }
  return points;
}

export class Fireworks {
  constructor(canvas, video) {
    this.canvas = canvas;
    this.video = video;
    this.c = canvas.getContext("2d");
    this.headTracker = new HeadTracker();
    this.palmTracker = new PalmTracker();
    this.renderQuality = new RenderQuality();
    this.atmosphere = new FireworkAtmosphere(video);
    this.motifLayers = new FireworkLayers();
    this.waterGround = new CrayonWaterGround();
    this.handVortex = null;
    this.starThrows = 0;
    this.palmCatches = 0;
    this.waterLandings = 0;
    this.heartLimiter = new HeartLimiter();
    this.rockets = [];
    this.rainGate = new FireworkRainGate();
    this.particles = [];
    this.shockwaves = [];
    this.impacts = [];
    this.detonations = 0;
    this.launched = 0;
    this.bursts = 0;
    this.heartCollisions = 0;
    this.nextPattern = 0;
    this.launchLanes = [];
    this.patterns = Array.from({ length: 4 }, (_, i) => patternPoints(i));
    this.lastLaunch = -Infinity;
    this.time = 0;
    this.lastPattern = "";
    this.sprites = SPARK_COLORS.map((color) => this.makeSpark(color));
    this.brushSprites = SPARK_COLORS.map(color=>[1,2,3].map(variant=>makeInkSpark(color,variant)));
    this.heartSprites = ["#ffa6ce", "#e6a0ff", "#ffc8df"].map((color) => this.makeHeart(color));
    loadCrayonSprites()
      .then(({ hearts }) => {
        if (!this.softHeartsReady) this.heartSprites = hearts;
        this.crayonReady = true;
      })
      .catch(() => {
        this.crayonReady = false;
      });
    loadCrayonHearts().then(hearts=>{this.heartSprites=hearts;this.softHeartsReady=true;this.crayonReady=true;}).catch(()=>{});
    loadCrayonStars()
      .then((stars) => {
        this.starSprites = stars;
        this.crayonStarsReady = true;
      })
      .catch(() => {
        this.crayonStarsReady = false;
      });
    this.resize();
    this.observer = new ResizeObserver(() => this.resize());
    this.observer.observe(canvas);
  }
  resize() {
    const r = this.canvas.getBoundingClientRect(),
      oldW = this.w,
      oldH = this.h;
    this.w = Math.max(1, r.width);
    this.h = Math.max(1, r.height);
    const dpr = Math.min(devicePixelRatio || 1, [1.75, 1.35, 1][this.renderQuality?.level || 0]);
    this.canvas.width = Math.round(this.w * dpr);
    this.canvas.height = Math.round(this.h * dpr);
    this.c.setTransform(dpr, 0, 0, dpr, 0, 0);
    if (oldW && oldH) {
      for (const p of this.particles) {
        if (p.star === "water") {
          p.waterX *= this.w / oldW;
          p.waterY *= this.h / oldH;
        }
        p.x *= this.w / oldW;
        p.y *= this.h / oldH;
        p.vx *= this.w / oldW;
        p.vy *= this.h / oldH;
        p.scatterX *= this.w / oldW;
        p.scatterY *= this.h / oldH;
        p.originX *= this.w / oldW;
        p.originY *= this.h / oldH;
        p.targetX *= this.w / oldW;
        p.targetY *= this.h / oldH;
      }
      for (const wave of this.shockwaves) {
        wave.x *= this.w / oldW;
        wave.y *= this.h / oldH;
        wave.radius *= Math.min(this.w / oldW, this.h / oldH);
      }
      for (const hit of this.impacts) {
        hit.x *= this.w / oldW;
        hit.y *= this.h / oldH;
      }
      for (const r of this.rockets) {
        for (const key of ["x", "startX", "endX"]) r[key] *= this.w / oldW;
        for (const key of ["y", "endY"]) r[key] *= this.h / oldH;
        r.headroom *= this.h / oldH;
        r.radius *= Math.min(this.w / oldW, this.h / oldH);
        for (const p of r.trail) {
          p.x *= this.w / oldW;
          p.y *= this.h / oldH;
        }
      }
      this.resetTracking();
    }
  }
  makeSpark(color) {
    return makeInkSpark(color);
  }
  makeHeart(color) {
    const canvas = document.createElement("canvas");
    canvas.width = canvas.height = 48;
    const c = canvas.getContext("2d");
    c.translate(24, 24);
    c.beginPath();
    c.moveTo(0, 14);
    c.bezierCurveTo(-4, 9, -19, -1, -14, -10);
    c.bezierCurveTo(-9, -17, -1, -12, 0, -7);
    c.bezierCurveTo(1, -12, 9, -17, 14, -10);
    c.bezierCurveTo(19, -1, 4, 9, 0, 14);
    c.fillStyle = color;
    c.fill();
    return canvas;
  }
  resetTracking() {
    this.headTracker.reset();
    this.palmTracker?.reset();
    this.handVortex = null;
    this.atmosphere?.invalidate();
  }
  observeFrame(dt) {
    const previous = this.renderQuality.level,
      level = this.renderQuality.observe(dt);
    if (previous !== level) {
      const dpr = Math.min(devicePixelRatio || 1, [1.75, 1.35, 1][level]);
      this.canvas.width = Math.round(this.w * dpr);
      this.canvas.height = Math.round(this.h * dpr);
      this.c.setTransform(dpr, 0, 0, dpr, 0, 0);
    }
  }
  observeHand(points, time, mirror) {
    this.palmTracker.observe(
      mapPalm(
        points,
        this.video.videoWidth || 640,
        this.video.videoHeight || 480,
        this.w,
        this.h,
        mirror,
      ),
      time,
    );
  }
  observeHead(points, time, mirror) {
    this.headTracker.observe(
      mapHead(
        points,
        this.video.videoWidth || 640,
        this.video.videoHeight || 480,
        this.w,
        this.h,
        mirror,
      ),
      time,
    );
  }
  get particleLimit() {
    return this.w < 500 ? 1100 : 1400;
  }
  get activeFireworkCount() {
    return new Set([...this.rockets.map((r) => r.id), ...this.particles.map((p) => p.fireworkId)])
      .size;
  }
  launch(count = 1) {
    if (this.time - this.lastLaunch < 1.1 || this.rockets.length >= 2) return false;
    const fresh = this.particles.filter(
      (p) => !p.star && !p.heart && p.age < (p.releaseAt ?? PATTERN_EXPLODE_AT) + 1.4,
    ).length;
    if (this.activeFireworkCount >= 2 && fresh > this.particleLimit * 0.38) return false;
    const slots = 3 - this.activeFireworkCount;
    let reserved = this.rockets.reduce((sum, rocket) => sum + this.patterns[rocket.kind].length, 0);
    let added = 0;
    for (let n = 0; n < Math.min(2, count, slots) && this.rockets.length < 2; n++) {
      const required = this.patterns[this.nextPattern % 4].length;
      if (this.particles.length + reserved + required > this.particleLimit) break;
      if (!this.launchLanes.length) {
        this.launchLanes = [0, 1, 2];
        for (let i = 2; i > 0; i--) {
          const j = Math.floor(Math.random() * (i + 1));
          [this.launchLanes[i], this.launchLanes[j]] = [this.launchLanes[j], this.launchLanes[i]];
        }
        if (this.launchLanes[2] === this.lastLane)
          [this.launchLanes[0], this.launchLanes[2]] = [this.launchLanes[2], this.launchLanes[0]];
      }
      const lane = this.launchLanes[this.launchLanes.length - 1];
      const target = launchPosition(this.w, this.h, this.headTracker.head, lane);
      if (!target) break;
      this.launchLanes.pop();
      this.lastLane = lane;
      const kind = this.nextPattern++ % 4;
      const sizeScale = [0.245, 0.13, 0.17][this.launched % 3];
      const angle = random(0.18, 0.55) * (Math.random() < 0.5 ? -1 : 1);
      let layout = fitPattern(this.patterns[kind], this.w, this.h, target, angle, sizeScale);
      if (this.rockets.length) {
        const separation = (p) =>
          Math.min(
            ...this.rockets.map(
              (r) => Math.hypot(p.x - r.endX, p.y - r.endY) / (p.radius + r.radius),
            ),
          );
        for (const side of [0.34, 0.66]) {
          const candidate = fitPattern(
            this.patterns[kind],
            this.w,
            this.h,
            { ...target, x: this.w * side },
            angle,
            sizeScale,
          );
          if (separation(candidate) > separation(layout)) layout = candidate;
        }
      }
      const { x, y, radius } = layout;
      this.rockets.push({
        id: this.launched,
        sizeScale,
        angle,
        radius,
        x: this.w * random(0.2, 0.8),
        y: this.h * 1.03,
        startX: this.w * random(0.2, 0.8),
        endX: x,
        endY: y,
        headroom: target.headroom + target.y - y,
        age: -n * 0.9,
        duration: 1.15,
        kind,
        trail: [],
      });
      this.launched++;
      this.lastPattern = PATTERN_NAMES[kind];
      reserved += required;
      added++;
    }
    if (added) this.lastLaunch = this.time;
    return added > 0;
  }
  burst(rocket) {
    const beforeCount = this.particles.length;
    const points = this.patterns[rocket.kind],
      radius =
        rocket.radius ??
        Math.min(
          this.w * 0.48,
          this.h * 0.36,
          rocket.x * 0.8,
          (this.w - rocket.x) * 0.8,
          rocket.y * 0.8,
        );
    this.shockwaves.push({ x: rocket.x, y: rocket.y, radius, age: -PATTERN_EXPLODE_AT });
    this.atmosphere?.add(rocket.x,rocket.y,radius,rocket.kind,this.w,this.h);
    this.motifLayers?.add(rocket.x,rocket.y,radius,rocket.kind,rocket.angle||0,this.w,this.h);
    const limit = this.particleLimit;
    const cos = Math.cos(rocket.angle || 0),
      sin = Math.sin(rocket.angle || 0);
    for (let i = 0; i < points.length && this.particles.length < limit; i++) {
      const q = points[i];
      const secondary = i % 5 === 0;
      // Keep the full outline, but only two in five sparks enter the falling field.
      const falling = i % 5 < 2;
      const sizeBand = (Math.floor(i / 5) * 2 + i % 5) % 10;
      const [small, large] = sizeBand < 5 ? [1.6, 2.3] : sizeBand < 9 ? [3.3, 4.1] : [5.6, 6.6];
      const formationRadius = random(2.9, 3.9) * (this.w < 500 ? .9 : 1) * ((q.ink ?? 1) >= .95 ? 1.12 : .88);
      const releaseAt = PATTERN_EXPLODE_AT + (secondary ? .18 : 0);
      const qx = q.x * cos - q.y * sin,
        qy = q.x * sin + q.y * cos;
      const direction = Math.atan2(qy, qx) + random(-0.14, 0.14),
        speed = random(130, 220) * (this.w < 500 ? 0.78 : 1) * (secondary ? 1.12 : 1);
      this.particles.push({
        fireworkId: rocket.id,
        x: rocket.x,
        y: rocket.y,
        originX: rocket.x,
        originY: rocket.y,
        targetX: rocket.x + qx * radius,
        targetY: rocket.y + qy * radius,
        vx: 0,
        vy: 0,
        age: 0,
        life: falling ? random(6.2, 7.2) : releaseAt + .45,
        radius: formationRadius,
        formationRadius,
        fallRadius: random(small, large) * (this.w < 500 ? .9 : 1),
        falling,
        color: PATTERN_PALETTES[rocket.kind][q.color],
        ink: (q.ink ?? 1) * random(.88,1),
        brush: i%4===0 ? i%3 : -1,
        inkAngle: (q.angle??0)+(rocket.angle||0),
        primary: i%3===0,
        heart: false,
        headContacted: false,
        released: false,
        releaseAt,
        secondary,
        scatterX: Math.cos(direction) * speed,
        scatterY: Math.sin(direction) * speed - 18,
        gravity: random(155, 205),
        sparkle: Math.random() < 0.015,
        phase: random(0, 6.28),
        lastHit: -Infinity,
      });
    }
    (this.rainGate ??= new FireworkRainGate()).begin(rocket.id, this.particles.slice(beforeCount).filter(p=>p.falling).length);
    this.bursts++;
  }
  update(dt, time) {
    this.time += dt;
    this.decorativeOpacity = (this.decorativeOpacity ?? 1) + ((this.returningToRain ? .45 : 1) - (this.decorativeOpacity ?? 1)) * (1-Math.exp(-dt*4));
    this.atmosphere?.update(dt);
    this.motifLayers?.update(dt);
    this.waterGround?.update(dt);
    const head = this.headTracker.update(dt, time);
    const palm = this.palmTracker?.update(dt, time);
    this.handVortex = updateHandVortex(this.handVortex, palm, dt);
    const starCounts = { palm: 0, water: 0, waterSites: [], waterIndex: this.waterLandings || 0 };
    for (const p of this.particles)
      if ((p.star === "palm" || p.star === "water") && p.age < p.life) {
        starCounts[p.star]++;
        if (p.star === "water") starCounts.waterSites.push({ x: p.x, size: p.starSize });
      }
    for (const r of this.rockets) {
      r.age += dt;
      if (r.age < 0) continue;
      const t = clamp(r.age / r.duration),
        e = 1 - Math.pow(1 - t, 1.7);
      r.x = r.startX + (r.endX - r.startX) * e;
      r.y = this.h * 1.03 + (r.endY - this.h * 1.03) * e;
      r.trail.unshift({ x: r.x, y: r.y });
      if (r.trail.length > 15) r.trail.pop();
      if (t >= 1 && !r.done) {
        r.done = true;
        this.burst(r);
      }
    }
    this.rockets = this.rockets.filter((r) => !r.done);
    for (const wave of this.shockwaves) {
      const before = wave.age;
      wave.age += dt;
      if (before < 0 && wave.age >= 0) this.detonations++;
    }
    this.shockwaves = this.shockwaves.filter((wave) => wave.age < 0.42);
    for (const hit of this.impacts || []) hit.age += dt;
    this.impacts = (this.impacts || []).filter((hit) => hit.age < 0.26);
    let activeHearts = this.particles.filter((p) => p.heart && p.age < p.life).length;
    for (const p of this.particles) {
      const previous = { x: p.x, y: p.y };
      const oldAge = p.age;
      p.age += dt;
      if (p.star) {
        const before = p.star;
        updateLandedStar(p, palm, this.palmTracker?.generation, dt, this.w, this.h, starCounts);
        if (before === "palm" && p.star === "tossed") this.starThrows = (this.starThrows || 0) + 1;
        if (before === "tossed" && p.star === "water") {
          this.waterLandings = (this.waterLandings || 0) + 1;
          this.waterGround?.impact();
        }
        continue;
      }
      if (p.heart) p.impactAge = (p.impactAge ?? 1) + dt;
      const releaseAt = p.releaseAt ?? PATTERN_EXPLODE_AT;
      const forming = !p.heart && p.age < releaseAt;
      if (forming) {
        const t = clamp(p.age / 0.8),
          ease = 1 - Math.pow(1 - t, 3);
        p.x = p.originX + (p.targetX - p.originX) * ease;
        p.y = p.originY + (p.targetY - p.originY) * ease;
        continue;
      }
      if (!forming && !p.heart && !p.released) {
        p.released = true;
        p.x = p.targetX;
        p.y = p.targetY;
        previous.x = p.x;
        previous.y = p.y;
      }
      const step = p.heart ? dt : Math.min(dt, Math.max(0, p.age - releaseAt));
      if (!p.heart && p.fallRadius != null && p.falling) {
        const t = clamp((p.age - releaseAt) / .35), ease = t*t*(3-2*t);
        p.radius = p.formationRadius + (p.fallRadius-p.formationRadius)*ease;
      }
      const drag = p.heart ? 0.7 : 0.65,
        decay = Math.exp(-drag * step),
        gravity = p.heart ? 120 : p.gravity;
      const travel = (1 - decay) / drag;
      p.x += p.vx * travel;
      p.y += p.vy * travel + (gravity / drag) * (step - travel);
      p.vx *= decay;
      p.vy = p.vy * decay + gravity * travel;
      // Integrate the brief explosion acceleration exactly, so 30/60/120 Hz agree.
      if (!p.heart && !p.headContacted && oldAge < releaseAt + 1) {
        const age = Math.max(0, oldAge - releaseAt);
        const ramp = Math.exp(-age / EXPLOSION_RAMP) / (1 - drag * EXPLOSION_RAMP);
        const rampDecay = Math.exp(-step / EXPLOSION_RAMP);
        const impulseTravel = ramp * (travel - EXPLOSION_RAMP * (1 - rampDecay));
        const impulseSpeed = ramp * (decay - rampDecay);
        p.x += p.scatterX * impulseTravel;
        p.y += p.scatterY * impulseTravel;
        p.vx += p.scatterX * impulseSpeed;
        p.vy += p.scatterY * impulseSpeed;
      }
      // Brief outline dust dissolves in place of becoming catchable falling sparks.
      if (p.falling === false && !p.heart) continue;
      if (moveSparkWithHand(p, palm, step, this.w, this.h))
        this.handInfluences = (this.handInfluences || 0) + 1;
      if (swirlSpark(p, this.handVortex, step))
        this.vortexInfluences = (this.vortexInfluences || 0) + 1;
      const wasHeart=p.heart;
      if (landStar(p, previous, palm, this.palmTracker?.generation, this.w, this.h, starCounts, this.phonePreview)) {
        if(wasHeart)activeHearts--;
        if (p.star === "palm") {
          this.palmCatches = (this.palmCatches || 0) + 1;
        } else {
          this.waterLandings = (this.waterLandings || 0) + 1;
          this.waterGround?.impact();
        }
        continue;
      }
      if (
        (p.released || p.heart) &&
        this.time - p.lastHit > 0.16 &&
        bounceOnHead(p, previous, head, step)
      ) {
        p.lastHit = this.time;
        if (p.heart) p.impactAge = 0;
        if (!p.heart && !p.headContacted) {
          p.headContacted = true;
          if (this.heartLimiter.allow(this.time, activeHearts)) {
            p.heart = true;
            p.age = 0;
            p.life = random(7, 8);
            p.radius = crayonHeartRadius(this.heartCollisions);
            p.heartVariant = this.heartCollisions % 4;
            p.tilt = random(0.1, 0.38) * (Math.random() < 0.5 ? -1 : 1);
            p.impactAge = 0;
            // Fan close rebounds apart with a tangential impulse, without moving
            // their contact points or creating hearts that never touched the crown.
            const contact=p.contact;
            const nearby=this.particles.find(q=>q!==p&&q.heart&&q.age<q.life&&Math.hypot(q.x-p.x,q.y-p.y)<(q.radius+p.radius)*2.2);
            if(nearby&&contact){
              const sign=p.x===nearby.x?(this.heartCollisions%2?1:-1):Math.sign(p.x-nearby.x);
              p.vx+=-contact.ny*sign*48;p.vy+=contact.nx*sign*48;
            }
            this.impacts.push({ ...(contact||{x:p.x,y:p.y,nx:0,ny:-1}), age: 0 });
            if (this.impacts.length > 8) this.impacts.shift();
            this.heartCollisions++;
            activeHearts++;
          }
        }
      }
    }
    this.particles = this.particles.filter(
      (p) => p.age < p.life && p.y < this.h + 45 && p.x > -100 && p.x < this.w + 100,
    );
    this.rainGate?.update(this.particles);
  }
  get rainBlocked() {
    return this.rockets.length > 0 || !!this.rainGate?.blocked;
  }
  draw() {
    const c = this.c;
    const quality = this.reducedMotion ? 2 : this.renderQuality?.level || 0;
    const head=this.headTracker.head;
    const face=head?{...head,cos:Math.cos(head.angle||0),sin:Math.sin(head.angle||0)}:null;
    c.clearRect(0, 0, this.w, this.h);
    this.atmosphere?.draw(c,this.w,this.h,head,quality,(this.decorativeOpacity??1)*(this.reducedMotion ? .35 : .8));
    this.waterGround?.draw(c,this.w,this.h);
    this.motifLayers?.draw(c,this.w,this.h,this.decorativeOpacity??1);
    c.save();
    c.globalCompositeOperation = "source-over";
    for (const wave of this.reducedMotion ? [] : this.shockwaves) {
      if (wave.age < 0) continue;
      const t = wave.age / 0.42,
        r = wave.radius * (0.22 + t * 1.05);
      c.globalAlpha = (1 - t) * 0.28;
      c.strokeStyle = "#c8b5e9";
      c.lineWidth = 1.5 * (1 - t) + 0.3;
      c.beginPath();
      c.arc(wave.x, wave.y, r, .2, Math.PI*.9);
      c.moveTo(wave.x+Math.cos(3.6)*r,wave.y+Math.sin(3.6)*r);
      c.arc(wave.x, wave.y, r, 3.6, 5.9);
      c.stroke();
      c.globalAlpha = Math.max(0, 1 - wave.age / 0.16) * 0.65;
      const size = wave.radius * 0.8;
      c.drawImage(this.sprites[0], wave.x - size / 2, wave.y - size / 2, size, size);
    }
    for (const r of this.rockets) {
      if (r.age < 0) continue;
      for (let i = Math.min(r.trail.length, quality >= 2 ? 3 : quality ? 8 : 15) - 1; i >= 0; i--) {
        const p = r.trail[i];
        c.globalAlpha = (1 - i / r.trail.length) * 0.6;
        c.drawImage(this.sprites[2], p.x - 5, p.y - 5, 10, 10);
      }
      c.globalAlpha = 1;
      c.drawImage(this.sprites[0], r.x - 10, r.y - 10, 20, 20);
    }
    // Batch explosion streaks by color instead of issuing one stroke per spark.
    for (let color = 0; color < (quality >= 2 ? 0 : SPARK_COLORS.length); color++) {
      c.beginPath();
      c.strokeStyle = SPARK_COLORS[color];
      c.lineWidth = 1.1;c.lineCap='round';
      c.globalAlpha = 0.19 * (this.decorativeOpacity ?? 1);
      for (const p of this.particles) {
        if (p.star || p.heart || !p.released || p.color !== color || (quality && p.secondary))
          continue;
        if(faceSparkOpacity(p,face)<.65)continue;
        const trail = 0.035 * (1 - clamp((p.age - (p.releaseAt ?? PATTERN_EXPLODE_AT)) / 0.5));
        if (trail <= 0) continue;
        c.moveTo(p.x - p.vx * trail, p.y - p.vy * trail);
        c.lineTo(p.x, p.y);
      }
      c.stroke();
    }
    for (const p of this.particles) {
      if (p.star) {
        drawLandedStar(c, p, this.starSprites, this.heartSprites, quality);
        continue;
      }
      const dustAge = clamp((p.age - (p.releaseAt ?? PATTERN_EXPLODE_AT)) / .45);
      const fade = p.falling === false && !p.heart
        ? 1 - dustAge*dustAge*(3-2*dustAge)
        : clamp((p.life - p.age) / 1.35),
        light = this.reducedMotion ? .88 : 0.9 + 0.1 * Math.sin(p.phase + p.age * 2.4);
      c.globalAlpha = fade * light;
      if (p.heart) {
        c.globalCompositeOperation = "source-over";
        const size = p.radius * 3;
        c.save();
        c.translate(p.x, p.y);
        c.rotate((p.tilt || 0) + Math.sin(p.age * 2.1 + p.phase) * 0.14);
        const stretch = heartStretch(p.impactAge ?? 1);
        c.scale(stretch.x, stretch.y);
        c.drawImage(
          this.heartSprites[(p.heartVariant ?? p.color) % this.heartSprites.length],
          -size / 2,
          -size / 2,
          size,
          size,
        );
        c.restore();
        c.globalCompositeOperation = "source-over";
      } else {
        const accent =
          p.secondary && p.released ? Math.exp(-Math.max(0, p.age - p.releaseAt) * 3) : 0;
        const releasedAge=Math.max(0,p.age-(p.releaseAt??PATTERN_EXPLODE_AT));
        const retreat=p.released&&!p.primary?1-.48*clamp(releasedAge/1.4):1;
        const size = p.radius * 6 * (1 + accent * 0.15) * (p.released && !p.primary ? .86 : 1);
        const hierarchy = p.primary ? .94 : (p.released ? .7 : .53);
        c.globalAlpha*= hierarchy*(p.ink??1)*retreat*faceSparkOpacity(p,face)*(this.decorativeOpacity??1);
        if(p.brush>=0&&this.brushSprites){
          c.save();c.translate(p.x,p.y);
          c.rotate(p.released?Math.atan2(p.vy,p.vx):p.inkAngle);
          c.drawImage(this.brushSprites[p.color][p.brush],-size/2,-size/2,size,size);c.restore();
        }else c.drawImage(this.sprites[p.color], p.x - size / 2, p.y - size / 2, size, size);
        if (p.sparkle && !quality) {
          c.globalAlpha*=.6;
          c.strokeStyle = SPARK_COLORS[p.color];
          c.lineWidth = 0.9;
          c.beginPath();
          c.moveTo(p.x - p.radius * 2.6, p.y);
          c.lineTo(p.x + p.radius * 2.6, p.y);
          c.moveTo(p.x, p.y - p.radius * 2.6);
          c.lineTo(p.x, p.y + p.radius * 2.6);
          c.stroke();
        }
      }
    }
    // Contact feedback stays in front of decorative particles.
    for (const hit of this.impacts) {
      const t = hit.age / 0.26, radius=5+13*t;
      c.save();c.translate(hit.x,hit.y);c.rotate(Math.atan2(hit.ny,hit.nx)+Math.PI/2);
      c.globalAlpha=(1-t)*.85;c.lineCap='round';c.lineWidth=1.6;c.strokeStyle='#f7d9c4';
      c.beginPath();c.ellipse(0,0,radius,radius*.3,0,.2,2.8);
      c.moveTo(-radius*.94,-radius*.1);c.ellipse(0,0,radius,radius*.3,0,3.5,5.9);c.stroke();
      // Three short, drawn rays point away from the contact surface.
      c.globalAlpha=(1-t)*(1-t)*.8;c.strokeStyle='#e4a6b4';c.lineWidth=1.25;c.beginPath();
      for(const angle of [-.6,0,.6]){
        const x=Math.sin(angle),y=-Math.cos(angle),start=4+t*9;
        c.moveTo(x*start,y*start);c.lineTo(x*(start+4),y*(start+4));
      }c.stroke();c.restore();
    }
    c.restore();
  }
  clear() {
    this.rainGate?.clear();
    this.atmosphere?.clear();
    this.motifLayers?.clear();
    this.waterGround?.clear();
    this.heartLimiter.reset();
    this.shockwaves = [];
    this.impacts = [];
    this.rockets = [];
    this.particles = [];
    this.resetTracking();
    this.c.clearRect(0, 0, this.w, this.h);
  }
  get active() {
    return this.rockets.length > 0 || this.particles.length > 0;
  }
  stats() {
    return {
      fireworkRockets: this.rockets.length,
      crayonHeartsReady: !!this.crayonReady,
      crayonStarsReady: !!this.crayonStarsReady,
      palmTracked: !!this.palmTracker?.palm,
      handInfluences: this.handInfluences || 0,
      vortexInfluences: this.vortexInfluences || 0,
      vortexActive: !!this.handVortex,
      starThrows: this.starThrows || 0,
      tossedStars: this.particles.filter((p) => p.star === "tossed").length,
      renderQuality: this.renderQuality?.level || 0,
      atmosphereBlooms: this.atmosphere?.events.length || 0,
      waterGroundOpacity: this.waterGround?.opacity || 0,
      palmStars: this.particles.filter((p) => p.star === "palm").length,
      waterStars: this.particles.filter((p) => p.star === "water").length,
      palmCatches: this.palmCatches || 0,
      waterLandings: this.waterLandings || 0,
      activeFireworks: this.activeFireworkCount,
      rainBlocked: this.rainBlocked,
      fireworkLandingProgress: this.rockets.length ? 0 : (this.rainGate?.progress ?? 1),
      fireworkParticles: this.particles.length,
      fireworksLaunched: this.launched,
      fireworksBurst: this.bursts,
      fireworkFormations: this.shockwaves.filter((wave) => wave.age < 0).length,
      fireworkDetonations: this.detonations,
      heartSizeRange: this.particles.some((p) => p.heart)
        ? [
            Math.min(...this.particles.filter((p) => p.heart).map((p) => p.radius * 3)),
            Math.max(...this.particles.filter((p) => p.heart).map((p) => p.radius * 3)),
          ]
        : [],
      fireworkPattern: this.lastPattern,
      headTracked: !!this.headTracker.head,
      heartParticles: this.particles.filter((p) => p.heart).length,
      heartCollisions: this.heartCollisions,
    };
  }
}
