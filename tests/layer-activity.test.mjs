import test from 'node:test';
import assert from 'node:assert/strict';
import {LayerActivity} from '../layer-activity.js';
import {GardenScene} from '../effects.js';
import {Fireworks} from '../fireworks.js';

test('painting sleeps after cleanup and wakes immediately without sharing layer state',()=>{
 const layers=new LayerActivity();
 assert.equal(layers.needsPaint('rain',false),false);
 assert.equal(layers.needsPaint('rain',true),true);
 assert.equal(layers.needsPaint('stars',false),false);
 assert.equal(layers.needsPaint('rain',true),true);
 assert.equal(layers.needsPaint('rain',false),true,'clear the previous image once');
 for(let i=0;i<120;i++)assert.equal(layers.needsPaint('rain',false),false);
 assert.equal(layers.needsPaint('rain',true),true,'new rain cannot wait for a polling timer');
});

test('garden keeps rendering flowers, grass and remaining splashes after rain stops',()=>{
 const s=Object.assign(Object.create(GardenScene.prototype),{grassLevel:0,drops:[],ripples:[],splashes:[],plants:[]});
 assert.equal(s.hasVisualContent,false);
 for(const field of ['drops','ripples','splashes','plants']){
  s[field]=[{}];assert.equal(s.hasVisualContent,true,field);s[field]=[];
 }
 s.grassLevel=.0001;assert.equal(s.hasVisualContent,true);
});

test('fireworks keep painting smoke, impact feedback and fading water after the last spark',()=>{
 const f=Object.assign(Object.create(Fireworks.prototype),{
  rockets:[],particles:[],shockwaves:[],impacts:[],atmosphere:{events:[]},motifLayers:{events:[]},waterGround:{opacity:0},
 });
 assert.equal(f.hasVisualContent,false);
 for(const field of ['rockets','particles','shockwaves','impacts']){
  f[field]=[{}];assert.equal(f.hasVisualContent,true,field);f[field]=[];
 }
 for(const field of ['atmosphere','motifLayers']){
  f[field].events=[{}];assert.equal(f.hasVisualContent,true,field);f[field].events=[];
 }
 f.waterGround.opacity=.0001;assert.equal(f.hasVisualContent,true);
});
