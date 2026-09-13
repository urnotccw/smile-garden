import test from 'node:test';
import assert from 'node:assert/strict';
import {LaughGate,laughScore} from '../laugh.js';
import {GardenLifetime} from '../garden-lifetime.js';
import {bounceOnHead,mapHead,HeadTracker,HeartLimiter} from '../fireworks-physics.js';
import {Fireworks,patternPoints,launchPosition,fitPattern,heartStretch} from '../fireworks.js';
const categories=(left,right,jaw)=>Object.entries({mouthSmileLeft:left,mouthSmileRight:right,jawOpen:jaw}).map(([categoryName,score])=>({categoryName,score}));

test('launch positions span left, center and right above the tilted crown',()=>{
 const head={x:195,y:330,rx:65,ry:100,angle:.4};
 const crown=head.y-Math.hypot(head.rx*Math.sin(head.angle),head.ry*Math.cos(head.angle));
 for(let lane=0;lane<3;lane++)for(let i=0;i<20;i++){
  const p=launchPosition(390,600,head,lane);
  assert.ok(p.x>390*([.345,.475,.605][lane])&&p.x<390*([.395,.525,.655][lane]));
  assert.ok(p.y>0&&p.y<crown);assert.ok(p.headroom>0);
 }
 assert.equal(launchPosition(390,600,{...head,y:60},0),null);
});

test('a paired launch reserves complete patterns and uses different horizontal lanes',()=>{
 const fx=Object.assign(Object.create(Fireworks.prototype),{w:390,h:600,patterns:Array.from({length:4},(_,i)=>patternPoints(i)),particles:[],rockets:[],launchLanes:[],nextPattern:0,time:0,lastLaunch:-Infinity,headTracker:{head:null},launched:0});
 assert.equal(fx.launch(2),true);assert.equal(fx.rockets.length,2);
 assert.notEqual(fx.rockets[0].endX,fx.rockets[1].endX);
 assert.notEqual(fx.rockets[0].kind,fx.rockets[1].kind);
 assert.ok(fx.rockets[0].sizeScale/fx.rockets[1].sizeScale>1.5);
 assert.ok(fx.rockets[0].age-fx.rockets[1].age>=.3);
 assert.equal(fx.launch(2),false);
 fx.rockets=[];fx.time=2;fx.particles=Array(fx.particleLimit-100).fill({});
 assert.equal(fx.launch(2),false);assert.equal(fx.rockets.length,0);
});

test('large tilted patterns stay on screen and are clearly larger than small ones',()=>{
 const points=patternPoints(0), target={x:190,y:130,headroom:100}, angle=.45;
 const large=fitPattern(points,390,600,target,angle,.44),small=fitPattern(points,390,600,target,angle,.14);
 assert.ok(large.radius>small.radius*1.5);
 for(const p of points){
  const x=large.x+(p.x*Math.cos(angle)-p.y*Math.sin(angle))*large.radius;
  const y=large.y+(p.x*Math.sin(angle)+p.y*Math.cos(angle))*large.radius;
  assert.ok(x>=8.99&&x<=381.01&&y>=8.99&&y<=target.y+target.headroom-3.99);
 }
 assert.ok(large.y<target.y+target.headroom);
});

test('explosion motion agrees across 30, 60, 120 Hz and irregular frames',()=>{
 const make=()=>Object.assign(Object.create(Fireworks.prototype),{w:900,h:900,patterns:[patternPoints(0)],particles:[],rockets:[],shockwaves:[],time:0,bursts:0,detonations:0,headTracker:{update:()=>null},heartLimiter:new HeartLimiter()});
 const source=make();source.burst({id:0,kind:0,x:450,y:230,angle:.4,radius:160});
 const simulate=steps=>{
  const fx=make();fx.particles=structuredClone(source.particles);let elapsed=0,i=0;
  while(elapsed<2.2-1e-9){const dt=Math.min(steps[i++%steps.length],2.2-elapsed);elapsed+=dt;fx.update(dt,elapsed*1000);}
  return fx.particles;
 };
 const reference=simulate([1/120]);
 for(const steps of [[1/30],[1/60],[.012,.04,.021,.017]]){
  const particles=simulate(steps);assert.equal(particles.length,reference.length);
  particles.forEach((p,i)=>assert.ok(Math.hypot(p.x-reference[i].x,p.y-reference[i].y)<.01));
 }
});

