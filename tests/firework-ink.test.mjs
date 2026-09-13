import test from 'node:test';
import assert from 'node:assert/strict';
import {faceSparkOpacity} from '../firework-ink.js';
import {bounceOnHead} from '../fireworks-physics.js';

test('face quiet zone fades only airborne decorations and follows head rotation',()=>{
  const head={x:200,y:300,rx:70,ry:100,angle:.4};
  const at=(x,y)=>({x:head.x+x*Math.cos(head.angle)-y*Math.sin(head.angle),y:head.y+x*Math.sin(head.angle)+y*Math.cos(head.angle),released:true});
  const face=at(0,25),crown=at(0,-105),outside=at(130,0);
  const before=structuredClone(face);
  assert.ok(faceSparkOpacity(face,head)<.3);
  assert.equal(faceSparkOpacity(crown,head),1);
  assert.equal(faceSparkOpacity(outside,head),1);
  for(const p of [{...face,heart:true},{...face,star:'palm'},{...face,released:false}])assert.equal(faceSparkOpacity(p,head),1);
  assert.equal(faceSparkOpacity(face,null),1);
  assert.deepEqual(face,before,'rendering cannot change collision state');
});

test('contact mark records the crown surface before the rebounding particle travels away',()=>{
  const head={x:200,y:200,rx:60,ry:90,angle:0,vx:0,vy:0};
  const p={x:200,y:145,vx:0,vy:600,radius:2};
  assert.ok(bounceOnHead(p,{x:200,y:80},head,.1));
  assert.equal(p.contact.x,200);assert.equal(p.contact.y,108);
  assert.ok(p.y<p.contact.y-2);assert.equal(p.contact.ny,-1);
});
