import test from 'node:test';
import assert from 'node:assert/strict';
import {downloadBytes,prepareVision,boundedInitialization,startupText} from '../tracker-resources.js';

test('runtime, wasm and face assets download concurrently and use reusable in-memory URLs',async()=>{
 const original=globalThis.fetch,started=[],pending=[],progress=[];
 globalThis.fetch=(url)=>new Promise(resolve=>{started.push(url);pending.push(()=>resolve(new Response(new Uint8Array([1,2,3]))));});
 try {
  const preparation=prepareVision({forVisionTasks:async()=>({wasmLoaderPath:'https://example.test/loader.js',wasmBinaryPath:'https://example.test/vision.wasm'})},'https://example.test/sub/app.js',p=>progress.push(p));
  await new Promise(r=>setImmediate(r));
  assert.equal(started.length,3,'all three started without awaiting the preceding resource');
  assert.equal(started[2],'https://example.test/sub/vendor/face_landmarker.task');
  pending.forEach(resolve=>resolve());const result=await preparation;
  assert.ok(result.files.wasmBinaryPath.startsWith('blob:'));
  assert.deepEqual([...result.face],[1,2,3]);
  assert.equal(progress.at(-1).loaded,9);
  globalThis.fetch=original;
  assert.equal((await fetch(result.files.wasmBinaryPath)).headers.get('content-type'),'application/wasm');
  result.dispose();await assert.rejects(fetch(result.files.wasmBinaryPath));
 }finally{globalThis.fetch=original;}
});
test('download reports byte progress and rejects HTTP errors and empty responses',async()=>{
 const original=globalThis.fetch,progress=[];
 try {
  globalThis.fetch=async()=>new Response(new Uint8Array([1,2,3]),{headers:{'content-length':'3'}});
  assert.deepEqual([...await downloadBytes('asset',{onProgress:(n,total)=>progress.push([n,total])})],[1,2,3]);
  assert.deepEqual(progress.at(-1),[3,3]);
  globalThis.fetch=async()=>new Response('missing',{status:404});
  await assert.rejects(downloadBytes('asset'),e=>e.code==='ASSET_DOWNLOAD'&&/404/.test(e.message));
  globalThis.fetch=async()=>new Response(new Uint8Array());
  await assert.rejects(downloadBytes('asset'),/为空/);
 }finally{globalThis.fetch=original;}
});
test('a stalled resource aborts instead of leaving recognition pending forever',async()=>{
 const original=globalThis.fetch;let aborted=false;
 globalThis.fetch=(_url,{signal})=>new Promise((_resolve,reject)=>signal.addEventListener('abort',()=>{aborted=true;reject(signal.reason);}));
 try{await assert.rejects(downloadBytes('asset',{stallMs:15,totalMs:100}),e=>e.code==='ASSET_DOWNLOAD'&&/超时/.test(e.message));assert.equal(aborted,true);}
 finally{globalThis.fetch=original;}
});
test('an initialization timeout disposes a late detector and never reports it ready',async()=>{
 let closed=false;
 await assert.rejects(boundedInitialization(new Promise(r=>setTimeout(()=>r({close(){closed=true;}}),35)),10),/初始化识别超时/);
 await new Promise(r=>setTimeout(r,45));assert.equal(closed,true);
 assert.equal(await boundedInitialization(Promise.resolve('ready'),100),'ready');
});
test('startup copy reports actual bytes without claiming face detection or fake percentages',()=>{
 assert.equal(startupText({phase:'download',loaded:1572864}),'下载识别资源 1.5 MB');
 assert.equal(startupText({phase:'initialize'}),'正在启动面部识别…');
});
