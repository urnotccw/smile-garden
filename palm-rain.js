import {catchOnPalm} from './palm.js';
export const PALM_RAIN_LIMIT=6;
export const rainStarReveal=age=>Math.max(0,Math.min(1,(age-.28)/.22));

// Rain catches live separately from fireworks so they never suppress the rainfall.
export class PalmRain {
  constructor(){this.particles=[];this.catches=0;this.time=0;this.lastCatch=-Infinity;}
  clear(){this.particles=[];this.lastCatch=-Infinity;}
  catch(drop,previous,palm,generation,w,h){
    const hit=catchOnPalm({x:drop.x*w,y:drop.y*h,vy:drop.vy,radius:drop.size},previous,palm,'rain');
    if(!hit)return false;
    if(this.particles.length>=PALM_RAIN_LIMIT||this.time-this.lastCatch<.14)return true;
    this.lastCatch=this.time;this.catches++;
    this.particles.push({age:0,life:2.4,x:0,y:0,offsetX:hit.x/palm.rx,offsetY:hit.y/palm.ry,
      generation,size:11+Math.random()*9,variant:this.catches%3,tilt:(Math.random()-.5)*.8});
    return true;
  }
  update(dt,palm,generation){
    this.time+=dt;
    for(const p of this.particles){
      p.age+=dt;
      if(palm&&p.generation===generation){
        const x=p.offsetX*palm.rx,y=p.offsetY*palm.ry,c=Math.cos(palm.angle),s=Math.sin(palm.angle);
        p.x=palm.x+x*c-y*s;p.y=palm.y+x*s+y*c;p.positioned=true;
      }else p.life=Math.min(p.life,p.age+.35);
    }
    this.particles=this.particles.filter(p=>p.age<p.life);
  }
  draw(c,sprites,quality=0){
    c.save();c.globalCompositeOperation='source-over';c.lineCap='round';
    for(const p of this.particles){
      if(!p.positioned)continue;
      const fade=Math.min(1,(p.life-p.age)/.4);
      for(let i=0;i<(quality>=2?1:2);i++){
        const t=p.age-i*.13;if(t<0||t>1)continue;
        const r=5+t*24;c.globalAlpha=(1-t)*fade*.8;c.strokeStyle=i?'#d1eaff':'#f3fbf4';c.lineWidth=1.3;
        for(let a=0;a<2;a++){c.beginPath();c.ellipse(p.x,p.y,r,r*.27,.08,a*Math.PI+.1,a*Math.PI+2.8);c.stroke();}
      }
      if(p.age<.45){
        const t=p.age/.45,up=Math.sin(t*Math.PI)*14;c.globalAlpha=(1-t)*fade*.8;c.fillStyle='#d6f2fa';
        for(const side of [-1,1]){c.beginPath();c.ellipse(p.x+side*(3+t*14),p.y-up,1.5,2.5,side*.4,0,Math.PI*2);c.fill();}
      }
      const reveal=rainStarReveal(p.age),sprite=sprites?.[p.variant];
      if(sprite&&reveal>0){
        const size=p.size*(.6+.4*reveal),lift=Math.sin(Math.min(1,Math.max(0,p.age-.28)/.6)*Math.PI)*8;
        c.save();c.globalAlpha=fade*reveal;c.translate(p.x,p.y-4-lift);c.rotate(p.tilt+Math.sin(p.age*2)*.1);
        c.drawImage(sprite,-size/2,-size/2,size,size);c.restore();
      }
    }
    c.restore();
  }
}
