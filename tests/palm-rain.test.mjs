import test from 'node:test';
import assert from 'node:assert/strict';
import {PalmRain,rainStarReveal,PALM_RAIN_LIMIT} from '../palm-rain.js';
import {catchOnPalm} from '../palm.js';
import {SmileGate} from '../smile.js';
const palm={x:200,y:300,rx:40,ry:35,angle:0,previousX:200,previousY:300};
const drop={x:.5,y:.51,vy:300,size:6};
test('rain catches on the top of the palm and reveals a star only after the splash',()=>{
 const rain=new PalmRain();assert.equal(rain.catch(drop,{x:200,y:240},palm,1,400,600),true);
 assert.equal(rain.catches,1);assert.equal(rainStarReveal(.2),0);assert.ok(rainStarReveal(.5)>.999);
 rain.update(.02,palm,1);assert.ok(rain.particles[0].y<300);assert.ok(rain.particles[0].positioned);
 const oldX=rain.particles[0].x;rain.update(.02,{...palm,x:230},1);assert.equal(rain.particles[0].x,oldX+30);
 const below=new PalmRain();assert.equal(below.catch(drop,{x:200,y:310},palm,1,400,600),false);
});
test('hand rain stays bounded, expires after tracking loss, and misses continue falling',()=>{
 const rain=new PalmRain();
 for(let i=0;i<30;i++){rain.time+=.2;rain.catch(drop,{x:200,y:240},palm,1,400,600);}
 assert.equal(rain.particles.length,PALM_RAIN_LIMIT);
 assert.equal(rain.catch({...drop,x:.95},{x:380,y:240},palm,1,400,600),false);
 for(let i=0;i<25;i++)rain.update(.02,null,2);assert.equal(rain.particles.length,0);
});
test('a sideways reaching palm can catch a heart but cannot scoop rain from underneath',()=>{
 const moving={...palm,x:220,previousX:160};
 assert.ok(catchOnPalm({x:225,y:300,vy:-2,radius:10},{x:225,y:301},moving));
 assert.equal(catchOnPalm({x:225,y:300,vy:-2,radius:6},{x:225,y:301},moving,'rain'),null);
});
test('fixed ten-percent smile threshold can release again after the expression relaxes',()=>{
 const gate=new SmileGate(.1);
 for(let t=0;t<900;t+=50)gate.update(.2,true,t);assert.equal(gate.active,true);
 for(let t=900;t<2100;t+=50)gate.update(0,true,t);assert.equal(gate.active,false);assert.equal(gate.threshold,.1);
});