test('three-firework cap includes rising rockets, falling stars and converted hearts',()=>{
 const fx=Object.assign(Object.create(Fireworks.prototype),{w:900,h:600,patterns:Array.from({length:4},(_,i)=>patternPoints(i)),particles:[],rockets:[],launchLanes:[],nextPattern:0,time:0,lastLaunch:-Infinity,headTracker:{head:null},launched:0});
 fx.launch(2);
 fx.particles=fx.rockets.map(r=>({fireworkId:r.id,heart:true}));fx.rockets=[];fx.time=2;
 assert.equal(fx.launch(2),true);assert.equal(fx.rockets.length,1);assert.equal(fx.activeFireworkCount,3);
 fx.time=4;assert.equal(fx.launch(2),false);
 fx.particles.shift();assert.equal(fx.launch(2),true);assert.equal(fx.activeFireworkCount,3);
});

test('a formed pattern holds still, explodes outward, then its sparks fall',()=>{
 const fx=Object.assign(Object.create(Fireworks.prototype),{
  w:900,h:900,patterns:[patternPoints(0)],particles:[],rockets:[],shockwaves:[],
  time:0,bursts:0,detonations:0,headTracker:{update:()=>null},heartLimiter:new HeartLimiter(),
 });
 fx.burst({kind:0,x:450,y:230});
 const advance=n=>{for(let i=0;i<n;i++)fx.update(1/60,fx.time*1000);};
 advance(51);
 const held=fx.particles.map(p=>({x:p.x,y:p.y}));
 advance(9);
 assert.equal(fx.detonations,0);
 assert.ok(fx.particles.every((p,i)=>p.x===held[i].x&&p.y===held[i].y&&!p.released));
 const meanRadius=()=>fx.particles.reduce((sum,p)=>sum+Math.hypot(p.x-450,p.y-230),0)/fx.particles.length;
 const before=meanRadius();advance(6);
 assert.equal(fx.detonations,1);
 assert.ok(fx.particles.filter(p=>!p.secondary).every(p=>p.released));
 assert.ok(fx.particles.filter(p=>p.secondary).every(p=>!p.released));
 assert.ok(fx.particles.filter(p=>p.secondary).length<fx.particles.length*.25);
 advance(21);
 assert.ok(fx.particles.every(p=>p.released));
 assert.ok(meanRadius()>before+20,'second impulse visibly expands the held pattern');
 advance(120);
 assert.ok(fx.particles.length>100);assert.ok(fx.particles.every(p=>p.vy>0||p.star==='water'),'gravity brings even upward explosion sparks down to the water');
 assert.equal(fx.detonations,1);
});

test('heart contact squashes, rebounds and settles without a size jump',()=>{
 const hit=heartStretch(0), rebound=heartStretch(.12), settled=heartStretch(.65);
 assert.ok(hit.x>1&&hit.y<1);assert.ok(rebound.x<1&&rebound.y>1);
 assert.ok(Math.abs(settled.x-1)<.001&&Math.abs(settled.y-1)<.001);
 let last=hit;
 for(let t=.005;t<1;t+=.005){const next=heartStretch(t);assert.ok(Math.abs(next.x-last.x)<.04&&Math.abs(next.y-last.y)<.04);last=next;}
});

test('full motifs thin into varied falling sparks without prematurely releasing rain',()=>{
 const fx=Object.assign(Object.create(Fireworks.prototype),{w:900,h:1500,patterns:[patternPoints(0)],particles:[],rockets:[],shockwaves:[],time:0,bursts:0,detonations:0,headTracker:{update:()=>null},heartLimiter:new HeartLimiter()});
 fx.burst({id:9,kind:0,x:450,y:300,radius:120});
 const total=fx.particles.length;
 assert.equal(total,patternPoints(0).length,'the complete formation remains readable');
 for(let i=0;i<105;i++)fx.update(1/60,i*1000/60);
 assert.ok(fx.particles.length>=total*.39&&fx.particles.length<=total*.41);
 assert.ok(fx.particles.every(p=>p.falling&&p.released));
 const sizes=fx.particles.map(p=>p.radius);
 assert.ok(Math.max(...sizes)/Math.min(...sizes)>2.5);
 assert.equal(fx.rainBlocked,true,'dissolving outline dust is not a landing');
 assert.equal(fx.rainGate.progress,0);
});

