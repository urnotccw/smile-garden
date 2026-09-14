// A stable Image and readiness promise survive transient failures. Waiting for
// explicit/network recovery after three attempts consumes no timers or requests.
export class Artwork {
  constructor({makeImage=()=>new Image(), timeout=12000, delays=[800,2000]}={}) {
    this.assets=new Map();this.listeners=new Set();this.makeImage=makeImage;
    this.timeout=timeout;this.delays=delays;
  }
  notify(){for(const fn of this.listeners)fn(this.status());}
  subscribe(fn){this.listeners.add(fn);return()=>this.listeners.delete(fn);}
  status(){const all=[...this.assets.values()];return {
    loading:all.filter(a=>a.state==='loading').length,
    retrying:all.filter(a=>a.state==='retrying').length,
    failed:all.filter(a=>a.state==='failed').length,
  };}
  get(url){
    if(this.assets.has(url))return this.assets.get(url);
    const asset={url,image:this.makeImage(),state:'loading',attempt:0,requests:0,timer:null};
    asset.ready=new Promise(resolve=>asset.resolve=resolve);
    this.assets.set(url,asset);this.start(asset);return asset;
  }
  start(a){
    clearTimeout(a.timer);a.state='loading';a.attempt++;a.requests++;
    let settled=false;
    a.image.onload=()=>{
      if(settled)return;settled=true;clearTimeout(a.timer);
      a.state='ready';a.resolve(a.image);this.notify();
    };
    const fail=()=>{
      if(settled)return;settled=true;clearTimeout(a.timer);
      a.image.onload=a.image.onerror=null;
      a.image.removeAttribute?.('src');
      a.state=a.attempt<=this.delays.length?'retrying':'failed';
      if(a.state==='retrying')a.timer=setTimeout(()=>this.start(a),this.delays[a.attempt-1]);
      this.notify();
    };
    a.image.onerror=fail;a.timer=setTimeout(fail,this.timeout);
    const suffix=a.requests>1?`${a.url.includes('?')?'&':'?'}artRetry=${a.requests}`:'';
    a.image.src=a.url+suffix;this.notify();
  }
  retry(){for(const a of this.assets.values())if(a.state==='failed'){a.attempt=0;this.start(a);}}
}
export const artwork=new Artwork();
if(typeof window!=='undefined')window.addEventListener('online',()=>artwork.retry());
