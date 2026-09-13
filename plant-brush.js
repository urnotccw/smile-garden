import { coverPoint, HandFilter } from "./hand.js";

export class PlantBrush {
  constructor(scene, video) {
    this.scene = scene;
    this.video = video;
    this.filters = Array.from({ length: 7 }, () => new HandFilter({ minCutoff: 4, beta: 10 }));
    this.previous = new Map();
    this.lastHand = 0;
    this.pointer = null;
    const canvas = scene.plantCanvas;
    canvas.addEventListener("pointerdown", (e) => {
      if (this.pointer !== null) return;
      e.preventDefault();
      this.pointer = e.pointerId;
      canvas.setPointerCapture(e.pointerId);
      this.previous.delete("pointer");
      this.pointerMove(e);
    });
    canvas.addEventListener("pointermove", (e) => {
      if (this.pointer !== null && e.pointerId !== this.pointer) return;
      if (e.pointerType !== "mouse" && e.pointerId !== this.pointer) return;
      this.pointerMove(e);
    });
    for (const type of ["pointerup", "pointercancel", "lostpointercapture", "pointerleave"])
      canvas.addEventListener(type, (e) => {
        if (type === "pointerleave" && this.pointer !== null) return;
        if (this.pointer !== null && e.pointerId !== this.pointer) return;
        this.pointer = null;
        this.previous.delete("pointer");
      });
  }
  pointerMove(e) {
    const r = this.scene.plantCanvas.getBoundingClientRect();
    this.motion(
      "pointer",
      { x: (e.clientX - r.left) / r.width, y: (e.clientY - r.top) / r.height },
      performance.now(),
      26,
      1,
    );
  }
  motion(key, p, time, radius, strength) {
    const old = this.previous.get(key),
      w = this.scene.w,
      h = this.scene.h;
    if (p.x < 0 || p.x > 1 || p.y < 0 || p.y > 1) {
      this.previous.delete(key);
      return;
    }
    if (old && time - old.time < 180 && old.w === w && old.h === h) {
      if (Math.hypot((p.x - old.x) * w, (p.y - old.y) * h) < 1) return;
      this.scene.brush(old, p, radius, strength);
    }
    this.previous.set(key, { ...p, time, w, h });
  }
  hand(landmarks, time, mirror) {
    if (!landmarks || landmarks.length < 21) {
      if (time - this.lastHand > 140) this.releaseHand();
      return;
    }
    this.lastHand = time;
    [9, 0, 4, 8, 12, 16, 20].forEach((index, i) => {
      const contact =
        i === 0
          ? { x: (landmarks[0].x + landmarks[9].x) / 2, y: (landmarks[0].y + landmarks[9].y) / 2 }
          : landmarks[index];
      const raw = coverPoint(
        contact,
        this.video.videoWidth || 640,
        this.video.videoHeight || 480,
        this.scene.w,
        this.scene.h,
        mirror,
      );
      const filter = this.filters[i];
      if (filter.raw && Math.hypot(raw.x - filter.raw.x, raw.y - filter.raw.y) > 0.22)
        this.previous.delete(i);
      const p = filter.update(raw, time);
      this.motion(i, p, time, i <= 1 ? 46 : 25, 1.35);
    });
  }
  tick(time) {
    if (this.lastHand && time - this.lastHand > 180) this.releaseHand();
  }
  releaseHand() {
    this.filters.forEach((filter, i) => {
      filter.reset();
      this.previous.delete(i);
    });
    this.lastHand = 0;
  }
  reset() {
    this.releaseHand();
    this.previous.clear();
  }
}
