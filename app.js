import { SmileGate, smileScore, clamp } from "./smile.js";
import { GardenScene } from "./effects.js";
import { PlantBrush } from "./plant-brush.js";
import { Fireworks } from "./fireworks.js";
import { LaughGate, laughScore, suppressGarden } from "./laugh.js";
import { PalmRain } from "./palm-rain.js";
import { sampleSize, RuntimeMetrics } from './runtime.js';
import { TrackingSchedule, cameraStatus, faceResultFreshness, TRACKING_TIMEOUT_MS } from './tracking-schedule.js';
import { LiveComposition } from './live-composition.js';
const schedule = new TrackingSchedule(), composition = new LiveComposition();
const metrics=new RuntimeMetrics(), debug=new URLSearchParams(location.search).has('debug');
const reducedMotion=matchMedia('(prefers-reduced-motion: reduce)');
const $ = (id) => document.getElementById(id),
  video = $("camera"),
  stage = $("stage");
// Effect parameters outlive their removed UI; preserve saved settings on this device.
const effectSettings = {threshold:10,density:10,trail:55,grow:true,wind:true,laughThreshold:60};
const gate = new SmileGate(0.1),
  scene = new GardenScene(
    $("scene"),
    undefined,
    $("plants"),
  );
const brush = new PlantBrush(scene, video);
const fireworks = new Fireworks($("fireworks"), video),
  laugh = new LaughGate();
const palmRain = new PalmRain();
scene.catchRain = (drop, previous) =>
  palmRain.catch(
    drop,
    previous,
    fireworks.palmTracker.palm,
    fireworks.palmTracker.generation,
    scene.w,
    scene.h,
  );
const state = {
  handReady: false,
  stream: null,
  busy: false,
  epoch: 0,
  facing: "user",
  demo: false,
  lastFireworksActive: false,
  face: false,
  trackingReady: false,
  trackingError: false,
  firstInference: false,
  trackingDelayed: false,
  faceRecovering: false,
  lastResult: 0,
  lastRaw: 0,
  inFlight: false,
  lastFrame: 0,
  lastFaceInference: -Infinity,
  lastVideoTime: -1,
  handLoading: false,
  clean: false,
  phone: true,
  frames: 0,
  fpsTime: 0,
  frameRate: 0,
};
let worker = null,
  beginMainHands = null,
  mainDetector = null,
  mainHandDetector = null,
  trackerPromise = null,
  watchdog = null;
const sampleCanvas = document.createElement("canvas"),
  sampleContext = sampleCanvas.getContext("2d", { willReadFrequently: true });