test('paired rockets bloom in sequence and a crown hit creates a brief contact light',()=>{
 const fx=Object.assign(Object.create(Fireworks.prototype),{w:900,h:900,patterns:Array.from({length:4},(_,i)=>patternPoints(i)),particles:[],rockets:[],shockwaves:[],impacts:[],launchLanes:[],nextPattern:0,time:0,lastLaunch:-Infinity,launched:0,bursts:0,detonations:0,heartCollisions:0,headTracker:{head:null,update:()=>null},heartLimiter:new HeartLimiter()});
 fx.launch(2);
 for(let i=0;i<72;i++)fx.update(1/60,i*1000/60);
 assert.equal(fx.bursts,1);assert.equal(fx.rockets.length,1);
 for(let i=0;i<54;i++)fx.update(1/60,1200+i*1000/60);
 assert.equal(fx.bursts,2);assert.equal(fx.rockets.length,0);
 const p=fx.particles[0];Object.assign(p,{x:200,y:92,vx:0,vy:350,radius:2,age:2,released:true});fx.particles=[p];
 fx.headTracker.update=()=>({x:200,y:200,rx:60,ry:100,previousX:200,previousY:200,angle:0,vx:0,vy:0});
 fx.update(.03,2000);assert.equal(p.heart,true);assert.equal(p.impactAge,0);assert.equal(fx.impacts.length,1);assert.ok(p.vy<0);
 fx.headTracker.update=()=>null;
 for(let i=0;i<20;i++)fx.update(1/60,2030+i*1000/60);
 assert.equal(fx.impacts.length,0);assert.ok(p.impactAge>.3);
});

test('heart conversions allow a denser stream and stop at twenty visible hearts',()=>{
 const limiter=new HeartLimiter();
 assert.equal(limiter.allow(0,0),true);
 assert.equal(limiter.allow(.04,1),false);
 assert.equal(limiter.allow(.09,1),true);
 assert.equal(limiter.allow(1,12),true);
 assert.equal(limiter.allow(2,20),false);
 assert.equal(limiter.allow(2,19),true);
 limiter.reset();assert.equal(limiter.allow(0,0),true);
});

