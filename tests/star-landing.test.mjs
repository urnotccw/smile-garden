import test from 'node:test';
import assert from 'node:assert/strict';
import {mapPalm,PalmTracker,catchOnPalm} from '../palm.js';
import {landStar,updateLandedStar,waterline,waterStarMotion,WATER_STAR_LIMIT,PALM_STAR_LIMIT} from '../star-landing.js';
import {Fireworks} from '../fireworks.js';
import {HeartLimiter} from '../fireworks-physics.js';

function hand(){
 const p=Array.from({length:21},()=>({x:.5,y:.8}));
 for(const [i,x] of [[5,.4],[9,.47],[13,.54],[17,.61]])for(let j=0;j<4;j++)p[i+j]={x,y:.62-j*.065};
 return p;
}
const palm={x:200,y:400,rx:45,ry:35,angle:0,previousX:200,previousY:400};
test('palm mapping accepts an open hand, mirrors and rejects closed or missing hands',()=>{
 const p=hand(),a=mapPalm(p,640,480,390,600,false),b=mapPalm(p,640,480,390,600,true);
 assert.ok(a);assert.ok(Math.abs(a.x+b.x-390)<.001);assert.equal(a.y,b.y);
 for(const i of [5,9,13,17])p[i+3]={x:p[i].x,y:.76};
 assert.equal(mapPalm(p,640,480,390,600,false),null);assert.equal(mapPalm(null,640,480,390,600,false),null);
});
test('swept palm catches falling or overlapping hearts, ignores rising and distant misses',()=>{
 const heart={x:200,y:415,vy:400,radius:10};
 assert.ok(catchOnPalm(heart,{x:200,y:320},palm));
 assert.equal(catchOnPalm({...heart,vy:-40},{x:200,y:420},palm),null);
 assert.equal(catchOnPalm({...heart,x:280},{x:280,y:320},palm),null);
 assert.ok(catchOnPalm(heart,{x:200,y:395},palm));
 assert.equal(catchOnPalm(heart,{x:200,y:395},palm,'rain'),null);
 assert.ok(catchOnPalm(heart,{x:200,y:320},{...palm,angle:.65}));
});
test('tracking expires promptly and a distant reappearance creates a new attachment identity',()=>{
 const tracker=new PalmTracker();tracker.observe(palm,100);tracker.update(.016,100);const id=tracker.generation;
 assert.equal(tracker.update(.016,321),null);
 tracker.observe({...palm,x:600},330);assert.notEqual(id,tracker.generation);
});
test('caught hearts become bounded stars that follow their palm and release on loss',()=>{
 const p={x:200,y:415,vy:400,radius:10,heart:true,age:1,life:7},counts={palm:0,water:0};
 assert.ok(landStar(p,{x:200,y:320},palm,7,400,600,counts));
 assert.equal(p.star,'palm');assert.equal(p.heart,false);assert.ok(p.starSize>=25&&p.starSize<=43);
 const x=p.x;updateLandedStar(p,{...palm,x:220},7,.016);assert.equal(p.x,x+20);
 updateLandedStar(p,{...palm,x:350},8,.016);assert.ok(p.x<300);assert.ok(p.life<=.4);
 const full={palm:PALM_STAR_LIMIT,water:0};
 assert.equal(landStar({x:200,y:415,vy:400,radius:10,heart:true,age:1,life:7},{x:200,y:320},palm,7,400,600,full),false);
});
test('only descending released fireworks crossing the water become small stars, with a bounded count',()=>{
 const y=waterline(200,400,600),make=()=>({x:200,y:y+20,vy:400,radius:2,heart:false,released:true,age:3,life:7});
 const counts={palm:0,water:0};
 const airborne={...make(),y:y-1};assert.equal(landStar(airborne,{x:200,y:y-20},null,0,400,600,counts),false);
 for(let i=0;i<40;i++){
  const p=make(),landed=landStar(p,{x:200,y:y-20},null,0,400,600,counts);
  assert.equal(landed,i<WATER_STAR_LIMIT);
  if(landed){assert.equal(p.y,y);assert.ok(p.starSize>=10&&p.starSize<=44);assert.equal(p.star,'water');}
 }
 assert.equal(counts.water,WATER_STAR_LIMIT);
 assert.equal(waterStarMotion(0,30).reveal,0);
 const jumping={star:'water',waterX:200,waterY:y,starSize:30,age:.4,phase:0};
 updateLandedStar(jumping,null,0,1/60);assert.ok(jumping.y<y-25);
 jumping.age=.74;updateLandedStar(jumping,null,0,1/60);assert.ok(Math.abs(jumping.y-y)<.001);
 assert.equal(landStar({...make(),released:false},{x:200,y:y-20},null,0,400,600,counts),false);
 assert.equal(landStar({...make(),vy:-20},{x:200,y:y-20},null,0,400,600,counts),false);
});
test('fireworks update transforms a falling heart on the palm and water stars expire without re-exploding',()=>{
 const tracker=new PalmTracker();tracker.observe(palm,0);
 const fx=Object.assign(Object.create(Fireworks.prototype),{w:400,h:600,time:0,rockets:[],shockwaves:[],particles:[],headTracker:{update:()=>null},palmTracker:tracker,heartLimiter:new HeartLimiter()});
 fx.particles=[{fireworkId:1,x:200,y:348,vy:500,vx:0,radius:10,heart:true,age:1,life:7,lastHit:0}];
 fx.update(.05,50);assert.equal(fx.particles[0].star,'palm');assert.equal(fx.palmCatches,1);
 const floor=waterline(100,400,600);
 fx.particles.push({fireworkId:2,x:100,y:floor-4,vx:0,vy:300,gravity:180,radius:2,age:4,life:7,released:true,headContacted:true,lastHit:0});
 fx.update(.05,100);assert.equal(fx.waterLandings,1);assert.equal(fx.activeFireworkCount,2);
 for(let i=0;i<180;i++)fx.update(1/60,100+i*1000/60);
 assert.equal(fx.particles.length,0);
});

