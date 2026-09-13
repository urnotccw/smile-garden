import { clamp } from './smile.js';

// Grow from a fixed root without flattening or clipping the petals.
// Use the same silhouette dimensions for drawing and hand interaction.
export function plantGrowth(p) {
  const t = clamp((p.age - (p.growDelay || 0)) / (p.growDuration || 2.6));
  const reveal = t * t * (3 - 2 * t);
  const scale = p.growth * reveal;
  return { reveal, scale, height: scale,
    lean: Math.sin(reveal * Math.PI) * 0.045 * Math.sin(p.seed) };
}
