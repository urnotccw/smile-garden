// Change only decorative work. Tracking cadence and collision particles stay intact.
export class RenderQuality {
  constructor(){this.level=0;this.average=1/60;this.slow=0;this.fast=0;}
  observe(dt){
    if(dt<=0||dt>.2)return this.level;
    this.average+=(dt-this.average)*(1-Math.exp(-dt/.8));
    if(this.average>.029){this.slow+=dt;this.fast=0;}
    else if(this.average<.021){this.fast+=dt;this.slow=0;}
    else {this.slow=Math.max(0,this.slow-dt);this.fast=0;}
    if(this.slow>1.2&&this.level<2){this.level++;this.slow=0;}
    if(this.fast>6&&this.level>0){this.level--;this.fast=0;}
    return this.level;
  }
}
