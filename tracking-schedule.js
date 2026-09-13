// One shared schedule for Worker and fallback. A missed hand still gets probed;
// a briefly occluded hand keeps its fast cadence so catching does not stutter.
export class TrackingSchedule {
  constructor() { this.reset(); }
  reset() { this.faceAt = this.handAt = this.handSeen = -Infinity; }
  observeHand(found, time) { if (found) this.handSeen = time; }
  plan(time, handReady, interacting = false) {
    const wantFace = time - this.faceAt >= (interacting ? 80 : 110);
    const wantHand = handReady && time - this.handAt >= (time - this.handSeen < 450 ? 40 : 160);
    if (wantFace) this.faceAt = time;
    if (wantHand) this.handAt = time;
    return { wantFace, wantHand };
  }
}

export function cameraStatus(state) {
  if (state.busy) return '等待摄像头授权';
  if (!state.stream) return '未开启';
  if (state.trackingError) return '识别需重试';
  if (!state.trackingReady) return '正在准备识别…';
  if (state.firstInference === false) return '正在识别画面…';
  if (!state.face) return '请让面部入镜';
  if (state.handLoading) return '表情就绪 · 手势准备中';
  return state.handReady ? '表情与手势就绪' : '表情识别就绪';
}