function setText(id, text) {
  const element = $(id);
  if (element.textContent !== text) element.textContent = text;
}
function message(text, error = false) {
  // Routine tips have been removed; actionable failures stay beside camera controls.
  $("message").hidden = !text || !error;
  $("message").textContent = error ? text : "";
  $("message").classList.toggle("error", error);
}
function cameraButtons() {
  const active = !!state.stream,
    busy = state.busy;
  $("start").querySelector("span").textContent = busy
    ? "取消开启"
    : active
      ? "关闭摄像头"
      : "开启摄像头";
  $("startHero").disabled = busy;
  $("flip").disabled = !active || busy;
  $("device").disabled = !active || busy;
}
function displayTracking(result) {
  state.face = result.face;
  state.faceRecovering = gate.recovering;
  setText('cameraTag', cameraStatus(state));
  displayLaugh();
  $("faceState").textContent = state.trackingDelayed ? "识别稍慢" : gate.recovering ? "短暂丢失 · 正在跟踪" : result.face ? "已识别人脸" : "未识别人脸";
  $("smileValue").textContent = result.face ? `${Math.round(result.value * 100)}%` : "—";
  $("smileFill").style.transform = `scaleX(${result.value})`;
  $("smileMeter").setAttribute("aria-valuenow", Math.round(result.value * 100));
  $("triggerState").textContent =
    suppressGarden(!!state.stream && !state.demo, laugh.active, fireworks.rainBlocked)
      ? "烟花中 · 暂停下雨"
      : state.demo
        ? "演示中"
        : result.active
            ? "正在下雨"
            : "尚未触发";
  cameraButtons();
}
function displayLaugh() {
  const detected=state.face && !!state.stream && !state.demo;
  const value=detected?Math.round(laugh.value*100):0;
  setText("laughValue",detected?`${value}%`:"—");
  $("laughFill").style.transform=`scaleX(${value/100})`;
  $("laughMeter").setAttribute("aria-valuenow",value);
}
function updateStage() {
  displayLaugh();
  stage.classList.toggle("camera-on", !!state.stream);
  stage.classList.toggle("demo-on", state.demo);
  $("welcome").hidden = !!state.stream || state.demo || scene.grassLevel > 0 || fireworks.active;
  const label =
    state.demo
        ? "效果演示 · 非表情识别"
        : state.stream
          ? state.trackingReady
            ? "本地摄像头 · 实时识别"
            : "摄像头已开启 · 加载识别模型"
          : "等待开启摄像头";
  $("stageLabel").lastChild.textContent = label;
  setText('cameraTag', cameraStatus(state));
  $("sceneHint").textContent = state.demo
    ? "正在演示：雨落、涟漪、花园生长"
    : "微笑下雨 · 歪头起风";
}
function resetInteraction() {
  schedule.reset();
  state.firstInference = false;
  state.trackingDelayed = false;
  laugh.reset();gate.reset();fireworks.resetTracking();brush.reset();
  state.lastRaw=0;state.lastResult=0;state.lastVideoTime=-1;state.lastFaceInference=-Infinity;
  metrics.reset();displayTracking(gate.snapshot(false));
}
function handsReady(ready) {
  state.handLoading=false;state.handReady=ready;
  metrics.markStartup('handReady');
  setText('cameraTag', cameraStatus(state));
  if(state.stream)message(ready?'微笑下雨 · 张嘴大笑放烟花。托起一只手，接住爱心和雨滴。':'表情特效已就绪；手势暂不可用，可用鼠标或触屏拨动花草。关闭并重新开启摄像头可重试。',!ready);
}
function applyMirror() {
  video.style.transform = $("mirror").checked ? "scaleX(-1)" : "none";
}
async function loadTracker() {
  if (state.trackingReady) return;
  if (trackerPromise) return trackerPromise;
  trackerPromise = (async () => {
    if (
      typeof Worker !== "undefined" &&
      typeof OffscreenCanvas !== "undefined" &&
      typeof createImageBitmap === "function"
    ) {
      try {
        await new Promise((resolve, reject) => {
          worker = new Worker("./tracker-worker.js");
          const initTimer = setTimeout(() => reject(new Error("模型初始化超时")), 35000);
          worker.onmessage = ({ data }) => {
            if (data.type === "ready") {
              clearTimeout(initTimer);
              state.handReady = data.handReady;
              state.handLoading = !!data.handLoading;
              resolve();
            } else if (data.type === 'hands-ready') {
              state.modelResources = data.resources;
              handsReady(data.handReady);
            } else if (data.type === "face") {
              if (data.epoch === state.epoch && state.stream) receiveResult(data);
            } else if (data.type === "hand") {
              if (data.epoch === state.epoch && state.stream) receiveHand(data);
            } else if (data.type === "result") {
              if(data.epoch!==state.epoch)return;
              state.inFlight = false;
              clearTimeout(watchdog);
              if (data.epoch === state.epoch && state.stream) receiveResult(data);
            } else if (data.type === "error") {
              clearTimeout(initTimer);
              if (!state.trackingReady) reject(new Error(data.error));
              else trackingFailed(data.error);
            }
          };
          worker.onerror = (e) => {
            clearTimeout(initTimer);
            if (!state.trackingReady) reject(new Error(e.message));
            else trackingFailed(e.message);
          };
          worker.postMessage({ type: "init" });
        });
        state.trackingReady = true;
        return;
      } catch (e) {
        console.warn("Worker unavailable, using main-thread tracker:", e.message);
        worker?.terminate();
        worker = null;
      }
    }
    const { FaceLandmarker, HandLandmarker, FilesetResolver } = await import(
      "./vendor/vision_bundle.mjs"
    );
    const files = await FilesetResolver.forVisionTasks("./vendor/wasm");
    const options = {
      baseOptions: { modelAssetPath: "./vendor/face_landmarker.task", delegate: "GPU" },
      runningMode: "VIDEO",
      numFaces: 1,
      outputFaceBlendshapes: true,
      minFaceDetectionConfidence: 0.6,
      minFacePresenceConfidence: 0.6,
      minTrackingConfidence: 0.6,
    };
    try {
      mainDetector = await FaceLandmarker.createFromOptions(files, options);
    } catch {
      options.baseOptions.delegate = "CPU";
      mainDetector = await FaceLandmarker.createFromOptions(files, options);
    }
    state.trackingReady=true;state.handLoading=true;
    const owner=mainDetector;
    beginMainHands = function startHands() {
      if (mainDetector !== owner) return;
      if (!state.stream) { beginMainHands = startHands; return; }
      HandLandmarker.createFromOptions(files, {
        baseOptions: { modelAssetPath: "./vendor/hand_landmarker.task", delegate: "CPU" },
        runningMode: "VIDEO",
        numHands: 1,
        minHandDetectionConfidence: 0.5,
        minHandPresenceConfidence: 0.5,
        minTrackingConfidence: 0.55,
      }).then(detector=>{
        if(mainDetector!==owner){detector.close();return;}
        mainHandDetector=detector;handsReady(true);
      }).catch(()=>{if(mainDetector===owner)handsReady(false);});
    };
  })();
  try {
    await trackerPromise;
  } catch (e) {
    trackerPromise = null;
    throw e;
  }
}
function trackingFailed(reason) {
  state.trackingError = true;
  resetInteraction();
  laugh.reset();
  fireworks.resetTracking();
  state.trackingReady = false;
  trackerPromise = null;
  state.inFlight = false;
  state.handReady = false;
  mainHandDetector?.close();
  mainHandDetector = null;
  brush.reset();

  clearTimeout(watchdog);
  worker?.terminate();
  worker = null;
  mainDetector?.close();
  mainDetector = null;
  gate.reset();
  displayTracking(gate.snapshot(false));

  message("人脸识别中断。请关闭并重新开启摄像头以重试。" + reason, true);
  updateStage();
}
function cameraError(e) {
  const texts = {
    NotAllowedError:
      "摄像头权限被拒绝。请在浏览器地址栏的网站权限中允许摄像头，然后重新开启；手机请在 Safari 或 Chrome 中打开。",
    PermissionDeniedError: "请在浏览器网站权限中允许摄像头，再重新开启。",
    NotFoundError: "没有找到摄像头。请连接摄像头，或检查系统是否禁用了设备。",
    DevicesNotFoundError: "没有找到摄像头，请连接设备后重试。",
    NotReadableError:
      "摄像头无法读取，可能被其他程序独占。请关闭占用摄像头的应用，检查系统摄像头隐私权限后重试。",
    TrackStartError: "摄像头被占用或无法启动，请关闭占用设备的应用后重试。",
    OverconstrainedError: "当前摄像头不支持请求的参数，请切换设备后重试。",
    SecurityError: "浏览器阻止了摄像头，请通过 localhost 或可信 HTTPS 页面打开。",
    AbortError: "摄像头启动被中断，请重新开启。",
  };
  return texts[e.name] || `无法开启摄像头：${e.message || e.name}。请刷新页面重试。`;
}
function stopCamera() {
  resetInteraction();
  if(state.trackingReady&&!state.handReady&&!state.handLoading){
    worker?.terminate();worker=null;mainDetector?.close();mainHandDetector?.close();
    mainDetector=mainHandDetector=null;state.trackingReady=false;trackerPromise=null;
  }
  laugh.reset();
  fireworks.resetTracking();
  brush.reset();

  state.epoch++;
  state.inFlight=false;clearTimeout(watchdog);
  state.busy = false;
  const stream = state.stream;
  state.stream = null;
  stream?.getTracks().forEach((t) => t.stop());
  video.srcObject = null;
  gate.reset();
  state.face = false;
  state.lastResult = 0;
  state.lastVideoTime = -1;

  displayTracking(gate.snapshot(false));
  cameraButtons();
  updateStage();
}
async function startCamera(deviceId) {
  if (state.busy) {
    stopCamera();
    return;
  }
  if (!window.isSecureContext || !navigator.mediaDevices?.getUserMedia) {
    message(
      "当前地址不能调用摄像头。电脑请用 http://localhost:4173；手机请用可信 HTTPS 地址打开。不要直接打开 HTML 文件或使用局域网 HTTP 地址。",
      true,
    );
    return;
  }
  stopCamera();
  state.busy = true;
  state.trackingError = false;
  metrics.beginCamera();
  const epoch = state.epoch;
  cameraButtons();
  updateStage();
  message("请在浏览器弹出的权限提示中允许使用摄像头。");
  let acquired = null;
  try {
    const constraints = {
      audio: false,
      video: {
        width: { ideal: 1280 },
        height: { ideal: 720 },
        frameRate: { ideal: 30, max: 30 },
        ...(deviceId ? { deviceId: { exact: deviceId } } : { facingMode: { ideal: state.facing } }),
      },
    };
    try {
      acquired = await navigator.mediaDevices.getUserMedia(constraints);
    } catch (e) {
      if (e.name === "OverconstrainedError" && !deviceId)
        acquired = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
      else throw e;
    }
    if (epoch !== state.epoch) {
      acquired.getTracks().forEach((t) => t.stop());
      return;
    }
    state.stream = acquired;
    video.srcObject = acquired;
    await video.play();
    if (epoch !== state.epoch) return;
    acquired.getVideoTracks()[0].addEventListener("ended", () => {
      if (state.stream === acquired) {
        stopCamera();
        message("摄像头连接已断开，请重新连接并开启。", true);
      }
    });
    state.busy = false;
    state.demo = false;
    metrics.markStartup('cameraReady');
    applyMirror();
    cameraButtons();
    updateStage();
    message("画面已连接，正在准备本地人脸识别…");
    await listDevices();
    await loadTracker();
    if (epoch !== state.epoch) return;
    metrics.markStartup('faceReady');
    message(state.handLoading?'微笑下雨 · 张嘴大笑放烟花。手势正在准备…':state.handReady?'微笑下雨 · 张嘴大笑放烟花。托起一只手，接住爱心和雨滴。':'表情特效已就绪；手势暂不可用，可用鼠标或触屏拨动花草。',!state.handLoading&&!state.handReady);
    cameraButtons();
    updateStage();
  } catch (e) {
    if (epoch !== state.epoch) {
      acquired?.getTracks().forEach((t) => t.stop());
      return;
    }
    state.busy = false;
    if (!state.stream) {
      acquired?.getTracks().forEach((t) => t.stop());
      message(cameraError(e), true);
    } else {
      state.trackingError = true;
      message(
        "摄像头已连接，但人脸模型加载失败。请确认 vendor 文件夹完整，关闭再开启摄像头重试。" +
          e.message,
        true,
      );
    }
    cameraButtons();
    updateStage();
  }
}
async function listDevices() {
  try {
    const devices = (await navigator.mediaDevices.enumerateDevices()).filter(
        (d) => d.kind === "videoinput",
      ),
      current = state.stream?.getVideoTracks()[0]?.getSettings().deviceId;
    $("device").replaceChildren(
      ...devices.map((d, i) => {
        const o = document.createElement("option");
        o.value = d.deviceId;
        o.textContent = d.label || `摄像头 ${i + 1}`;
        o.selected = d.deviceId === current;
        return o;
      }),
    );
  } catch {
    /* Camera remains usable even when device enumeration is unavailable. */
  }
}
function receiveResult(data) {
  if (data.faceUpdated === false) return;
  // Paint the first face result before the fallback initializes another model.
  if (beginMainHands) {
    const start=beginMainHands;beginMainHands=null;
    setTimeout(start, 200);
  }
  const time = performance.now(),
    hasFace = !!data.eyes;
  const freshness = faceResultFreshness(data.time, time);
  metrics.record("face",time,freshness.age);
  metrics.recordInference('face', data.inferenceMs);
  if (!freshness.expression) {
    // Discard this sample without restarting models, hand tracking or the
    // expression dwell. The independent silence timeout releases held input.
    state.trackingDelayed = true;
    displayTracking(gate.snapshot(state.face));
    return;
  }
  state.trackingDelayed = false;
  state.firstInference = true;
  fireworks.observeHead(freshness.position ? data.head : null, time, $("mirror").checked);
  if (
    laugh.update(laughScore(data.categories), hasFace, time) &&
    !state.demo &&
    state.stream
  ) {
    if (fireworks.launch(laugh.volleySize)) {
      updateStage();
    }
  }
  state.lastResult = time;
  if (hasFace) metrics.markStartup('firstFace');
  state.lastRaw = hasFace ? smileScore(data.categories) : 0;
  let tilt = 0;
  if (hasFace) {
    const [a, b] = data.eyes;
    let angle = Math.atan2((b.y - a.y) * sampleCanvas.height, (b.x - a.x) * sampleCanvas.width);
    if (angle > Math.PI / 2) angle -= Math.PI;
    if (angle < -Math.PI / 2) angle += Math.PI;
    tilt = clamp(angle / 0.5, -1, 1) * ($("mirror").checked ? -1 : 1);
  }
  const result = gate.update(state.lastRaw, hasFace, time, tilt);
  displayTracking(result);

}
function receiveHand(data) {
  const time = performance.now();
  if (data.handError) {
    handsReady(false);
  }
  if (data.time && time - data.time > 200) {
    brush.releaseHand();
    fireworks.palmTracker.reset();
    return;
  }
  schedule.observeHand(!!data.hand, time);
  if(state.handReady)metrics.record("hand",time,time-data.time);
  metrics.recordInference('hand', data.inferenceMs);
  if (data.hand) metrics.markStartup('firstHand');
  brush.hand(data.hand, time, $("mirror").checked);
  fireworks.observeHand(data.handError ? null : data.hand, time, $("mirror").checked);
}