test('laughter needs a broad open-mouth smile; speech, yawning, closed smile and asymmetry do not trigger',()=>{
 for(const c of [categories(.05,.05,.8),categories(.9,.05,.5),categories(.9,.9,.03)])assert.equal(laughScore(c),0);
 assert.ok(laughScore(categories(.85,.85,.4))>.7);
 const gate=new LaughGate();let launches=0;
 for(let t=0;t<1000;t+=50)launches+=+gate.update(laughScore(categories(.85,.85,.4)),true,t);
 assert.equal(launches,1);
 for(let t=1000;t<3000;t+=50)launches+=+gate.update(.95,true,t);
 assert.equal(launches,2);assert.equal(gate.volleySize,2);
 gate.update(.95,false,3050);assert.equal(gate.value,0);
 assert.equal(gate.volleySize,1);
 assert.equal(gate.update(.95,true,3100),false);
});
test('a brief strong expression spike does not launch fireworks',()=>{
 const gate=new LaughGate();gate.update(0,true,0);
 assert.equal(gate.update(1,true,80),false);assert.equal(gate.update(0,true,140),false);
});
test('a broad smile with a smaller mouth opening now triggers without losing closed-mouth rejection',()=>{
 const gate=new LaughGate(), score=laughScore(categories(.74,.74,.09));
 assert.ok(score>.6);let triggered=false;
 for(let t=0;t<=900;t+=50)triggered=gate.update(score,true,t)||triggered;
 assert.equal(triggered,true);assert.equal(gate.active,true);
 gate.update(0,true,950);assert.equal(gate.active,true);
 gate.update(0,true,1250);assert.equal(gate.active,false);
});
test('a strong laugh is confirmed quickly and stays active between fireworks launches',()=>{
 const gate=new LaughGate();let first=null;
 for(let t=0;t<600;t+=50)if(gate.update(.92,true,t)&&first===null)first=t;
 assert.ok(first!==null&&first<=350);assert.equal(gate.active,true);
 assert.equal(gate.update(.92,true,1500),false);assert.equal(gate.active,true);
});
test('garden waits one second before fading, resumes mid-fade, then expires after sustained relaxation',()=>{
 const life=new GardenLifetime();life.update(.9,false,true);assert.equal(life.opacity,1);
 life.update(.2,false,true);assert.ok(life.opacity<1);assert.equal(life.fading,true);
 life.update(.3,true,true);assert.equal(life.opacity,1);assert.equal(life.idle,0);
 let expired=false;for(let i=0;i<36;i++)expired=life.update(.1,false,true)||expired;
 assert.equal(expired,true);
});
test('a fast descending spark hits the head surface and reflects upward instead of tunneling',()=>{
 const h={x:200,y:200,rx:60,ry:90,angle:0,previousX:200,previousY:200,vx:0,vy:0};
 const p={x:200,y:300,vx:0,vy:900,radius:2};
 assert.equal(bounceOnHead(p,{x:200,y:40},h,.1),true);assert.ok(p.vy<0);assert.ok(p.y<110);
 const miss={x:350,y:300,vx:0,vy:900,radius:2};assert.equal(bounceOnHead(miss,{x:350,y:40},h,.1),false);
});
test('a sideways head contact does not convert a spark',()=>{
 const h={x:200,y:200,rx:60,ry:80,angle:0,previousX:100,previousY:200,vx:500,vy:0};
 const p={x:240,y:200,vx:0,vy:0,radius:2};
 assert.equal(bounceOnHead(p,{x:240,y:200},h,.1),false);
});
test('rising sparks, cheek hits and particles formed inside the head are ignored',()=>{
 const h={x:200,y:200,rx:60,ry:90,angle:0,previousX:200,previousY:200,vx:0,vy:0};
 for(const [p,old] of [
  [{x:200,y:110,vx:0,vy:-100,radius:2},{x:200,y:140}],
  [{x:160,y:200,vx:200,vy:20,radius:2},{x:100,y:190}],
  [{x:200,y:180,vx:0,vy:100,radius:2},{x:200,y:160}],
 ])assert.equal(bounceOnHead(p,old,h,.1),false);
});
test('the moving crown can catch a descending spark from above',()=>{
 const h={x:200,y:180,rx:60,ry:80,angle:0,previousX:200,previousY:220,vx:0,vy:-400};
 const p={x:200,y:122,vx:0,vy:20,radius:2};
 assert.equal(bounceOnHead(p,{x:200,y:120},h,.1),true);assert.ok(p.vy<0);
});
test('portrait head mapping mirrors and tracking loss removes the collider',()=>{
 const points=[{x:.6,y:.15},{x:.6,y:.65},{x:.45,y:.4},{x:.75,y:.4}];
 const a=mapHead(points,1280,720,390,700,false),b=mapHead(points,1280,720,390,700,true);
 assert.ok(Math.abs(a.x+b.x-390)<1e-8);assert.equal(a.ry,b.ry);
 const tracker=new HeadTracker();tracker.observe(a,100);assert.ok(tracker.update(.016,200));assert.equal(tracker.update(.016,500),null);
});
test('all four fireworks patterns contain distinct finite dot arrangements',()=>{
 const shapes=Array.from({length:4},(_,i)=>patternPoints(i));
 for(const points of shapes){assert.ok(points.length>180);assert.ok(points.length<400);assert.ok(points.every(p=>Number.isFinite(p.x)&&Number.isFinite(p.y)));}
 assert.equal(new Set(shapes.map(s=>JSON.stringify(s))).size,4);
});
