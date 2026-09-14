import {artwork} from './artwork.js';
import { clamp } from "./smile.js";
import { sweptInfluence, stepSway } from "./plant-motion.js";
import { GardenLifetime } from "./garden-lifetime.js";
import { loadCrayonSprites } from "./crayon.js";
import { plantGrowth } from "./plant-growth.js";
const rnd = (a, b) => a + Math.random() * (b - a),
  ease = (t) => 1 - Math.pow(1 - clamp(t), 3);
const GRASS_READY = 0.3;
export class GardenScene {
  constructor(canvas, onCount = () => {}, plantCanvas = canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext("2d", { alpha: true });
    this.onCount = onCount;
    this.plantCanvas = plantCanvas;
    this.plantCtx = plantCanvas.getContext("2d", { alpha: true });
    this.drops = [];
    this.ripples = [];
    this.splashes = [];
    this.plants = [];
    this.brushHits = 0;
    this.water = [];
    this.grassLevel = 0;
    this.lifetime = new GardenLifetime();
    this.seedDelay = 0;
    this.bloomClock = 0;
    this.grass = document.createElement("canvas");
    this.density = 10;
    this.dropSerial = 0;
    this.trail = 0.55;
    this.grow = true;
    this.wind = 0;
    this.rain = 0;
    this.rainWasActive = false;
    this.credit = 0;
    this.time = 0;
    loadCrayonSprites()
      .then((sprites) => {
        this.crayonSprites = sprites;
      })
      .catch(() => {
        this.assetError = true;
      });
    this.w = 1;
    this.h = 1;
    this.atlas = artwork.get('./assets/plants-crayon.webp').image;
    this.extraAtlas = artwork.get('./assets/plants-crayon-extra.webp').image;
    this.rects = [
      [42, 143, 335, 269],
      [450, 65, 262, 348],
      [797, 56, 317, 357],
      [1204, 57, 278, 355],
      [60, 435, 327, 538],
      [458, 445, 282, 527],
      [809, 447, 308, 526],
      [1199, 454, 302, 519],
      [67, 121, 280, 261],
      [466, 13, 256, 403],
      [821, 39, 281, 387],
      [1187, 21, 307, 427],
      [45, 524, 346, 419],
      [502, 518, 202, 418],
      [802, 522, 319, 425],
      [1190, 517, 334, 449],
    ];
    this.heightRanges = [
      [0.065, 0.095],
      [0.11, 0.145],
      [0.18, 0.23],
      [0.21, 0.26],
      [0.28, 0.332],
      [0.255, 0.306],
      [0.17, 0.22],
      [0.272, 0.323],
      [0.065, 0.095],
      [0.11, 0.145],
      [0.19, 0.24],
      [0.18, 0.23],
      [0.289, 0.34],
      [0.255, 0.315],
      [0.19, 0.24],
      [0.28, 0.332],
    ];
    this.plantSequence = plantSequence();
    this.nextPlant = 0;
    this.resize();
    this.observer = new ResizeObserver(() => this.resize());
    this.observer.observe(canvas);
  }
  resize() {
    const r = this.canvas.getBoundingClientRect(),
      dpr = Math.min(devicePixelRatio || 1, [1.75, 1.35, 1][this.qualityLevel || 0]);
    this.visibleCache = null;
    this.w = r.width;
    this.h = r.height;
    this.canvas.width = Math.round(this.w * dpr);
    this.canvas.height = Math.round(this.h * dpr);
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    if (this.plantCanvas !== this.canvas) {
      this.plantCanvas.width = this.canvas.width;
      this.plantCanvas.height = this.canvas.height;
      this.plantCtx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }
    this.paintGrass();
  }
  setQuality(level) {
    if ((this.qualityLevel || 0) === level) return;
    this.qualityLevel = level;
    this.resize();
  }
  clear(resetLifetime = true) {
    if (resetLifetime) this.lifetime.reset();
    this.brushHits = 0;
    this.drops = [];
    this.ripples = [];
    this.splashes = [];
    this.plants = [];
    this.water = [];
    this.grassLevel = 0;
    this.seedDelay = 0;
    this.bloomClock = 0;
    this.credit = 0;
    this.rain = 0;
    this.rainWasActive = false;
    this.nextPlant = 0;
    this.onCount(0);
    this.plantSequence = plantSequence();
  }
  update(dt, active, wind, strength = 0.6, smiling = active, elapsed = dt, rainSuppressed = false) {
    // Advance the garden by visible elapsed time, even on a 10–15 FPS device.
    // Small steps keep rain/palm collisions and spring motion stable. Long
    // background gaps are bounded instead of spawning a backlog of flowers.
    const duration = clamp(elapsed, 0, 0.5);
    const steps = Math.max(1, Math.ceil(duration / 0.05));
    for (let i = 0; i < steps; i++)
      this.step(duration / steps, active, wind, strength, smiling, rainSuppressed);
  }
  step(dt, active, wind, strength, smiling, rainSuppressed) {
    this.rainSuppressed = rainSuppressed;
    if (rainSuppressed) {
      this.drops.length = 0;
      this.ripples.length = 0;
      this.splashes.length = 0;
      this.credit = 0;
      this.rain = 0;
      active = false;
    }
    const ended = this.lifetime.update(
      dt,
      smiling,
      this.grassLevel > 0 || this.drops.length > 0,
      rainSuppressed,
    );
    if (ended) this.clear(false);
    const opacity = String(this.lifetime.opacity);
    if (this.canvas.style.opacity !== opacity) this.canvas.style.opacity = opacity;
    if (this.plantCanvas.style.opacity !== opacity) this.plantCanvas.style.opacity = opacity;
    if (ended) return;
    // Immediate, small visual acknowledgement. Steady rain keeps its existing
    // density; brief expression jitter cannot repeatedly add starter drops.
    if (active && !this.rainWasActive && this.drops.length === 0 && this.density > 0) {
      for (let i = 0; i < 2; i++) this.spawn(true);
    }
    this.rainWasActive = active;
    this.time += dt;
    this.wind += (wind - this.wind) * (1 - Math.exp(-dt * 3));
    this.rain += ((active ? 1 : 0) - this.rain) * (1 - Math.exp(-dt * (active ? 3.5 : 2.5)));
    if (this.rain > 0.08) this.grassLevel = Math.min(1, this.grassLevel + dt / 4.5);
    if (!this.grow) this.water = [];
    if (!rainSuppressed && this.grassLevel >= GRASS_READY && this.water.length) {
      this.seedDelay -= dt;
      if (this.seedDelay <= 0) {
        const seed = this.water.shift();
        this.waterSeed(seed.x, seed.y);
        this.seedDelay = rnd(0.16, 0.34);
      }
    }
    this.credit += dt * this.density * (this.phonePreview ? .62 : 1) * this.rain * (0.65 + strength * 0.65);
    while (this.credit >= 1) {
      this.credit--;
      this.spawn();
    }
    const scale = Math.max(0.65, Math.min(1.4, this.h / 650));
    for (const d of this.drops) {
      const previous = { x: d.x * this.w, y: d.y * this.h };
      d.age += dt;
      d.vy += 130 * scale * dt;
      d.vx += (this.wind * 130 - d.vx) * dt * 2;
      d.x += (d.vx * dt) / this.w;
      d.y += (d.vy * dt) / this.h;
      if (!d.dead && this.catchRain?.(d, previous)) {
        d.dead = true;
        continue;
      }
      if (d.y >= d.floor && !d.dead) {
        d.dead = true;
        this.impact(clamp(d.x, 0.015, 0.985), d.floor, d.size);
      }
    }
    this.drops = this.drops.filter((d) => !d.dead && d.age < 8 && d.x > -0.2 && d.x < 1.2);
    for (const r of this.ripples) {
      r.age += dt;
      if (!r.planted && r.age > 0.3) {
        r.planted = true;
        if (this.grow) this.waterSeed(r.x, r.y);
      }
    }
    this.ripples = this.ripples.filter((r) => r.age < r.life);
    for (const s of this.splashes) {
      s.age += dt;
      s.x += (s.vx * dt) / this.w;
      s.y += (s.vy * dt) / this.h;
      s.vy += 500 * dt;
    }
    this.splashes = this.splashes.filter((s) => s.age < s.life);
    for (const p of this.plants) {
      stepSway(p, dt);
      p.age += dt;
      if (p.retiringAge != null) p.retiringAge += dt;
      p.growth += (p.target - p.growth) * (1 - Math.exp(-dt * 0.9));
    }
    if (this.plants.some(p => this.time - p.watered >= 100 || p.retiringAge >= 2.4))
      this.plants = this.plants.filter((p) => this.time - p.watered < 100 && !(p.retiringAge >= 2.4));
    this.renewFlowers(dt, active && smiling && !rainSuppressed);
    if (this.lastCount !== this.plants.length) {
      this.lastCount = this.plants.length;
      this.onCount(this.plants.length);
    }
  }
  spawn(starter = false) {
    if (this.drops.length >= 130) return;
    this.drops.push({
      x: rnd(0.03, 0.97),
      y: starter ? rnd(0.035, 0.065) : rnd(-0.2, -0.03),
      floor: rnd(0.89, 0.99),
      size: rnd(4.8, 8.2) * (this.phonePreview ? .8 : 1),
      trailScale: rnd(
        ...[
          [0.34, 0.55],
          [0.72, 0.95],
          [1.25, 1.65],
        ][this.dropSerial++ % 3],
      ),
      vy: rnd(125, 210),
      vx: this.wind * 100,
      age: 0,
      hollow: Math.random() < 0.46,
      white: Math.random() < 0.12,
      seed: rnd(0, 8),
    });
  }
  impact(x, y, size) {
    if (this.ripples.length < 75)
      this.ripples.push({
        x,
        y,
        age: 0,
        life: rnd(1.4, 2.3),
        radius: rnd(25, 48),
        seed: rnd(0, 6),
        planted: false,
      });
    for (let i = 0; i < 5; i++) {
      const angle = rnd(-Math.PI * 0.9, -Math.PI * 0.1),
        v = rnd(45, 105);
      this.splashes.push({
        x,
        y,
        vx: Math.cos(angle) * v,
        vy: Math.sin(angle) * v,
        age: 0,
        life: rnd(0.3, 0.65),
        size: size * 0.3,
      });
    }
  }
  waterSeed(x, y) {
    if (!this.grow) return;
    // The first watered flower can emerge as soon as the ground is visible;
    // the remaining green wash continues to build behind it.
    if (this.grassLevel < GRASS_READY) {
      if (this.water.length < 36 && !this.water.some((p) => Math.abs(p.x - x) * this.w < 27))
        this.water.push({ x, y });
      return;
    }
    x = clamp(x, 0.045, 0.955);
    const nearest = !this.phonePreview && this.plants.find((p) => Math.abs(p.x - x) * this.w < (this.w < 500 ? 27 : 35));
    if (nearest) {
      nearest.target = Math.min(1.08, nearest.target + 0.12);
      nearest.watered = this.time;
      return;
    }
    const limit = this.phonePreview ? 10 : Math.min(36, Math.max(12, Math.floor(this.w / 32)));
    if (this.plants.length >= limit) {
      if (this.phonePreview) {
        const watered = this.plants.reduce((a,b) => Math.abs(a.x-x)<Math.abs(b.x-x)?a:b);
        watered.watered = this.time;
      }
      return;
    }
    let type = this.plantSequence[this.nextPlant++ % this.plantSequence.length];
    // Make the first response a recognizable medium flower, including in the
    // center, instead of randomly choosing a tiny grass sprout.
    const firstFlower = this.plants.length === 0;
    if (firstFlower) type = !this.atlas?.naturalWidth && this.extraAtlas?.naturalWidth ? 10 : 2;
    // Low flowers leave the middle open for the host; tall plants frame the sides.
    if(x>.32 && x<.68 && this.heightRanges[type][1]>.3)
      type=[0,8,1,9,2,6][(this.nextPlant-1)%6];
    let height = rnd(...this.heightRanges[type]) * 0.88, depth;
    if (this.phonePreview) {
      const placement = this.phonePlantPlacement(type, x);
      if (!placement) {
        for (const p of this.plants) if (Math.abs(p.x-x)<.2) p.watered=this.time;
        return;
      }
      ({x, type, height, depth} = placement);
    }
    const target = rnd(0.75, 1);
    this.plants.push({
      x: clamp(x, 0.045, 0.955),
      y: Math.max(0.98, y),
      type,
      height,
      depth,
      opacity: (firstFlower ? rnd(0.8, 0.9) : rnd(
        ...[
          [0.46, 0.58],
          [0.7, 0.82],
          [0.94, 1],
        ][(this.nextPlant - 1) % 3],
      )) * (x>.32 && x<.68 ? .9 : 1),
      growth: target,
      bend: 0,
      bendVelocity: 0,
      target,
      growDuration: this.plants.length === 0 ? rnd(1.45, 1.85) : rnd(2.1, 3.1),
      growDelay: this.plants.length === 0 ? 0 : rnd(0, 0.18),
      age: 0,
      seed: rnd(0, 8),
      watered: this.time,
      flip: Math.random() < 0.5 ? -1 : 1,
    });
    this.plants.sort((a, b) => a.opacity - b.opacity || b.height - a.height);
  }
  renewFlowers(dt, active) {
    // Real ground rain must establish the garden first. Then sustained smiles
    // renew it even when subsequent drops are caught by the hand.
    if (!active || !this.grow || !this.plants.length || this.grassLevel < GRASS_READY) {
      this.bloomClock = 0;
      return;
    }
    this.bloomClock = (this.bloomClock || 0) + dt;
    if (this.bloomClock < 3.2 || this.plants.some(p => p.retiringAge != null)) return;
    this.bloomClock = 0;
    // Try the largest horizontal gap; phone placement also balances depth/regions.
    const xs = [.01, ...this.plants.map(p => p.x).sort((a,b) => a-b), .99];
    let x = .5, gap = 0;
    for (let i=1;i<xs.length;i++) if (xs[i]-xs[i-1] > gap) {
      gap = xs[i]-xs[i-1]; x = (xs[i]+xs[i-1])/2;
    }
    const count = this.plants.length;
    this.waterSeed(x, .99);
    if (this.plants.length > count) return;
    // Full or spatially crowded: retire one mature, visible flower at a time.
    // Watering cannot cancel retirement, and its space remains reserved until
    // the fade finishes, so a new plant never pops over the outgoing one.
    const oldest = this.visiblePlants().filter(p => p.age >= 8)
      .reduce((best,p) => !best || p.age > best.age ? p : best, null);
    if (oldest) oldest.retiringAge = 0;
  }
  plantHeight(p) {
    if(!this.phonePreview)return p.height;
    return p.height * (this.heightRanges[p.type][1] > .3 ? .8 : 1) * (this.plantDepth(p)===0?.82:1);
  }
  plantDepth(p) {
    return p.depth ?? (Math.floor(p.seed || 0)%2);
  }
  plantRootY(p) {
    if(!this.phonePreview)return p.y;
    return (this.plantDepth(p)===0?.926:.978)+rndStable(p.seed||0,11)*.014;
  }
  phonePlantPlacement(type, impactX) {
    // Rain waters the whole ground. Fill underrepresented regions before
    // adding more flowers beside an already dominant cluster.
    const regions = [0,1].flatMap(depth=>[[.08,.32],[.38,.62],[.68,.92]].map(([lo,hi],index) => ({
      lo,hi,index,depth,
      weight:this.plants.filter(p => Math.min(2,Math.floor(p.x*3))===index)
        .reduce((sum,p) => sum + this.plantHeight(p)*Math.max(.7,p.opacity)*(this.plantDepth(p)===depth?3:1),0),
    }))).sort((a,b) => a.weight-b.weight || Math.abs((a.lo+a.hi)/2-impactX)-Math.abs((b.lo+b.hi)/2-impactX));
    for (const small of [false,true]) for (const region of regions) {
      let kind=type;
      if (small) kind=[0,8,1,9][this.nextPlant%4];
      else if (region.index!==1 && this.heightRanges[kind][1]<.2)
        kind=[2,6,10,14][this.nextPlant%4];
      else if (region.index===1 && this.heightRanges[kind][1]>.26)
        kind=[1,9,2,6][this.nextPlant%4];
      const height=rnd(...this.heightRanges[kind])*.88;
      const center=(region.lo+region.hi)/2+rnd(-.02,.02);
      const positions=[center,...Array.from({length:9},(_,i)=>region.lo+(region.hi-region.lo)*i/8)];
      positions.sort((a,b)=>Math.abs(a-center)-Math.abs(b-center));
      for (const x of positions) {
        const candidate={x,type:kind,height,depth:region.depth};
        if(this.plants.every(p=>Math.abs(p.x-x)*this.w>=this.plantSpacing(p,candidate)))return candidate;
      }
    }
    return null;
  }
  plantSpacing(a, b) {
    const width = p => this.h * this.plantHeight(p) * this.rects[p.type][2] / this.rects[p.type][3] * 1.08;
    const separated=this.plantDepth(a)!==this.plantDepth(b);
    return separated ? Math.max(this.w*.055,(width(a)+width(b))*.15) : Math.max(this.w*.11,(width(a)+width(b))*.36);
  }
  visiblePlants() {
    if (!this.phonePreview) return this.plants;
    const cache = this.visibleCache;
    if (cache?.source === this.plants && cache.count === this.plants.length && cache.w === this.w && cache.h === this.h)
      return cache.result;
    // A desktop garden can already be dense when switching to portrait.
    // Keep its plants intact, but show a spaced selection in the phone frame.
    const visible = [];
    const fits = p => visible.every(q => Math.abs(p.x-q.x)*this.w >= this.plantSpacing(p,q));
    // Reserve a readable flower in each region before filling smaller gaps.
    // Neither an edge leaf nor two broad flowers should exclude the center.
    for (const zone of [0,2,1]) {
      const target=zone===1?.1:.18, center=(zone+.5)/3;
      const score=p=>Math.abs(this.plantHeight(p)-target)*3+Math.abs(p.x-center);
      const anchor=this.plants.filter(p=>Math.min(2,Math.floor(p.x*3))===zone)
        .sort((a,b)=>score(a)-score(b)).find(fits);
      if(anchor)visible.push(anchor);
    }
    for (const p of [...this.plants].sort((a,b) => this.plantHeight(b)-this.plantHeight(a) || a.x-b.x)) {
      if (visible.length < 10 && !visible.includes(p) && fits(p)) visible.push(p);
    }
    const result = visible.sort((a,b) => this.plantRootY(a)-this.plantRootY(b) || a.opacity-b.opacity);
    this.visibleCache = { source: this.plants, count: this.plants.length, w: this.w, h: this.h, result };
    return result;
  }
  brush(from, to, radius = 26, strength = 1) {
    const a = { x: from.x * this.w, y: from.y * this.h },
      b = { x: to.x * this.w, y: to.y * this.h };
    const dx = b.x - a.x,
      dy = b.y - a.y;
    if (Math.hypot(dx, dy) < 1) return;
    for (const p of this.visiblePlants()) {
      const pose = plantGrowth(p), g = pose.height;
      if (g < 0.12) continue;
      const ph = this.h * this.plantHeight(p) * g,
        rect = this.rects[p.type],
        pw = ((this.h * this.plantHeight(p) * rect[2]) / rect[3]) * pose.scale,
        cx = p.x * this.w + Math.sin(p.bend) * ph * 0.5,
        cy = this.plantRootY(p) * this.h - ph * 0.5,
        influence = sweptInfluence(a, b, cx, cy, pw * 0.4 + radius, ph * 0.52 + radius);
      if (!influence) continue;
      // Horizontal brushing bends in the hand's direction; vertical strokes nudge sideways.
      const push = dx * 0.032 + dy * 0.012 * (b.x >= cx ? 1 : -1);
      p.bendVelocity = clamp(p.bendVelocity + push * influence * strength, -3.8, 3.8);
      this.brushHits++;
    }
  }
  get hasVisualContent() {
    return this.grassLevel > 0 || this.drops.length > 0 || this.ripples.length > 0 ||
      this.splashes.length > 0 || this.plants.length > 0;
  }
  draw() {
    const c = this.ctx,
      w = this.w,
      h = this.h;
    c.clearRect(0, 0, w, h);
    if (this.grassLevel > 0) {
      c.save();
      c.globalAlpha = this.grassLevel * this.grassLevel * (3 - 2 * this.grassLevel);
      c.drawImage(this.grass, 0, this.grassTop * h, w, (1 - this.grassTop) * h);
      c.restore();
    }
    c.lineCap = "round";
    c.lineJoin = "round";
    for (const r of this.ripples) {
      const t = r.age / r.life,
        fade = Math.pow(1 - t, 1.4);
      c.save();
      c.translate(r.x * w, r.y * h);
      for (let j = 0; j < 3; j++) {
        const radius = r.radius * (0.16 + ease(t) * 1.2) * (1 - j * 0.26);
        if (radius < 2) continue;
        for (let a = 0; a < 4; a++) {
          const start = (a * Math.PI) / 2 + r.seed + j * 0.6;
          c.beginPath();
          c.ellipse(
            0,
            j * 1.5,
            radius,
            radius * 0.25,
            start * 0.018,
            start,
            start + rndStable(r.seed, j + a) * 0.38 + 0.72,
          );
          c.strokeStyle =
            j === 1 ? `rgba(147,211,226,${fade * 0.65})` : `rgba(247,252,247,${fade * 0.9})`;
          c.lineWidth = (2.5 - j * 0.35) * fade + 0.45;
          c.stroke();
        }
      }
      c.restore();
    }
    for (const r of this.ripples) {
      if (r.age > 0.7) continue;
      const lift = Math.sin(clamp(r.age / 0.7) * Math.PI),
        opacity = clamp(1 - r.age / 0.7);
      c.save();
      c.translate(r.x * w, r.y * h);
      c.strokeStyle = `rgba(249,252,245,${opacity * 0.9})`;
      for (let j = 0; j < 3; j++) {
        const direction = j === 0 ? -1 : 1,
          reach = (j === 1 ? 9 : 23) * lift,
          height = (j === 1 ? 38 : 25) * lift;
        c.lineWidth = j === 1 ? 2 : 1.7;
        c.beginPath();
        c.moveTo(j * 2 - 2, 0);
        c.bezierCurveTo(
          direction * reach * 0.1,
          -height * 0.7,
          direction * reach * 0.75,
          -height * 1.3,
          direction * reach,
          -height * 0.7,
        );
        c.stroke();
        c.beginPath();
        c.ellipse(direction * reach, -height * 0.7, 2.1, 3.4, -direction * 0.6, 0, Math.PI * 1.7);
        c.stroke();
      }
      c.restore();
    }
    for (const s of this.splashes) {
      c.globalAlpha = (1 - s.age / s.life) * 0.85;
      c.strokeStyle = "#f3faf3";
      c.lineWidth = 1.7;
      c.beginPath();
      c.moveTo(s.x * w, s.y * h);
      c.lineTo(s.x * w - s.vx * 0.026, s.y * h - s.vy * 0.026);
      c.stroke();
    }
    c.globalAlpha = 1;
    for (const d of this.drops) {
      const x = d.x * w,
        y = d.y * h,
        s = d.size;
      const len = Math.max(
        s * (this.phonePreview ? 5.75 : 3.6),
        Math.min(260, Math.min(180, d.vy * 0.27) * (this.phonePreview ? Math.max(.48, d.trailScale) : d.trailScale)) * (h / 650),
      );
      c.save();
      c.globalAlpha = this.phonePreview ? .66 : 1;
      c.translate(x, y);
      c.rotate(-Math.atan2(d.vx, d.vy));
      const grad = c.createLinearGradient(0, -len, 0, -s * 2.3);
      grad.addColorStop(0, "rgba(255,255,255,0)");
      grad.addColorStop(0.5, `rgba(250,252,250,${clamp(this.trail * 0.7)})`);
      grad.addColorStop(1, `rgba(250,252,250,${clamp(this.trail * 1.5)})`);
      c.strokeStyle = grad;
      c.lineWidth = rndStable(d.seed, 0) * 0.9 + 2.5;
      c.beginPath();
      c.moveTo(-0.4, -len);
      c.lineTo(0.6, -s * 2.8);
      c.stroke();
      if (this.crayonSprites) {
        const variant = (d.hollow ? 1 : 0) + (rndStable(d.seed, 8) > 0.5 ? 2 : 0);
        const sprite = (d.white ? this.crayonSprites.whiteDrops : this.crayonSprites.drops)[
          variant
        ];
        c.drawImage(sprite, -s * 0.75, -s * 2.1, s * 1.5, s * 3.8);
        c.restore();
        continue;
      }
      c.beginPath();
      c.moveTo(0, -s * 2.1);
      c.bezierCurveTo(-s * 0.2, -s * 0.8, -s * 0.92, s * 0.4, -s * 0.65, s * 0.95);
      c.bezierCurveTo(-s * 0.12, s * 1.7, s * 0.83, s * 1.2, s * 0.64, s * 0.4);
      c.bezierCurveTo(s * 0.48, -s * 0.45, s * 0.22, -s * 1.5, 0, -s * 2.1);
      c.closePath();
      c.fillStyle = d.white ? "#edf8f6" : "#79ceec";
      c.strokeStyle = d.white ? "#e4f3ef" : "#73c6e6";
      c.lineWidth = 1.7;
      if (d.hollow) c.stroke();
      else {
        c.fill();
        c.globalAlpha *= 0.23;
        c.strokeStyle = "#b8eafa";
        c.lineWidth = 0.7;
        c.stroke();
      }
      c.restore();
    }
    this.drawPlants();
  }
  drawPlants() {
    const c = this.plantCtx,
      w = this.w,
      h = this.h;
    if (this.plantCanvas !== this.canvas) c.clearRect(0, 0, w, h);
      for (const p of this.visiblePlants()) {
        const atlas = p.type < 8 ? this.atlas : this.extraAtlas;
        if (!atlas.complete || !atlas.naturalWidth) continue;
        const rect = this.rects[p.type],
          pose = plantGrowth(p),
          g = pose.height,
          ph = h * this.plantHeight(p),
          pw = (ph * rect[2]) / rect[3],
          retirement = clamp((p.retiringAge || 0) / 2.4),
          fade = clamp((100 - (this.time - p.watered)) / 15) * (1-retirement*retirement*(3-2*retirement));
        c.save();
        c.translate(p.x * w, this.plantRootY(p) * h + 3);
        c.rotate((Math.sin(this.time * 1.6 + p.seed) * 0.025 + this.wind * 0.12) * g + p.bend + pose.lean);
        c.scale(p.flip * pose.scale, pose.scale);
        c.globalAlpha = fade * p.opacity * clamp(pose.reveal / 0.08) * (this.phonePreview&&this.plantDepth(p)===0?.74:1);
        if (pose.scale > 0) c.drawImage(atlas, ...rect, -pw / 2, -ph, pw, ph);
        c.restore();
      }
  }
  paintGrass() {
    // Cache broad wax strokes and broken pigment once; no per-frame texture noise.
    const w = Math.max(1, Math.min(1100, Math.round(this.w))),
      h = Math.max(1, Math.round((this.h * w) / Math.max(1, this.w))),
      top = 0.84, coverage = 1 - top;
    // Retain only the painted band, with one transparent row for resampling.
    // Keep the original full-screen coordinates and grain seed for identical art.
    const offset = Math.max(0, Math.floor(h * top) - 1);
    if (this.grassSourceHeight === h && this.grass.width === w) return;
    this.grassSourceHeight = h;
    this.grassTop = offset / h;
    this.grass.width = w;
    this.grass.height = h - offset;
    const c = this.grass.getContext("2d");
    c.translate(0, -offset);
    const ground = c.createLinearGradient(0, h * top, 0, h);
    ground.addColorStop(0, "rgba(203,221,161,0)");
    ground.addColorStop(0.2, "rgba(196,214,148,.8)");
    ground.addColorStop(0.55, "rgba(181,204,132,.88)");
    ground.addColorStop(1, "rgba(155,188,115,.92)");
    c.fillStyle = ground;
    c.fillRect(0, h * top, w, h * coverage);
    c.save();
    c.globalCompositeOperation = "source-atop";
    c.lineCap = "round";
    for (let i = 0; i < Math.round((w * h * coverage) / 170); i++) {
      const x = rndStable(i + 31, 2) * (w + 80) - 40,
        y = h * (top + rndStable(i + 31, 5) * coverage),
        length = 18 + rndStable(i + 31, 9) * 68,
        slope = (rndStable(i + 31, 11) - 0.7) * 0.36;
      c.strokeStyle = ["rgba(228,240,182,.32)", "rgba(174,204,124,.26)", "rgba(133,171,96,.18)"][
        i % 3
      ];
      // Several uneven parallel marks read as the side of a crayon dragged over paper.
      for (let j = 0; j < 3; j++) {
        const offset = j * 1.8;
        c.lineWidth = 1 + rndStable(i + 31, j + 15) * 2;
        c.beginPath();
        c.moveTo(x + j * 2, y + offset);
        c.quadraticCurveTo(
          x + length * 0.45,
          y + length * slope * 0.4 + offset + 1,
          x + length - j * 3,
          y + length * slope + offset,
        );
        c.stroke();
      }
    }
    for (let i = 0; i < 850; i++) {
      const x = rndStable(i + 1, 4) * w,
        y = h * (top + rndStable(i + 1, 7) * coverage);
      c.fillStyle = i % 2 ? "rgba(241,246,204,.12)" : "rgba(93,127,68,.07)";
      c.fillRect(x, y, 1 + rndStable(i + 1, 3) * 2, 1.2);
    }
    c.lineCap = "round";
    for (let i = 0; i < Math.round(w / 9); i++) {
      const x = rndStable(i + 2, 2) * w,
        y = h * (0.87 + rndStable(i + 2, 5) * 0.13),
        length = (3 + rndStable(i + 2, 9) * 8) * (0.5 + (y / h - 0.5));
      c.strokeStyle = i % 3 ? "rgba(234,242,183,.27)" : "rgba(100,139,74,.17)";
      c.lineWidth = 1.1;
      c.beginPath();
      c.moveTo(x - 2, y - length * 0.65);
      c.quadraticCurveTo(x, y - length * 0.35, x, y);
      c.quadraticCurveTo(x + 1, y - length * 0.6, x + 3, y - length);
      c.stroke();
    }
    c.restore();
    // Paper-tooth gaps break the flat fill, including its soft upper edge.
    const y0 = Math.floor(h * top),
      texture = c.getImageData(0, y0 - offset, w, h - y0),
      pixels = texture.data;
    let seed = 73129;
    for (let i = 0; i < pixels.length; i += 4) {
      seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
      const grain = seed / 4294967296;
      if (grain < 0.03) {
        pixels[i + 3] = Math.round(pixels[i + 3] * 0.68);
      } else if (grain < 0.19) {
        pixels[i] += (243 - pixels[i]) * 0.55;
        pixels[i + 1] += (246 - pixels[i + 1]) * 0.55;
        pixels[i + 2] += (207 - pixels[i + 2]) * 0.55;
      } else if (grain > 0.76) {
        pixels[i] += (243 - pixels[i]) * 0.25;
        pixels[i + 1] += (246 - pixels[i + 1]) * 0.25;
        pixels[i + 2] += (207 - pixels[i + 2]) * 0.25;
      }
    }
    c.putImageData(texture, 0, y0 - offset);
  }
  stats() {
    return {
      drops: this.drops.length,
      ripples: this.ripples.length,
      plants: this.plants.length,
      brushHits: this.brushHits,
      maxPlantSway: Math.max(0, ...this.plants.map((p) => Math.abs(p.bend))),
      rain: this.rain,
      rainSuppressed: !!this.rainSuppressed,
      wind: this.wind,
      grassLevel: this.grassLevel,
      gardenOpacity: this.lifetime.opacity,
      gardenFading: this.lifetime.fading,
      pendingSeeds: this.water.length,
      assetLoaded: !!this.atlas.naturalWidth && !!this.extraAtlas.naturalWidth,
      plantCatalogSize: this.rects.length,
      crayonRainReady: !!this.crayonSprites,
      plantOpacityRange: this.plants.length
        ? [
            Math.min(...this.plants.map((p) => p.opacity)),
            Math.max(...this.plants.map((p) => p.opacity)),
          ]
        : [],
      plantVarieties: new Set(this.plants.map((p) => p.type)).size,
      plantHeightRange: this.plants.length
        ? [
            Math.min(...this.plants.map((p) => p.height)),
            Math.max(...this.plants.map((p) => p.height)),
          ]
        : [],
    };
  }
}
function rndStable(seed, i) {
  return ((Math.sin(seed * 17 + i * 33) * 43758.5453) % 1) * 0.5 + 0.5;
}
function plantSequence() {
  const shuffle = (arr) => {
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  };
  const low = [...shuffle([0, 8]), ...shuffle([1, 9])],
    mid = shuffle([2, 3, 6, 10, 11, 14]),
    tall = shuffle([4, 5, 7, 12, 13, 15]);
  return [
    tall[0],
    low[0],
    mid[0],
    low[1],
    tall[1],
    mid[1],
    mid[2],
    low[2],
    tall[2],
    mid[3],
    tall[3],
    low[3],
    tall[4],
    mid[4],
    tall[5],
    mid[5],
  ];
}