test('nearby water impacts do not stack stars on one spot',()=>{
 const y=waterline(200,400,600),counts={water:0,palm:0,waterSites:[]};
 const make=x=>({x,y:y+10,vy:100,radius:2,released:true,age:3,life:7});
 assert.equal(landStar(make(200),{x:200,y:y-10},null,0,400,600,counts),true);
 const nearby=make(208);assert.equal(landStar(nearby,{x:208,y:y-10},null,0,400,600,counts),false);assert.equal(nearby.life,0);
 assert.equal(landStar(make(235),{x:235,y:y-10},null,0,400,600,counts),true);
 assert.equal(counts.water,2);
});

test('portrait hearts only turn into rippling water stars when descending across the water',()=>{
 const floor=waterline(200,400,600),make=()=>({x:200,y:floor+8,vx:0,vy:300,radius:10,heart:true,heartVariant:2,released:true,age:2,life:8});
 const counts=()=>({water:0,palm:0,waterSites:[]});
 assert.equal(landStar(make(),{x:200,y:floor-8},null,0,400,600,counts(),false),false,'desktop behavior stays unchanged');
 assert.equal(landStar({...make(),vy:-100},{x:200,y:floor+12},null,0,400,600,counts(),true),false,'a rising rebound cannot land');
 assert.equal(landStar({...make(),y:floor-1},{x:200,y:floor-8},null,0,400,600,counts(),true),false,'no transformation before water contact');
 const heart=make(),c=counts();assert.equal(landStar(heart,{x:200,y:floor-20},null,0,400,600,c,true),true);
 assert.equal(heart.star,'water');assert.equal(heart.heart,false);assert.equal(heart.waterY,floor);assert.equal(c.water,1);
 assert.equal(waterStarMotion(heart.age,heart.starSize).reveal,0,'the water responds before the star jumps');
 heart.age=.3;updateLandedStar(heart,null,0,1/60,400,600);assert.ok(heart.y<floor);
 const held=make(),palmCounts=counts();
 assert.equal(landStar(held,{x:200,y:floor-60},{...palm,y:floor,previousY:floor},1,400,600,palmCounts,true),true);
 assert.equal(held.star,'palm','a palm near the bottom catches the heart before the water');
 assert.equal(palmCounts.waterSites.length,0);assert.equal(palmCounts.water,0);
});

test('portrait fireworks update counts heart landings and activates the blue water background',()=>{
 let impacts=0;const floor=waterline(180,400,600);
 const fx=Object.assign(Object.create(Fireworks.prototype),{phonePreview:true,w:400,h:600,time:0,rockets:[],shockwaves:[],particles:[],headTracker:{update:()=>null},palmTracker:new PalmTracker(),heartLimiter:new HeartLimiter(),waterGround:{update(){},impact(){impacts++;}}});
 fx.particles=[{fireworkId:1,x:180,y:floor-5,vx:0,vy:300,radius:10,heart:true,age:2,life:8,lastHit:0}];
 fx.update(.05,50);assert.equal(fx.particles[0].star,'water');assert.equal(fx.waterLandings,1);assert.equal(impacts,1);
});
