// Small pigment stamps are cached once; no grain generation or image reads in the frame loop.
export const SPARK_COLORS = ['#fff0c9', '#bf9af2', '#ffd16f', '#78d6ed', '#f69bbc', '#8ce0bc', '#ffa68b'];
// Each motif has a coherent three-colour palette; simultaneous motifs add variety.
export const PATTERN_PALETTES = [[3,1,0],[2,6,0],[4,1,0],[3,5,0]];
export function makeInkSpark(color, variant = 0) {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = 40;
  const c = canvas.getContext('2d');
  const glow = c.createRadialGradient(20,20,2,20,20,18);
  glow.addColorStop(0,color+'70');glow.addColorStop(.4,color+'26');glow.addColorStop(1,color+'00');
  c.fillStyle=glow;c.fillRect(0,0,40,40);
  c.save();c.translate(20,20);c.rotate(variant*.71);
  c.beginPath();
  if(!variant)c.ellipse(0,0,5.2,4.6,.12,0,Math.PI*2);
  else {
    c.moveTo(-7,-1.8);c.quadraticCurveTo(-3,-3.7,2,-2.5);
    c.lineTo(6.3,-1.1);c.lineTo(7,1.2);c.quadraticCurveTo(1,3.4,-6.4,2.2);c.closePath();
  }
  c.fillStyle=color;c.fill();c.clip();
  c.globalCompositeOperation='destination-out';c.lineWidth=.65;c.strokeStyle='rgba(0,0,0,.25)';
  for(let i=0;i<8;i++){
    const x=-7+i*1.85,y=Math.sin(i*4.7+variant)*2;
    c.beginPath();c.moveTo(x,y);c.lineTo(x+1.2,y-.6);c.stroke();
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
