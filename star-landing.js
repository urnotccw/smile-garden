import { catchOnPalm } from './palm.js';
const random=(a,b)=>a+Math.random()*(b-a);
export const WATER_STAR_LIMIT=28;
export const PALM_STAR_LIMIT=8;
export const waterline=(x,w,h)=>h*(.95+.007*Math.sin(x/w*7));
export function catchMorph(age){return Math.max(0,Math.min(1,(age-.18)/.22));}
export function waterImpactScale(size){return .65+Math.max(0,Math.min(1,(size-10)/34))*.8;}

// The star emerges only after impact, jumps once, then settles back onto its ripple.
export function waterStarMotion(age,size){
  const elapsed=Math.max(0,age-.06),u=Math.min(1,elapsed/.68);
  return {lift:4*u*(1-u)*(19+size*.3),reveal:Math.min(1,elapsed/.12),settled:u>=1};
}

export function landStar(p,previous,palm,generation,w,h,counts,allowHeartWater=false){
  if(p.star || p.age>=p.life)return false;
  const catchPoint=p.heart?catchOnPalm(p,previous,palm):null;
  const floor=waterline(p.x,w,h);
  const canLandOnWater=p.heart?allowHeartWater:p.released;
  const water=!catchPoint && canLandOnWater && p.vy>0 && previous.y<floor && p.y>=floor && p.x>8 && p.x<w-8;
  if(!catchPoint&&!water)return false;
  const kind=catchPoint?'palm':'water';
  const sizeBand=[[10,14],[21,27],[10,14],[36,44],[10,14],[21,27]][(counts.waterIndex??counts.water)%6];
  const starSize=catchPoint?random(25,43):random(...sizeBand);
  // Close impacts share a patch of water instead of piling opaque stars into a strip.
  if(water && counts.waterSites?.some(site=>Math.abs(site.x-p.x)<Math.max(30,(starSize+(site.size??16))*.48+9))) {p.life=0;return false;}
  if(counts[kind]>=(catchPoint?PALM_STAR_LIMIT:WATER_STAR_LIMIT)){if(water)p.life=0;return false;}
  counts[kind]++;
  if(water){counts.waterSites?.push({x:p.x,size:starSize});counts.waterIndex=(counts.waterIndex??counts.water-1)+1;}
  p.caughtHeartVariant=p.heartVariant??0;
  p.star=kind;p.heart=false;p.age=0;p.life=catchPoint?4.2:2.6;
  p.starSize=starSize;
  p.starVariant=Math.floor(random(0,catchPoint?4:3));p.tilt=random(-.6,.6);
  p.phase=random(0,Math.PI*2);p.vx=0;p.vy=0;
  if(catchPoint){
    p.palmOffset=catchPoint;p.palmGeneration=generation;
    const c=Math.cos(palm.angle),s=Math.sin(palm.angle);
    p.x=palm.x+catchPoint.x*c-catchPoint.y*s;p.y=palm.y+catchPoint.x*s+catchPoint.y*c;
  }else{p.y=floor;p.waterX=p.x;p.waterY=floor;}
  return true;
}

export function updateLandedStar(p,palm,generation,dt,w=0,h=0,counts){
  if(p.star==='palm'){
    if(palm&&generation===p.palmGeneration){
      const c=Math.cos(palm.angle),s=Math.sin(palm.angle),o=p.palmOffset;
      p.x=palm.x+o.x*c-o.y*s;p.y=palm.y+o.x*s+o.y*c-Math.sin(p.age*3)*1.5;
      const speed=Math.hypot(palm.vx||0,palm.vy||0);
      if(p.age>.42&&speed<180)p.throwReady=true;
      if(p.throwReady&&speed>380){
        p.star='tossed';p.age=0;p.life=3.4;
        p.vx=Math.max(-500,Math.min(500,palm.vx*.95));
        p.vy=Math.max(-460,Math.min(-100,palm.vy*.85-140));
      }
    }else{
      // Tracking loss releases the star; it cannot teleport to a newly seen hand.
      p.palmGeneration=-1;p.life=Math.min(p.life,p.age+.4);p.vy+=70*dt;p.y+=p.vy*dt;
    }
  }else if(p.star==='tossed'){
    const decay=Math.exp(-.5*dt),travel=(1-decay)/.5;
    p.x+=p.vx*travel;p.y+=p.vy*travel+560*(dt-travel);
    p.vx*=decay;p.vy=p.vy*decay+280*travel;p.tilt+=dt*(p.vx<0?-2:2);
    const floor=waterline(p.x,w,h);
    if(h&&p.vy>0&&p.y>=floor){
      if(counts&&(counts.water>=WATER_STAR_LIMIT||counts.waterSites?.some(s=>Math.abs(s.x-p.x)<Math.max(30,(p.starSize+(s.size??16))*.48+9)))){p.life=0;return;}
      p.star='water';p.age=0;p.life=2.6;p.waterX=p.x;p.waterY=floor;p.y=floor;p.vx=p.vy=0;
      if(counts){counts.water++;counts.waterSites?.push({x:p.x,size:p.starSize});}
    }
  }else{
    const motion=waterStarMotion(p.age,p.starSize);
    p.x=p.waterX+Math.sin(p.age*1.8+p.phase)*2;
    p.y=p.waterY-motion.lift+(motion.settled?Math.sin((p.age-.74)*4)*1.7:0);
  }
}