async function trackFrame(time) {
  if (
    !state.stream ||
    !state.trackingReady ||
    state.inFlight ||
    document.hidden ||
    video.readyState < 2 ||
    video.currentTime === state.lastVideoTime ||
    time - state.lastFrame < (worker ? 40 : 65)
  )
    return;
  const plan = schedule.plan(time, state.handReady, fireworks.active);
  if (!plan.wantFace && !plan.wantHand) return;
  state.lastFrame = time;
  state.lastVideoTime = video.currentTime;
  state.inFlight = true;
  const epoch = state.epoch;
  try {
    const {width,height}=sampleSize(video.videoWidth,video.videoHeight);
    if (sampleCanvas.width !== width || sampleCanvas.height !== height) {
      sampleCanvas.width = width;
      sampleCanvas.height = height;
    }
    sampleContext.drawImage(video, 0, 0, sampleCanvas.width, sampleCanvas.height);
    if (worker) {
      const bitmap = await createImageBitmap(sampleCanvas);
      if (epoch !== state.epoch || !worker) {
        bitmap.close();
        state.inFlight = false;
        return;
      }
      worker.postMessage({ type: "frame", bitmap, time, epoch, ...plan }, [bitmap]);
      clearTimeout(watchdog);
      watchdog = setTimeout(() => trackingFailed("单帧识别超时"), 10000);
    } else {
      if (plan.wantFace) {
        const started = performance.now();
        const r = mainDetector.detectForVideo(sampleCanvas, time), face = r.faceLandmarks[0];
        receiveResult({time, inferenceMs:performance.now()-started,
          categories:r.faceBlendshapes[0]?.categories || [],
          eyes:face?[face[33],face[263]]:null,
          head:face?[face[10],face[152],face[234],face[454]]:null});
      }
      // In the fallback, allow a painted frame between the two synchronous
      // models. The Worker path does not need this main-thread yield.
      if (plan.wantFace && plan.wantHand) {
        await new Promise(resolve => requestAnimationFrame(resolve));
        if (epoch !== state.epoch || !state.stream) return;
      }
      let hand = null,
        handError = null;
      const handStarted = performance.now();
      if (plan.wantHand && mainHandDetector)
        try {
          hand = mainHandDetector.detectForVideo(sampleCanvas, time).landmarks[0] || null;
        } catch (e) {
          handError = e.message;
          mainHandDetector.close();
          mainHandDetector = null;
        }
      if (plan.wantHand) receiveHand({ hand, handError, time, inferenceMs:performance.now()-handStarted });
      state.inFlight = false;
    }
  } catch (e) {
    state.inFlight = false;
    trackingFailed(e.message);
  }
}
function saveSettings() {
  try {
    localStorage.setItem(
      "smile-garden-settings-v1",
      JSON.stringify({
        threshold: effectSettings.threshold,
        laughThreshold: effectSettings.laughThreshold,
        laughTuning: 1,
        density: effectSettings.density,
        rainTuning: 1,
        trail: effectSettings.trail,
        mirror: $("mirror").checked,
        grow: effectSettings.grow,
        wind: effectSettings.wind,
      }),
    );
  } catch {}
}
function loadSettings() {
  try {
    const s = JSON.parse(localStorage.getItem("smile-garden-settings-v1") || "null");
    if (s) {
      if (s.laughTuning !== 1 && Number.isFinite(s.laughThreshold))
        s.laughThreshold = Math.max(50, s.laughThreshold - 10);
      if (s.rainTuning !== 1 && Number.isFinite(s.density))
        s.density = Math.max(4, Math.round(s.density * 0.65));
      for (const [key, min, max] of [
        ["threshold", 5, 90],
        ["laughThreshold", 50, 90],
        ["density", 4, 36],
        ["trail", 0, 80],
      ])
        if (Number.isFinite(s[key])) effectSettings[key] = clamp(s[key], min, max);
      for (const k of ["grow", "wind"])
        if (typeof s[k] === "boolean") effectSettings[k] = s[k];
      if(typeof s.mirror === "boolean") $("mirror").checked = s.mirror;
    }
  } catch {}
}
function applySettings() {
  const threshold=effectSettings.threshold/100;
  if(gate.threshold!==threshold){gate.active=false;gate.aboveSince=null;gate.belowSince=null;}
  gate.threshold = threshold;
  $("smileThreshold").value=String(effectSettings.threshold);
  $("thresholdValue").value=`${effectSettings.threshold}%`;
  $("smileThreshold").setAttribute("aria-valuetext",`${effectSettings.threshold}%`);
  $("thresholdMark").style.left=`${effectSettings.threshold}%`;
  scene.density = effectSettings.density;
  scene.trail = effectSettings.trail / 100;
  scene.grow = effectSettings.grow;
  const laughThreshold=effectSettings.laughThreshold/100;
  if(laugh.threshold!==laughThreshold){laugh.active=false;laugh.since=null;laugh.below=null;}
  laugh.threshold = laughThreshold;
  $("laughThreshold").value=String(effectSettings.laughThreshold);
  $("laughThresholdValue").value=`${effectSettings.laughThreshold}%`;
  $("laughThreshold").setAttribute("aria-valuetext",`${effectSettings.laughThreshold}%`);
  $("laughThresholdMark").style.left=`${effectSettings.laughThreshold}%`;
  applyMirror();
  saveSettings();
}
function toggleDemo() {
  state.demo = !state.demo;

  updateStage();
  $("triggerState").textContent = state.demo ? "演示中" : "尚未触发";
  if (state.demo) message("正在演示降雨。开启摄像头后，切换为真实表情互动。");
  else message("");
}
async function enterClean() {
  state.clean = true;
  stage.classList.add("clean", "show-exit");
  document.body.style.overflow = "hidden";
  try {
    // Preserve the iPhone 15 Pro screen ratio even on a wide desktop.
    if (!state.phone) await stage.requestFullscreen?.();
  } catch {
    /* CSS full-viewport mode supports iOS and denied fullscreen requests. */
  }
  setTimeout(() => stage.classList.remove("show-exit"), 3000);
}
async function exitClean() {
  state.clean = false;
  stage.classList.remove("clean");
  document.body.style.overflow = "";
  if (document.fullscreenElement)
    try {
      await document.exitFullscreen();
    } catch {}
}
$("start").onclick = () => (state.stream || state.busy ? stopCamera() : startCamera());
$("startHero").onclick = () => startCamera();
$("demoHero").onclick = toggleDemo;
function applyPreviewFormat() {
  state.phone = $("phonePreview").checked;
  scene.phonePreview = state.phone;
  fireworks.phonePreview = state.phone;
  $("previewDevice").classList.toggle("phone-device", state.phone);
  stage.classList.toggle("phone-stage", state.phone);
  $("formatTag").textContent = state.phone ? "iPhone 15 Pro" : "16:9 横屏";
  $("phonePreviewHint").textContent = state.phone ? "iPhone 15 Pro · 393 × 852 等比预览。" : "16:9 电脑直播画幅。";
  $("phoneUiNote").hidden = !state.phone;
  // Discard old hand positions when the camera's cover crop changes.
  fireworks.resetTracking();
  palmRain.clear();
  brush.reset();
}
$("phonePreview").addEventListener("change", applyPreviewFormat);
$("desktopPreview").addEventListener("change", applyPreviewFormat);
$("smileThreshold").addEventListener("input", () => {
  effectSettings.threshold=clamp(Number($("smileThreshold").value),5,90);
  applySettings();
});
$("laughThreshold").addEventListener("input", () => {
  effectSettings.laughThreshold=clamp(Number($("laughThreshold").value),50,90);
  applySettings();
});
$("flip").onclick = async () => {
  state.facing = state.facing === "user" ? "environment" : "user";
  $("mirror").checked = state.facing === "user";
  saveSettings();
  await startCamera();
};
$("device").onchange = () => startCamera($("device").value);
$("mirror").addEventListener("input", () => {
  brush.reset();
  fireworks.resetTracking();
});
$("mirror").addEventListener("input", applySettings);
$("clean").onclick = enterClean;
$("fullscreen").onclick = enterClean;
$("exitClean").onclick = exitClean;
document.addEventListener("fullscreenchange", () => {
  if (!document.fullscreenElement && state.clean) exitClean();
});
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape") exitClean();
});
stage.addEventListener("pointerdown", () => {
  if (state.clean) {
    stage.classList.add("show-exit");
    setTimeout(() => stage.classList.remove("show-exit"), 3000);
  }
});
document.addEventListener("visibilitychange", () => {
  resetInteraction();
  laugh.reset();
  fireworks.resetTracking();
  gate.reset();
  brush.reset();

  state.lastResult = 0;

  displayTracking(gate.snapshot(false));
});
window.addEventListener("pagehide", () => {
  stopCamera();
  worker?.terminate();
  mainDetector?.close();
  mainHandDetector?.close();
  mainHandDetector = null;
  state.handReady = false;
  worker = null;
  mainDetector = null;
  state.trackingReady = false;
  trackerPromise = null;
});
navigator.mediaDevices?.addEventListener?.("devicechange", listDevices);
let previous = performance.now();
function drawTrackingGuide() {
  const c=fireworks.c, head=fireworks.headTracker.head;
  c.save();c.globalAlpha=.9;c.strokeStyle='#83e8ed';c.lineWidth=1.5;c.setLineDash([4,4]);
  if(head){
    c.beginPath();c.ellipse(head.x,head.y,head.rx,head.ry,head.angle,0,Math.PI*2);c.stroke();
    c.setLineDash([]);c.fillStyle='#83e8ed';c.font='11px sans-serif';
    c.fillText('头部碰撞代理 · 调试',Math.max(8,head.x-head.rx),Math.max(20,head.y-head.ry-8));
  }
  c.restore();
}
function loop(time) {
  requestAnimationFrame(loop);
  if(document.hidden){previous=time;return;}
  const interval=1000/60;
  if(time-previous<interval-.5)return;
  const elapsed = Math.min((time - previous) / 1000, 0.5);
  const dt = Math.min(elapsed, 0.05);
  previous = time;
  if (!document.hidden) {
    fireworks.observeFrame(elapsed);
    scene.setQuality(fireworks.renderQuality.level);
    if (state.stream?.getVideoTracks()[0]?.readyState === "ended") {
      stopCamera();
      message("摄像头连接已断开，请重新开启。", true);
    }
    trackFrame(time);
    if ((state.face || laugh.active) && time - state.lastResult > TRACKING_TIMEOUT_MS) {
      gate.reset();laugh.reset();state.lastRaw=0;
      state.trackingDelayed = true;
      fireworks.observeHead(null, time, $("mirror").checked);
      displayTracking(gate.snapshot(false));
    }
    const active =
      state.demo || !!(state.stream && state.face && gate.active);
    const wind = effectSettings.wind
      ? state.demo
        ? Math.sin(time * 0.00043) * 0.24
        : state.face
          ? gate.wind
          : 0
      : 0;
    const smiling =
      state.demo ||
      !!(
        state.stream &&
        state.face &&
        state.lastRaw >= gate.threshold - Math.min(.08,gate.threshold*.4)
      );
    const rainSuppressed = suppressGarden(
      !!state.stream && !state.demo, laugh.active, fireworks.rainBlocked,
    );
    fireworks.reducedMotion=reducedMotion.matches;
    fireworks.returningToRain=!rainSuppressed&&active;
    fireworks.update(dt, time);
    const head=fireworks.headTracker.head;
    const lowHeadroom=head && head.y-Math.hypot(head.rx*Math.sin(head.angle),head.ry*Math.cos(head.angle))-12<32;
    setText("laughState",state.demo?"降雨演示中":!state.stream||!state.face?"等待人脸":lowHeadroom?"稍微后退，留出头顶空间":laugh.active?"烟花绽放中":fireworks.rainBlocked?"星光缓缓落下":"张嘴笑一笑");
    scene.update(dt, active, wind, state.demo ? 0.7 : gate.value, smiling, elapsed, rainSuppressed);
    palmRain.update(dt, fireworks.palmTracker.palm, fireworks.palmTracker.generation);
    setText(
      "triggerState",
      rainSuppressed
        ? "烟花中 · 暂停下雨"
        : state.demo
          ? "演示中"
          : active
              ? "正在下雨"
              : "尚未触发",
    );
    scene.draw();
    brush.tick(time);
    fireworks.draw();
    palmRain.draw(fireworks.c, fireworks.starSprites, fireworks.renderQuality.level);
    const liveUI = state.phone && !state.clean;
    composition.apply(scene.plantCtx, scene.w, scene.h, liveUI);
    composition.apply(fireworks.c, fireworks.w, fireworks.h, liveUI);
    if (debug) drawTrackingGuide();
    if (state.lastFireworksActive !== fireworks.active) {
      state.lastFireworksActive = fireworks.active;
      updateStage();
    }
    const hideWelcome = !!state.stream || state.demo || scene.grassLevel > 0 || fireworks.active;
    stage.classList.toggle("fireworks-active", fireworks.active);
    if ($("welcome").hidden !== hideWelcome) $("welcome").hidden = hideWelcome;
    setText(
      "sceneHint",
      state.stream && state.trackingReady && !state.face && !state.demo
        ? "请靠近镜头，让面部完整入镜"
        : rainSuppressed
        ? "托手接爱心 · 托稳后挥手抛星星"
        : scene.lifetime.fading
          ? "微笑暂停，花园正在渐渐淡去"
          : scene.grassLevel > 0 && scene.grassLevel < 1
            ? "雨落下，草地正在慢慢变绿"
            : scene.plants.length
              ? "托手接雨变星星 · 轻拨花草"
              : "微笑下雨 · 歪头起风",
    );
    state.frames++;
    metrics.record("render",time);
    if (time - state.fpsTime > 1000) {
      state.frameRate = Math.round((state.frames * 1000) / (time - state.fpsTime));
      const m=metrics.snapshot(time);
      if(debug)$("fps").textContent=`绘制 ${m.renderFps} · 脸 ${m.faceHz}Hz · 手 ${m.handHz}Hz · 延迟p95 ${m.trackingP95Ms}ms`;
      state.frames = 0;
      state.fpsTime = time;
    }
  }
}
$("fps").hidden=!debug;
if(new URLSearchParams(location.search).has('safe')){
  const overlay=document.createElement('div');overlay.className='review-safe-layer';overlay.setAttribute('aria-hidden','true');
  overlay.innerHTML='<span class="review-avatar">头像区 · 验收示意</span><span class="review-chat">聊天区</span><span class="review-gifts">礼物区</span><span class="review-actions">底部操作区</span>';stage.append(overlay);
}
loadSettings();
applySettings();
applyPreviewFormat();
updateStage();
requestAnimationFrame(loop);
// Read-only diagnostics for integration tests and field troubleshooting; no fake expression injection.
window.gardenDiagnostics = () => ({
  secure: window.isSecureContext,
  camera: !!state.stream,
  trackState: state.stream?.getVideoTracks()[0]?.readyState || null,
  tracker: state.trackingReady,
  trackerMode: worker ? "worker" : mainDetector ? "main" : "unloaded",
  face: state.face,
  faceRecovering: state.faceRecovering,
  trackingDelayed: state.trackingDelayed,
  smile: gate.value,
  triggered: gate.active,
  demo: state.demo,
  phonePreview: state.phone,
  stageWidth: scene.w,
  stageHeight: scene.h,
  ...metrics.snapshot(performance.now()),
  sampleWidth:sampleCanvas.width,sampleHeight:sampleCanvas.height,
  reducedMotion:reducedMotion.matches,
  ...scene.stats(),
  ...fireworks.stats(),
  smileThreshold: gate.threshold,
  palmRainCatches: palmRain.catches,
  palmRainStars: palmRain.particles.length,
  laughScore: laugh.value,
  laughThreshold: laugh.threshold,
  laughing: laugh.active,
  handReady: state.handReady,
  cameraStatus: cameraStatus(state),
  qualityLevel: fireworks.renderQuality.level,
  modelResources: worker ? state.modelResources || [] : performance.getEntriesByType('resource')
    .filter(r=>r.name.includes('/vendor/')).map(r=>({file:r.name.split('/').pop(),transferSize:r.transferSize,encodedBodySize:r.encodedBodySize})),
  actualCameraSettings: (()=>{
    const s=state.stream?.getVideoTracks()[0]?.getSettings();
    return s ? {width:s.width,height:s.height,frameRate:s.frameRate,aspectRatio:s.aspectRatio,facingMode:s.facingMode} : null;
  })(),
});
setTimeout(() => {
  if (scene.assetError)
    message("植物素材未能加载，请检查 assets 文件夹中的植物图片 文件是否完整。", true);
}, 4000);
