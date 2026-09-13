import test from 'node:test';
import assert from 'node:assert/strict';
import {crayonHeartRadius,CRAYON_RECTS} from '../crayon.js';
test('crayon hearts cycle through visibly distinct small, medium and large sizes',()=>{
 const sizes=Array.from({length:12},(_,i)=>crayonHeartRadius(i,.5)*3);
 assert.equal(new Set(sizes).size,3);assert.ok(Math.max(...sizes)/Math.min(...sizes)>2);
 for(let i=0;i<12;i++)assert.ok(sizes[i]>=18&&sizes[i]<=48);
});
test('crayon sprite cells remain separated and within the atlas',()=>{
 for(let i=0;i<8;i++){
  const [x,y,w,h]=CRAYON_RECTS[i];assert.ok(x>=384*(i%4)&&x+w<=384*(i%4+1));
  assert.ok(y>=512*Math.floor(i/4)&&y+h<=512*(Math.floor(i/4)+1));
 }
});
