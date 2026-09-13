// Shared bitmap atlas is decoded once. Small cached cutouts keep per-frame drawing cheap.
let spritesPromise;
// Bake a lower pigment edge and an upper paper highlight into each small cutout.
// Silhouette size, sprite centre and all collision dimensions stay unchanged.
function layerPigment(sprite, shade, amount = .3) {
  const image=document.createElement('canvas');image.width=sprite.width;image.height=sprite.height;
  const c=image.getContext('2d'),offset=Math.max(2,Math.round(image.width*.023));
  c.drawImage(sprite,offset,offset*1.4);c.globalCompositeOperation='source-in';c.fillStyle=shade;c.fillRect(0,0,image.width,image.height);
  c.globalCompositeOperation='destination-out';c.drawImage(sprite,0,0);
  c.globalCompositeOperation='source-over';c.globalAlpha=amount;
  const result=document.createElement('canvas');result.width=image.width;result.height=image.height;
  const out=result.getContext('2d');out.globalAlpha=amount;out.drawImage(image,0,0);out.globalAlpha=1;out.drawImage(sprite,0,0);
  c.clearRect(0,0,image.width,image.height);c.globalAlpha=1;
  c.drawImage(sprite,0,0);c.globalCompositeOperation='destination-out';c.drawImage(sprite,offset,offset*1.4);
  c.globalCompositeOperation='source-in';c.fillStyle='#fff2d2';c.fillRect(0,0,image.width,image.height);
  out.globalAlpha=.3;out.drawImage(image,0,0);
  return result;
}
export const CRAYON_RECTS = [
  [31,95,334,337], [415,99,331,342], [793,91,342,340], [1181,108,324,336],
  [84,540,218,408], [465,540,227,407], [849,534,222,413], [1228,534,226,414],
];
export function loadCrayonSprites() {
  return spritesPromise ??= new Promise((resolve,reject)=>{
    const atlas = new Image();
    atlas.onload=()=>{
      const sprites=CRAYON_RECTS.map(rect=>{
        const canvas=document.createElement('canvas'), scale=160/Math.max(rect[2],rect[3]);
        canvas.width=Math.ceil(rect[2]*scale);canvas.height=Math.ceil(rect[3]*scale);
        canvas.getContext('2d').drawImage(atlas,...rect,0,0,canvas.width,canvas.height);
        return canvas;
      });
      const drops=sprites.slice(4);
      const whiteDrops=drops.map(sprite=>{
        const canvas=document.createElement('canvas');canvas.width=sprite.width;canvas.height=sprite.height;
        const c=canvas.getContext('2d');c.drawImage(sprite,0,0);c.globalCompositeOperation='source-atop';
        c.fillStyle='rgba(239,249,247,.82)';c.fillRect(0,0,canvas.width,canvas.height);return canvas;
      });
      // Rain keeps its existing atlas; the new matte hearts load independently.
      resolve({hearts:sprites.slice(0,4).map(s=>layerPigment(s,'#915175')),drops:drops.map(s=>layerPigment(s,'#478baf',.22)),whiteDrops:whiteDrops.map(s=>layerPigment(s,'#7baab7',.16))});
    };
    atlas.onerror=()=>reject(new Error('蜡笔素材加载失败'));
    atlas.src='./assets/crayon-hearts-rain.webp';
  });
}
export function crayonHeartRadius(index, variation=Math.random()) {
  const [min,max]=[[6,8],[9,12],[6,8],[14,16],[9,12],[6,8]][index%6];
  return min+(max-min)*Math.max(0,Math.min(1,variation));
}

let heartsPromise;
export function loadCrayonHearts(){
  return heartsPromise??=new Promise((resolve,reject)=>{
    const atlas=new Image();
    atlas.onload=()=>resolve(Array.from({length:4},(_,i)=>{
      const canvas=document.createElement('canvas');canvas.width=canvas.height=160;
      const cellW=atlas.width/2,cellH=atlas.height/2;
      // Tight, consistent cutouts preserve the actual silhouette at small particle sizes.
      const bounds=[[.09,.13,.85,.81],[.03,.14,.88,.81],[.09,.04,.85,.83],[.03,.05,.88,.83]][i];
      const [x,y,w,h]=bounds;
      const scale=156/Math.max(w*cellW,h*cellH),dw=w*cellW*scale,dh=h*cellH*scale;
      canvas.getContext('2d').drawImage(atlas,(i%2+x)*cellW,(Math.floor(i/2)+y)*cellH,w*cellW,h*cellH,(160-dw)/2,(160-dh)/2,dw,dh);
      return layerPigment(canvas,'#98516f');
    }));
    atlas.onerror=()=>reject(new Error('蜡笔爱心加载失败'));
    atlas.src='./assets/crayon-hearts-soft.webp';
  });
}

let starsPromise;
export function loadCrayonStars(){
  return starsPromise??=new Promise((resolve,reject)=>{
    const atlas=new Image();
    atlas.onload=()=>resolve(Array.from({length:4},(_,i)=>{
      const canvas=document.createElement('canvas');canvas.width=canvas.height=160;
      const cellW=atlas.width/2,cellH=atlas.height/2;
      canvas.getContext('2d').drawImage(atlas,(i%2)*cellW,Math.floor(i/2)*cellH,cellW,cellH,0,0,160,160);
      return layerPigment(canvas,'#b57b42',.32);
    }));
    atlas.onerror=()=>reject(new Error('蜡笔星星加载失败'));
    atlas.src='./assets/crayon-stars.webp';
  });
}
