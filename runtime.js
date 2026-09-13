export function sampleSize(width, height, limit = 640) {
  const ratio = Math.min(1, limit / Math.max(1, width, height));
  return { width: Math.max(1, Math.round(width * ratio)), height: Math.max(1, Math.round(height * ratio)) };
}
export class RuntimeMetrics {
  constructor() { this.reset(); }
  reset() { this.render=[];this.face=[];this.hand=[];this.latency=[];
    this.faceLatency=[];this.handLatency=[];this.faceInference=[];this.handInference=[]; }
  beginCamera() { this.cameraStarted=performance.now();this.startup={}; }
  markStartup(name) {
    if (this.cameraStarted == null) return;
    this.startup[name] ??= Math.round(performance.now()-this.cameraStarted);
  }
  recordInference(kind, value) {
    if (!Number.isFinite(value)) return;
    const a=this[kind+'Inference'];a.push(value);if(a.length>120)a.shift();
  }
  record(kind,time,latency) {
    const a=this[kind];a.push(time);while(a.length&&a[0]<time-2000)a.shift();
    if(Number.isFinite(latency)){
      for (const list of [this.latency,this[kind+'Latency']].filter(Boolean)) {
        list.push(Math.max(0,latency));if(list.length>120)list.shift();
      }
    }
  }
  snapshot(now) {
    const rate=list=>{const a=list.filter(t=>t>=now-2000);return a.length>1?Math.round((a.length-1)*1000/Math.max(1,a.at(-1)-a[0])):0;};
    const frames=this.render.slice(1).map((t,i)=>t-this.render[i]).sort((a,b)=>a-b),latency=[...this.latency].sort((a,b)=>a-b);
    const p95=a=>a.length?Math.round(a[Math.min(a.length-1,Math.floor(a.length*.95))]*10)/10:0;
    const percentile = list => p95([...list].sort((a,b)=>a-b));
    return {renderFps:rate(this.render),faceHz:rate(this.face),handHz:rate(this.hand),frameP95Ms:p95(frames),trackingP95Ms:p95(latency),
      faceP95Ms:percentile(this.faceLatency), handP95Ms:percentile(this.handLatency),
      faceInferenceP95Ms:percentile(this.faceInference),handInferenceP95Ms:percentile(this.handInference),
      startupMs:{...this.startup}};
  }
}
