// Readiness of a model says nothing about whether the camera is producing frames.
export class VideoHealth {
  reset(now=0){this.time=null;this.progressAt=now;}
  constructor(){this.reset();}
  stalled(video,now,muted=false){
    if(this.time===null||video.currentTime!==this.time){this.time=video.currentTime;this.progressAt=now;}
    return video.paused || muted || video.readyState<2 || now-this.progressAt>1400;
  }
}
