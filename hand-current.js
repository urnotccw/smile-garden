// Local air movement couples released sparks to a moving hand; it adds no particles.
export function moveSparkWithHand(p,palm,dt,w,h){
  if(!palm || !p.released || p.heart || p.star || dt<=0)return false;
  const vx=palm.vx||0,vy=palm.vy||0,speed=Math.hypot(vx,vy);
  if(speed<24)return false;
  const radius=Math.min(340,Math.max(150,Math.min(w,h)*.48,Math.max(palm.rx,palm.ry)*4));
  const dx=p.x-palm.x,dy=p.y-palm.y,distance=Math.hypot(dx,dy);
  if(distance>=radius)return false;
  const weight=(1-distance/radius)**2*Math.min(1,(speed-24)/65);
  const rate=11*weight;if(rate<.01)return false;
  const alpha=1-Math.exp(-rate*dt),travel=dt-alpha/rate;
  const changeX=vx*1.1-p.vx,changeY=vy*1.1-p.vy;
  p.x+=changeX*travel;p.y+=changeY*travel;
  p.vx+=changeX*alpha;p.vy+=changeY*alpha;
  return true;
}

export function updateHandVortex(previous,palm,dt){
  let vortex=previous;
  if(vortex){vortex={...vortex,age:vortex.age+dt};if(vortex.age>.7)vortex=null;}
  const speed=palm?Math.hypot(palm.vx||0,palm.vy||0):0;
  if(speed>280){
    const radius=Math.min(180,Math.max(80,Math.max(palm.rx,palm.ry)*2.8));
    vortex={x:palm.x,y:palm.y,age:0,radius,strength:Math.min(180,(speed-240)*.5),spin:(palm.vx||-palm.vy)>=0?1:-1};
  }
  return vortex;
}
export function swirlSpark(p,vortex,dt){
  if(!vortex||p.heart||p.star||!p.released)return false;
  const dx=p.x-vortex.x,dy=p.y-vortex.y,d=Math.hypot(dx,dy);
  if(d<3||d>vortex.radius)return false;
  const force=vortex.strength*(1-d/vortex.radius)**2*Math.exp(-vortex.age*5)*vortex.spin;
  const ax=-dy/d*force*5,ay=dx/d*force*5;
  p.x+=ax*dt*dt*.5;p.y+=ay*dt*dt*.5;p.vx+=ax*dt;p.vy+=ay*dt;
  return true;
}
