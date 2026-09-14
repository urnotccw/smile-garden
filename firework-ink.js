// Small pigment stamps are cached once; no grain generation or image reads in the frame loop.
export const SPARK_COLORS = ['#fff0c9', '#bf9af2', '#ffd16f', '#78d6ed', '#f69bbc', '#8ce0bc', '#ffa68b'];
// Each motif has a coherent three-colour palette; simultaneous motifs add variety.
export const PATTERN_PALETTES = [[3,1,0],[2,6,0],[4,1,0],[3,5,0]];
export function makeInkSpark(color, variant = 0) {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = 64;
  const c = canvas.getContext('2d');
  let seed = 1729 + variant * 613;
  const rand = () => ((seed = (Math.imul(seed,1664525)+1013904223)>>>0)/4294967296);
  // Low, wide light supports the pigment without washing out its paper gaps.
  const glow = c.createRadialGradient(32,32,4,32,32,28);
  glow.addColorStop(0,color+'28');glow.addColorStop(.45,color+'0c');glow.addColorStop(1,color+'00');
  c.fillStyle=glow;c.fillRect(0,0,64,64);
  c.save();c.translate(32,32);c.rotate(variant*.47);
  const pigment = new Path2D();
  const rx = variant ? 12 : 9, ry = variant ? 5.5 : 8;
  for(let i=0;i<26;i++){
    const a=i/26*Math.PI*2, edge=.87+rand()*.19;
    const x=Math.cos(a)*rx*edge,y=Math.sin(a)*ry*edge;
    if(i) pigment.lineTo(x,y); else pigment.moveTo(x,y);
  }
  pigment.closePath();
  c.fillStyle=color;c.fill(pigment);c.clip(pigment);c.lineCap='round';
  // Broad dry strokes survive downsampling to a small phone preview.
  for(let i=0;i<13;i++){
    const y=-10+i*1.65;
    c.globalAlpha=.2+rand()*.25;c.strokeStyle=i%3 ? '#fff4d8' : color;
    c.lineWidth=.65+rand()*.65;
    c.beginPath();c.moveTo(-13,y);c.lineTo(13,y-5-rand()*2);c.stroke();
  }
  c.globalAlpha=1;c.globalCompositeOperation='destination-out';
  for(let i=0;i<92;i++){
    c.fillStyle=`rgba(0,0,0,${.2+rand()*.6})`;
    c.fillRect(-13+rand()*26,-10+rand()*20,.5+rand()*1.1,.5+rand()*.8);
  }
  c.restore();
  return canvas;
}

// Only decorative, airborne sparks recede over the face. Crown contacts and catchable
// hearts/stars retain full readability and all particles keep their original physics.
export function faceSparkOpacity(p, head) {
  if(!head||!p.released||p.heart||p.star)return 1;
  const cos=head.cos??Math.cos(head.angle||0),sin=head.sin??Math.sin(head.angle||0);
  const dx=p.x-head.x,dy=p.y-head.y;
  const x=(dx*cos+dy*sin)/head.rx,y=(-dx*sin+dy*cos)/head.ry;
  const radius=Math.hypot(x/.96,(y-.28)/.88);
  const t=Math.max(0,Math.min(1,(radius-.6)/.65));
  return .22+.78*t*t*(3-2*t);
}
