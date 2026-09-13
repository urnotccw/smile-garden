import test from 'node:test';
import assert from 'node:assert/strict';
import {Fireworks,patternPoints} from '../fireworks.js';
import {HeartLimiter} from '../fireworks-physics.js';
test('five simulated minutes of sustained laughter keep particle pools bounded and drain after stopping',()=>{
 const fx=Object.assign(Object.create(Fireworks.prototype),{w:900,h:700,patterns:Array.from({length:4},(_,i)=>patternPoints(i)),particles:[],rockets:[],shockwaves:[],impacts:[],launchLanes:[],nextPattern:0,time:0,lastLaunch:-Infinity,launched:0,bursts:0,detonations:0,headTracker:{head:null,update:()=>null},heartLimiter:new HeartLimiter()});
 let peak=0;
 for(let i=0;i<9000;i++){
  if(i%48===0)fx.launch(2);fx.update(1/30,i*1000/30);peak=Math.max(peak,fx.particles.length);
  assert.ok(fx.particles.length<=fx.particleLimit);assert.ok(fx.activeFireworkCount<=3);
  assert.ok(fx.particles.every(p=>Number.isFinite(p.x)&&Number.isFinite(p.y)));
 }
 assert.ok(peak>300);
 for(let i=0;i<600;i++)fx.update(1/30,300000+i*1000/30);
 assert.equal(fx.particles.length,0);assert.equal(fx.rockets.length,0);assert.equal(fx.shockwaves.length,0);
});