export function drawLandedStar(c,p,sprites,hearts,quality=0){
  const fade=Math.min(1,Math.max(0,(p.life-p.age)/.75));
  c.save();c.globalCompositeOperation='source-over';
  if(p.star==='water'){
    const impact=waterImpactScale(p.starSize);
    // Broken, slightly uneven rings give each impact its own drawn water surface.
    c.lineCap='round';
    for(let ring=0;ring<(quality>=2?1:2);ring++){
      const t=p.age-ring*.23;if(t<0||t>1.6)continue;
      const radius=(5+t*22+ring*3)*impact;
      c.globalAlpha=(1-t/1.6)*fade*.72;
      for(let arc=0;arc<3;arc++){
        c.beginPath();
        const steps=quality?10:16;
        for(let i=0;i<=steps;i++){
          const a=arc*Math.PI*2/3+i/steps*1.7+p.phase*.1;
          const r=radius*(1+.035*Math.sin(a*5+ring));
          const x=p.waterX+Math.cos(a)*r,y=p.waterY+Math.sin(a)*r*.25;
          if(i)c.lineTo(x,y);else c.moveTo(x,y);
        }
        // Blue-grey body stays legible on a white shirt; a narrow cream stroke
        // supplies the drawn highlight without a glowing white ring.
        c.strokeStyle='#759da9';c.lineWidth=ring===0?2.7:2;c.stroke();
        c.strokeStyle=ring===0?'#e6ede0':'#c2dce3';c.lineWidth=ring===0?1.05:.8;c.stroke();
      }
    }
    if(p.age<.65){
      const t=p.age/.65,arc=4*t*(1-t)*impact;
      c.globalAlpha=(1-t)*.88;c.lineWidth=1.5;
      // Two short water jets and a few droplets emphasize the actual impact.
      for(const side of [-1,1]){
        c.beginPath();c.moveTo(p.waterX+side*2,p.waterY);
        c.quadraticCurveTo(p.waterX+side*(5+t*11),p.waterY-arc*25,p.waterX+side*(7+t*27),p.waterY-arc*15);
        c.strokeStyle='#799eaa';c.lineWidth=2.5;c.stroke();c.strokeStyle='#e6ede0';c.lineWidth=1;c.stroke();
        for(let i=0;i<(quality>=2?1:2);i++){
          const x=p.waterX+side*(3+t*(18+i*12)*impact),y=p.waterY-arc*(13+i*7);
          c.fillStyle=i===1?'#d2e5e5':'#8ab3c2';c.beginPath();
          c.ellipse(x,y,1.3+i*.25,2.2+i*.35,side*(.25+t),0,Math.PI*2);c.fill();
        }
      }
    }
  }
  const sprite=sprites?.[p.starVariant%sprites.length];
  if(sprite){
    const morph=p.star==='palm'?catchMorph(p.age):1;
    if(morph<1&&hearts){
      c.save();c.globalAlpha=fade*(1-morph);c.translate(p.x,p.y);c.rotate(p.tilt);
      const spring=Math.exp(-p.age*12)*Math.cos(p.age*21),size=p.radius*3;
      c.scale(1+.15*spring,1-.13*spring);
      c.drawImage(hearts[p.caughtHeartVariant%hearts.length],-size/2,-size/2,size,size);c.restore();
    }
    const emergence=p.star==='water'?waterStarMotion(p.age,p.starSize):{lift:0,reveal:1};
    if(p.star==='water'){
      c.save();c.globalAlpha=fade*.13*emergence.reveal/(1+emergence.lift/20);c.translate(p.x,p.waterY+6);c.scale(1,-.3);c.rotate(p.tilt);
      c.drawImage(sprite,-p.starSize/2,-p.starSize/2,p.starSize,p.starSize);c.restore();
    }
    c.globalAlpha=fade*emergence.reveal*morph;c.translate(p.x,p.y-(p.star==='water'?p.starSize*.22:0));
    c.rotate(p.tilt+Math.sin(p.age*2+p.phase)*.13);
    const pop=1+.16*Math.exp(-p.age*9)*Math.sin(p.age*22),size=p.starSize*pop*(.55+.45*emergence.reveal);
    c.drawImage(sprite,-size/2,-size/2,size,size);
  }
  c.restore();
}
