import { coverPoint } from './hand.js';

// Use the palm, not fingertip cursors. Extension is orientation independent.
export function mapPalm(points, sw, sh, w, h, mirror) {
  if (!points || points.length !== 21 || points.some(p => !Number.isFinite(p.x + p.y))) return null;
  const distance = (a,b) => Math.hypot((a.x-b.x)*sw,(a.y-b.y)*sh,((a.z||0)-(b.z||0))*sw);
  const extended = [5,9,13,17].filter(i => distance(points[i+3],points[0]) > distance(points[i+1],points[0])*.92);
  if (extended.length < 1) return null;
  const p = points.map(p => { const q=coverPoint(p,sw,sh,w,h,mirror);return {x:q.x*w,y:q.y*h}; });
  const knuckles=[5,9,13,17].reduce((q,i)=>({x:q.x+p[i].x/4,y:q.y+p[i].y/4}),{x:0,y:0});
  const x=(p[0].x+knuckles.x)*.5, y=(p[0].y+knuckles.y)*.5;
  const span=Math.hypot(p[5].x-p[17].x,p[5].y-p[17].y);
  const length=Math.hypot(p[0].x-p[9].x,p[0].y-p[9].y);
  if (Math.max(span,length)<16 || x<0 || x>w || y<0 || y>h) return null;
  const rx=Math.max(10,span*.66,length*.28);
  const ry=Math.max(10,length*.62,span*.28);
  return {x,y,rx,ry,angle:Math.atan2(p[9].y-p[0].y,p[9].x-p[0].x)+Math.PI/2};
}

export class PalmTracker {
  constructor(){this.reset();}
  reset(){this.palm=null;this.target=null;this.lastTime=-Infinity;this.generation=(this.generation||0)+1;}
  observe(p,time){
    // Bridge a missed detector sample without dropping a star already in the hand.
    if(!p){if(time-this.lastTime>140)this.reset();return;}
    if(!this.palm || time-this.lastTime>220 || Math.hypot(p.x-this.palm.x,p.y-this.palm.y)>Math.max(p.rx,p.ry)*2.5){
      this.reset();this.palm={...p,previousX:p.x,previousY:p.y,vx:0,vy:0};
    }
    this.target=p;this.lastTime=time;
  }
  update(dt,time){
    if(time-this.lastTime>220){this.reset();return null;}
    const p=this.palm,t=this.target;if(!p||!t)return null;
    p.previousX=p.x;p.previousY=p.y;
    const moving=Math.hypot(t.x-p.x,t.y-p.y)>6;
    const a=1-Math.exp(-dt/(moving?.023:.045));
    for(const k of ['x','y','rx','ry'])p[k]+=(t[k]-p[k])*a;
    const speedAlpha=1-Math.exp(-dt/.055),step=Math.max(dt,.001);
    p.vx+=(Math.max(-900,Math.min(900,(p.x-p.previousX)/step))-p.vx)*speedAlpha;
    p.vy+=(Math.max(-900,Math.min(900,(p.y-p.previousY)/step))-p.vy)*speedAlpha;
    p.angle+=Math.atan2(Math.sin(t.angle-p.angle),Math.cos(t.angle-p.angle))*a;
    return p;
  }
}

// Swept collision against a moving palm ellipse prevents fast hearts tunnelling.
export function catchOnPalm(p,previous,palm,mode='heart'){
  if(!palm)return null;
  const relativeFall=p.y-previous.y-(palm.y-(palm.previousY??palm.y));
  const handTravel=Math.hypot(palm.x-(palm.previousX??palm.x),palm.y-(palm.previousY??palm.y));
  if(mode==='rain' ? relativeFall<=0 : relativeFall<=0&&handTravel<.3)return null;
  const padding=p.radius*(mode==='rain'?1:1.25);
  const c=Math.cos(palm.angle),s=Math.sin(palm.angle),rx=palm.rx+padding,ry=palm.ry+padding;
  const local=(x,y)=>({x:(x*c+y*s)/rx,y:(-x*s+y*c)/ry});
  const a=local(previous.x-(palm.previousX??palm.x),previous.y-(palm.previousY??palm.y));
  const b=local(p.x-palm.x,p.y-palm.y), dx=b.x-a.x,dy=b.y-a.y;
  const A=dx*dx+dy*dy,B=2*(a.x*dx+a.y*dy),C=a.x*a.x+a.y*a.y-1,D=B*B-4*A*C;
  // A newly observed or scooping hand may already overlap the lower edge of a heart.
  if(C<-.001){
    if(b.x*b.x+b.y*b.y<=1 && (mode==='heart'||p.y<palm.y))return {x:b.x*rx,y:b.y*ry};
    return null;
  }
  if(A<1e-9 || D<0)return null;
  const t=(-B-Math.sqrt(D))/(2*A);if(t<0||t>1)return null;
  const x=a.x+dx*t,y=a.y+dy*t;
  // Only the upward-facing surface supports a falling heart.
  if(mode==='rain'&&x/rx*s+y/ry*c>=-.002)return null;
  return {x:x*rx,y:y*ry};
}
