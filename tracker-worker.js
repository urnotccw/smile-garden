let detector,
  handDetector,
  canvas,
  ctx;
self.onmessage = async ({ data }) => {
  if (data.type === "init") {
    try {
      const { FaceLandmarker, HandLandmarker, FilesetResolver } = await import(
        "./vendor/vision_bundle.mjs"
      );
      const files = await FilesetResolver.forVisionTasks(
        new URL("./vendor/wasm/", self.location.href).href,
      );
      detector = await FaceLandmarker.createFromOptions(files, {
        baseOptions: {
          modelAssetPath: new URL("./vendor/face_landmarker.task", self.location.href).href,
          delegate: "CPU",
        },
        runningMode: "VIDEO",
        numFaces: 1,
        outputFaceBlendshapes: true,
        minFaceDetectionConfidence: 0.6,
        minFacePresenceConfidence: 0.6,
        minTrackingConfidence: 0.6,
      });
      canvas = new OffscreenCanvas(640, 480);
      ctx = canvas.getContext("2d");
      self.postMessage({ type: "ready", handReady: false, handLoading: true });
      let handError = null;
      try {
        handDetector = await HandLandmarker.createFromOptions(files, {
          baseOptions: {
            modelAssetPath: new URL("./vendor/hand_landmarker.task", self.location.href).href,
            delegate: "CPU",
          },
          runningMode: "VIDEO",
          numHands: 1,
          minHandDetectionConfidence: 0.5,
          minHandPresenceConfidence: 0.5,
          minTrackingConfidence: 0.55,
        });
      } catch (e) {
        handError = e.message;
      }
      const resources=performance.getEntriesByType('resource').map(r=>({
        file:r.name.split('/').pop(),transferSize:r.transferSize,encodedBodySize:r.encodedBodySize
      }));
      self.postMessage({ type: "hands-ready", handReady: !!handDetector, handError, resources });
    } catch (e) {
      self.postMessage({ type: "error", error: e.message });
    }
  } else if (data.type === "frame") {
    try {
      const b = data.bitmap;
      if (canvas.width !== b.width || canvas.height !== b.height) {
        canvas.width = b.width;
        canvas.height = b.height;
      }
      ctx.drawImage(b, 0, 0);
      b.close();
      // Face feedback is posted immediately, before optional hand inference.
      if (data.wantFace) {
        const started = performance.now();
        const r = detector.detectForVideo(canvas, data.time), face = r.faceLandmarks[0];
        self.postMessage({ type: 'face', time: data.time, epoch: data.epoch,
          inferenceMs: performance.now() - started,
          categories: r.faceBlendshapes[0]?.categories || [],
          eyes: face ? [face[33],face[263]] : null,
          head: face ? [face[10],face[152],face[234],face[454]] : null });
      }
      let hand = null,
        handError = null;
      const handStarted = performance.now();
      if (data.wantHand && handDetector)
        try {
          hand = handDetector.detectForVideo(canvas, data.time).landmarks[0] || null;
        } catch (e) {
          handError = e.message;
          handDetector.close();
          handDetector = null;
        }
      if (data.wantHand)
        self.postMessage({ type: "hand", epoch: data.epoch, time: data.time, hand, handError,
          inferenceMs: performance.now() - handStarted });
      // Completion alone releases the single in-flight frame.
      self.postMessage({type:'result', time:data.time, epoch:data.epoch, faceUpdated:false});
    } catch (e) {
      data.bitmap?.close();
      self.postMessage({ type: "error", error: e.message });
    }
  }
};
