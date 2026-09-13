// Only bundled, version-pinned assets are fetched. No camera pixels leave the device.
export async function downloadBytes(url, {onProgress=()=>{}, signal, stallMs=12000, totalMs=45000}={}) {
  const controller=new AbortController();let idle,timeout;
  const abort=()=>controller.abort(signal?.reason);
  if(signal?.aborted)abort();else signal?.addEventListener('abort',abort,{once:true});
  const stalled=()=>controller.abort(new Error('下载识别资源超时，请检查网络后重试'));
  const touch=()=>{clearTimeout(idle);idle=setTimeout(stalled,stallMs);};
  timeout=setTimeout(stalled,totalMs);touch();
  try {
    const response=await fetch(url,{signal:controller.signal,cache:'force-cache'});
    if(!response.ok)throw new Error(`识别资源下载失败（HTTP ${response.status}）`);
    const total=Number(response.headers.get('content-length'))||0;
    if(!response.body?.getReader){const data=new Uint8Array(await response.arrayBuffer());onProgress(data.length,total);return data;}
    const reader=response.body.getReader(),chunks=[];let loaded=0;
    for(;;){const {done,value}=await reader.read();if(done)break;chunks.push(value);loaded+=value.length;touch();onProgress(loaded,total);}
    if(!loaded)throw new Error('识别资源为空，请重试');
    const data=new Uint8Array(loaded);let offset=0;
    for(const chunk of chunks){data.set(chunk,offset);offset+=chunk.length;}
    return data;
  } catch(error) {
    const failure=new Error(controller.signal.aborted ? (controller.signal.reason?.message||'识别准备已取消') : error.message);
    failure.code='ASSET_DOWNLOAD';throw failure;
  } finally {clearTimeout(idle);clearTimeout(timeout);signal?.removeEventListener('abort',abort);}
}

export async function prepareVision(resolver, base, onProgress=()=>{}) {
  const paths=await resolver.forVisionTasks(new URL('./vendor/wasm/',base).href);
  const controller=new AbortController(),loaded=[0,0,0];let lastReport=0;
  const urls=[paths.wasmLoaderPath,paths.wasmBinaryPath,new URL('./vendor/face_landmarker.task',base).href];
  onProgress({phase:'download',loaded:0});
  let bytes;
  try {
    bytes=await Promise.all(urls.map((url,i)=>downloadBytes(url,{signal:controller.signal,onProgress:n=>{
      loaded[i]=n;
      if(Date.now()-lastReport>=100){lastReport=Date.now();onProgress({phase:'download',loaded:loaded.reduce((a,b)=>a+b,0)});}
    }})));
  } catch(e){controller.abort();throw e;}
  onProgress({phase:'download',loaded:loaded.reduce((a,b)=>a+b,0)});
  // Feed in-memory URLs to MediaPipe so the runtime and model download in
  // parallel, with progress/timeout control and no second network fetch.
  const loader=URL.createObjectURL(new Blob([bytes[0]],{type:'text/javascript'}));
  const wasm=URL.createObjectURL(new Blob([bytes[1]],{type:'application/wasm'}));
  return {files:{wasmLoaderPath:loader,wasmBinaryPath:wasm},face:bytes[2],
    dispose(){URL.revokeObjectURL(loader);URL.revokeObjectURL(wasm);}};
}

export function boundedInitialization(promise, milliseconds=18000) {
  return new Promise((resolve,reject)=>{
    let expired=false;
    const timer=setTimeout(()=>{expired=true;reject(new Error('初始化识别超时，请重新开启摄像头'));},milliseconds);
    promise.then(value=>{clearTimeout(timer);if(expired)value?.close?.();else resolve(value);},error=>{clearTimeout(timer);if(!expired)reject(error);});
  });
}

export function startupText(progress) {
  return progress?.phase==='download' ? `下载识别资源 ${(progress.loaded/1048576).toFixed(1)} MB` : '正在启动面部识别…';
}
