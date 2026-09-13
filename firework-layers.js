import { SPARK_COLORS, PATTERN_PALETTES } from './firework-ink.js';

const TAU = Math.PI * 2;
const EXTENT = 1.28;
const SIZE = 384;
const cache = new Map();
const clamp = t => Math.max(0, Math.min(1, t));
const smooth = t => { t = clamp(t); return t * t * (3 - 2 * t); };

// The complete pigment silhouette dissolves as the physical sparks scatter.
export function motifEnvelope(age, releaseAt = 1.05) {
  const t = Math.max(0, age - releaseAt);
  return {
    scale: 1 - Math.pow(1 - clamp(age / .8), 3),
    opacity: smooth(age / .32) * (1 - smooth(t / .22)),
  };
}

function canvas(w = SIZE, h = SIZE) {
  const image = document.createElement('canvas');
  image.width = w; image.height = h;
  return image;
}

function starPath(x, y, r) {
  const path = new Path2D();
  for (let i = 0; i < 10; i++) {
    const a = i * Math.PI / 5 - Math.PI / 2, radius = r * (i % 2 ? .42 : 1);
    const px = x + Math.cos(a) * radius, py = y + Math.sin(a) * radius;
    if (!i) path.moveTo(px, py); else path.lineTo(px, py);
  }
  path.closePath(); return path;
}

function heartPath() {
  const path = new Path2D();
  for (let i = 0; i <= 180; i++) {
    const a = i / 180 * TAU;
    const x = Math.sin(a) ** 3 * .93;
    const y = -(13 * Math.cos(a) - 5 * Math.cos(2 * a) - 2 * Math.cos(3 * a) - Math.cos(4 * a)) / 17;
    if (!i) path.moveTo(x, y); else path.lineTo(x, y);
  }
  path.closePath(); return path;
}

function whalePath() {
  const p = new Path2D(); p.moveTo(-.95, .04);
  p.bezierCurveTo(-.7, -.61, .1, -.61, .45, -.05);
  p.bezierCurveTo(.57, -.02, .78, -.27, .94, -.42);
  p.bezierCurveTo(.92, -.05, .87, .04, .7, .1);
  p.bezierCurveTo(.92, .13, .99, .3, 1.02, .4);
  p.bezierCurveTo(.71, .44, .62, .26, .46, .2);
  p.bezierCurveTo(.08, .71, -.66, .6, -.95, .04);
  p.closePath(); return p;
}

