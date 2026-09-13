import {SPARK_COLORS, PATTERN_PALETTES} from './firework-ink.js';

const smooth=t=>{t=Math.max(0,Math.min(1,t));return t*t*(3-2*t);};
export const ATMOSPHERE_LIMIT=3;
export function atmosphereEnvelope(age){
  return {
    edge:smooth((age-.35)/.65)*(1-smooth((age-1.6)/2)),
    smoke:smooth((age-1.05)/.3)*(1-smooth((age-1.65)/2.5)),
  };
}

// Rendering-only events. Smoke and rim blur never enter the collision particle pool.
export class FireworkAtmosphere {
  constructor(video){this.video=video;this.events=[];this.time=0;this.sampleAt=-Infinity;this.clouds=[];this.backdrops=[];}
  add(x,y,radius,kind,w,h){
    this.events.push({x:x/w,y:y/h,radius:radius/Math.min(w,h),kind,age:0});
    if(this.events.length>ATMOSPHERE_LIMIT)this.events.shift();
  }
  update(dt){this.time+=dt;for(const e of this.events)e.age+=dt;this.events=this.events.filter(e=>e.age<4.2);}
  clear(){this.events=[];this.invalidate();}
  invalidate(){this.sampleAt=-Infinity;}
  makeCloud(color){
    const canvas=document.createElement('canvas');canvas.width=canvas.height=192;
    const c=canvas.getContext('2d');
    // Overlapping soft volumes form one reusable, feathered smoke stamp.
    for(let i=0;i<7;i++){
      const a=i*2.39996,r=i?27:0,x=96+Math.cos(a)*r,y=96+Math.sin(a)*r*.65;
      const g=c.createRadialGradient(x,y,0,x,y,56+i%3*5);
      g.addColorStop(0,color+'85');g.addColorStop(.48,color+'32');g.addColorStop(1,color+'00');
      c.fillStyle=g;c.fillRect(0,0,192,192);
    }
    // Dry pigment breaks up the volume once; the same paper grain moves with the smoke.
    let seed=7231;
    const rand=()=>((seed=(Math.imul(seed,1664525)+1013904223)>>>0)/4294967296);
    const pixels=c.getImageData(0,0,192,192);
    for(let i=3;i<pixels.data.length;i+=4)pixels.data[i]*=.68+rand()*.32;
    c.putImageData(pixels,0,0);
    return canvas;
  }
  renderRim(w,h,head,quality){
    const scale=Math.min(quality>=2?112:176,w,h)/Math.max(w,h);
    const bw=Math.max(24,Math.round(w*scale)),bh=Math.max(24,Math.round(h*scale));
    if(!this.rim){this.rim=document.createElement('canvas');this.mask=document.createElement('canvas');}
    const resized=this.rim.width!==bw||this.rim.height!==bh;
    if(resized){this.rim.width=this.mask.width=bw;this.rim.height=this.mask.height=bh;}
    const c=this.rim.getContext('2d');c.clearRect(0,0,bw,bh);c.save();
    const video=this.video;
    if(quality<2&&video?.readyState>=2&&video.videoWidth&&video.videoHeight){
      const cover=Math.max(bw/video.videoWidth,bh/video.videoHeight);
      const dw=video.videoWidth*cover,dh=video.videoHeight*cover;
      // Sample only the underlying camera, matching its cover crop and mirroring.
      if(video.style.transform.includes('scaleX(-1)')){c.translate(bw,0);c.scale(-1,1);}
      c.filter='blur(2px)';c.drawImage(video,(bw-dw)/2,(bh-dh)/2,dw,dh);c.filter='none';
    }
    c.restore();
    for(const event of this.events){
      const intensity=atmosphereEnvelope(event.age).edge;if(intensity<.005)continue;
      const palette=PATTERN_PALETTES[event.kind];
      // Colour spills around the perimeter. Different simultaneous blooms blend locally.
      for(let i=0;i<4;i++){
        const x=[0,bw,bw*event.x,bw*(1-event.x)][i],y=[bh*.38,bh*.55,0,bh][i];
        const radius=Math.max(bw,bh)*.78;
        const gradient=c.createRadialGradient(x,y,0,x,y,radius);
        gradient.addColorStop(0,SPARK_COLORS[palette[i%3]]+'a8');
        gradient.addColorStop(.55,SPARK_COLORS[palette[i%3]]+'45');gradient.addColorStop(1,SPARK_COLORS[palette[i%3]]+'00');
        c.globalAlpha=intensity*.65/Math.sqrt(this.events.length);
        c.fillStyle=gradient;c.fillRect(0,0,bw,bh);
      }
    }
    const m=this.mask.getContext('2d');m.clearRect(0,0,bw,bh);m.save();m.translate(bw/2,bh/2);m.scale(bw*.57,bh*.57);
    const edge=m.createRadialGradient(0,0,.4,0,0,.96);
    edge.addColorStop(0,'#0000');edge.addColorStop(.32,'#0000');edge.addColorStop(.72,'#000c');edge.addColorStop(1,'#000f');
    m.fillStyle=edge;m.fillRect(-2,-2,4,4);m.restore();
    if(head){
      m.save();m.globalCompositeOperation='destination-out';m.translate(head.x/w*bw,head.y/h*bh);
      // The face remains clear even when the person moves toward a screen edge.
      m.rotate(head.angle||0);m.scale(head.rx/w*bw*1.4,head.ry/h*bh*1.25);
      const hole=m.createRadialGradient(0,0,.7,0,0,1.25);hole.addColorStop(0,'#000f');hole.addColorStop(1,'#0000');
      m.fillStyle=hole;m.fillRect(-1.3,-1.3,2.6,2.6);m.restore();
    }
    c.globalAlpha=1;c.globalCompositeOperation='destination-in';c.drawImage(this.mask,0,0);c.globalCompositeOperation='source-over';
    this.sampleAt=this.time;this.sampleQuality=quality;
  }
  draw(c,w,h,head,quality=0,strength=1){
    if(!this.events.length)return;
    c.save();c.globalCompositeOperation='source-over';
    const edge=Math.max(...this.events.map(e=>atmosphereEnvelope(e.age).edge));
    if(edge>.005){
      if(this.time-this.sampleAt>1/(quality?10:15)||this.sampleQuality!==quality||this.lastW!==w||this.lastH!==h){
        this.renderRim(w,h,head,quality);this.lastW=w;this.lastH=h;
      }
      c.globalAlpha=edge*.82*strength;c.drawImage(this.rim,0,0,w,h);
    }
    // A quieter, darker pigment bed appears during formation, beneath the clear
    // colour planes. Existing pale drifting smoke still follows the explosion.
    for(const e of this.events){
      const amount=smooth(e.age/.38)*(1-smooth((e.age-1.05)/1.35));
      if(amount<.002)continue;
      this.backdrops[e.kind]??=this.makeCloud(['#456688','#936044','#875271','#3f7175'][e.kind]);
      const radius=e.radius*Math.min(w,h),age=Math.max(0,e.age-1.05);
      const size=radius*(3.2+age*.42),x=e.x*w,y=e.y*h+radius*.1-age*radius*.12;
      c.save();
      if(head){
        // Stop the broad backing at the crown; the feathered stamp keeps this edge soft.
        const crown=head.y-Math.hypot(head.rx*Math.sin(head.angle||0),head.ry*Math.cos(head.angle||0));
        c.beginPath();c.rect(0,0,w,Math.max(0,crown));c.clip();
      }
      c.globalAlpha=amount*.38*strength/Math.sqrt(this.events.length);
      c.drawImage(this.backdrops[e.kind],x-size/2,y-size*.44,size,size*.88);
      c.restore();
    }
    for(const e of this.events){
      const amount=atmosphereEnvelope(e.age).smoke;if(amount<=0)continue;
      const age=Math.max(0,e.age-1.05),radius=e.radius*Math.min(w,h),palette=PATTERN_PALETTES[e.kind];
      for(let i=0;i<(quality>=2?2:5);i++){
        const color=palette[i%3];this.clouds[color]??=this.makeCloud(SPARK_COLORS[color]);
        const angle=i*2.39996+.4;
        const x=e.x*w+Math.cos(angle)*radius*(.26+age*.25);
        const y=e.y*h+Math.sin(angle)*radius*.18-age*(9+i*2);
        const size=radius*(.8+age*.42);
        c.globalAlpha=amount*(quality >= 2 ? .12 : .105)*strength/Math.sqrt(this.events.length);
        c.drawImage(this.clouds[color],x-size/2,y-size*.37,size,size*.74);
      }
    }
    c.restore();
  }
}