// These are the same geometric motifs as the particle paths, filled with dry wax.
// All strokes and paper gaps are baked once per motif.
export function getMotifSprite(kind) {
  if (cache.has(kind)) return cache.get(kind);
  const image = canvas(), c = image.getContext('2d');
  const colors = PATTERN_PALETTES[kind].map(i => SPARK_COLORS[i]);
  c.translate(SIZE / 2, SIZE / 2); c.scale(SIZE / (EXTENT * 2), SIZE / (EXTENT * 2));
  let seed = 31415 + kind * 971;
  const rand = () => ((seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0) / 4294967296);
  const wax = (path, color, accent, opacity = .9, rule = 'nonzero') => {
    c.save(); c.globalAlpha = opacity; c.fillStyle = color; c.fill(path, rule);
    c.clip(path, rule); c.lineCap = 'round';
    // Uneven diagonal wax strokes are visible at portrait sizes, unlike tiny noise alone.
    for (let i = 0; i < 165; i++) {
      const x = rand() * 2.4 - 1.2, y = rand() * 2.4 - 1.2;
      c.globalAlpha = .16 + rand() * .26;
      c.strokeStyle = i % 4 ? accent : '#fff2d2'; c.lineWidth = .012 + rand() * .025;
      c.beginPath(); c.moveTo(x, y); c.lineTo(x + .08 + rand() * .42, y - .02 - rand() * .12); c.stroke();
    }
    c.restore();
  };
  const shade = path => {
    c.save(); c.translate(.027, .043); c.globalAlpha = .35;
    c.strokeStyle = ['#416884', '#9a613e', '#944b7b', '#376d72'][kind];
    c.lineWidth = .055; c.lineJoin = 'round'; c.stroke(path); c.restore();
  };
  if (kind === 0) {
    const planet = new Path2D(); planet.ellipse(0, -.12, .62, .62, 0, 0, TAU);
    shade(planet); wax(planet, colors[0], colors[1]);
    c.save(); c.clip(planet);
    const lower = new Path2D(); lower.moveTo(-.8, .08); lower.bezierCurveTo(-.3, -.1, .2, .35, .8, -.07);
    lower.lineTo(.8, .7); lower.lineTo(-.8, .7); lower.closePath();
    wax(lower, colors[1], colors[0], .58); c.restore();
    const ring = new Path2D(); ring.ellipse(0, -.08, .99, .22, -.35, 0, TAU);
    ring.ellipse(0, -.08, .85, .135, -.35, 0, TAU);
    wax(ring, colors[1], colors[2], .78, 'evenodd');
    wax(starPath(-.88, -.62, .14), colors[2], colors[0]);
    wax(starPath(.85, .57, .14), colors[2], colors[1]);
  } else if (kind === 1) {
    const star = starPath(0, 0, .73); shade(star); wax(star, colors[0], colors[1]);
    c.save(); c.clip(star);
    const facet = new Path2D(); facet.moveTo(0, -.73); facet.lineTo(0, .05);
    facet.lineTo(.7, .6); facet.lineTo(1, -1); facet.closePath();
    wax(facet, colors[1], colors[2], .46); c.restore();
    const ring = new Path2D(); ring.ellipse(0, 0, .99, .99, 0, 0, TAU);
    ring.ellipse(0, 0, .955, .955, 0, 0, TAU);
    wax(ring, colors[1], colors[2], .42, 'evenodd');
    wax(starPath(-.9, -.8, .12), colors[2], colors[0]);
    wax(starPath(.85, -.78, .12), colors[2], colors[0]);
  } else if (kind === 2) {
    const heart = heartPath(); shade(heart); wax(heart, colors[0], colors[1]);
    c.save(); c.clip(heart);
    const facet = new Path2D(); facet.moveTo(-1, .35);
    facet.bezierCurveTo(-.35, .05, .2, .55, 1, -.25); facet.lineTo(1, 1.2); facet.lineTo(-1, 1.2); facet.closePath();
    wax(facet, colors[1], colors[0], .5);
    c.globalAlpha = .7; c.strokeStyle = colors[2]; c.lineWidth = .038; c.lineCap = 'round';
    c.beginPath(); c.moveTo(-.71, -.18); c.bezierCurveTo(-.76, -.47, -.43, -.6, -.29, -.44); c.stroke();
    c.restore();
    for (const [x, y] of [[-.93, -.53], [.93, -.53], [0, -1]]) wax(starPath(x, y, .13), colors[2], colors[0]);
  } else {
    const whale = whalePath(); shade(whale); wax(whale, colors[0], colors[1]);
    c.save(); c.clip(whale);
    const belly = new Path2D(); belly.moveTo(-.94, .13); belly.bezierCurveTo(-.5, .2, -.05, .5, .53, .12);
    belly.lineTo(.65, .85); belly.lineTo(-1, .85); belly.closePath();
    wax(belly, colors[1], colors[2], .76); c.restore();
    const fin = new Path2D(); fin.moveTo(-.12, .32); fin.bezierCurveTo(-.24, .75, .14, .61, .22, .33); fin.closePath();
    wax(fin, colors[1], colors[0]);
    c.fillStyle = '#31596c'; c.beginPath(); c.arc(-.51, -.08, .038, 0, TAU); c.fill();
    wax(starPath(.57, -.72, .18), colors[2], colors[0]);
    wax(starPath(-.89, .69, .13), colors[2], colors[0]);
  }
  // Stable transparent pores, rather than regenerated flickering noise.
  c.setTransform(1, 0, 0, 1, 0, 0);
  const pixels = c.getImageData(0, 0, SIZE, SIZE);
  for (let i = 3; i < pixels.data.length; i += 4) {
    const grain = rand();
    if (grain < .085) pixels.data[i] *= .25 + rand() * .35;
    else if (grain < .5) pixels.data[i] *= .78 + rand() * .2;
  }
  c.putImageData(pixels, 0, 0);
  const result = { image }; cache.set(kind, result); return result;
}

export class FireworkLayers {
  constructor() {
    this.events = [];
    // A bounded, shared cache keeps texture construction out of burst/update/draw.
    for (let kind = 0; kind < 4; kind++) getMotifSprite(kind);
  }
  add(x, y, radius, kind, angle, w, h) {
    this.events.push({ x: x / w, y: y / h, radius: radius / Math.min(w, h), kind, angle, age: 0 });
    if (this.events.length > 3) this.events.shift();
  }
  update(dt) { for (const e of this.events) e.age += dt; this.events = this.events.filter(e => e.age < 1.27); }
  clear() { this.events = []; }
  draw(c, w, h, strength = 1) {
    for (const e of this.events) {
      const f = motifEnvelope(e.age); if (f.opacity < .002) continue;
      const radius = e.radius * Math.min(w, h), sprite = getMotifSprite(e.kind);
      c.save(); c.globalCompositeOperation = 'source-over';
      c.globalAlpha = f.opacity * .88 * strength;
      c.translate(e.x * w, e.y * h); c.rotate(e.angle || 0);
      const size = radius * EXTENT * 2, scale = size / SIZE * f.scale;
      c.scale(scale, scale);
      c.drawImage(sprite.image, -SIZE / 2, -SIZE / 2);
      c.restore();
    }
  }
}
