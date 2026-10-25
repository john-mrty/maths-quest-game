import {test} from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {Track,TRACKS} from '../turbo-tables/js/track.js';
import {buildKart,CHARACTERS} from '../turbo-tables/js/karts.js';
import {Game} from '../turbo-tables/js/game.js';

// Canvas drawing is stubbed here; geometry, materials, matrices and cameras are real Three.js.
globalThis.document={createElement:()=>{
 const canvas={width:128,height:128};
 const context=new Proxy({font:'bold 120px sans-serif',measureText:t=>({width:t.length*60}),
  createImageData:(w,h)=>({data:new Uint8ClampedArray(w*h*4)}),
  getImageData:(_x,_y,w,h)=>({data:new Uint8ClampedArray(w*h*4)}),
  createRadialGradient:()=>({addColorStop(){}}),createLinearGradient:()=>({addColorStop(){}})},
  {get:(o,k)=>k in o?o[k]:()=>{}});
 canvas.getContext=()=>context;return canvas;
}};

test('meadow landmark builds finite geometry at both quality levels and keeps the racing surface aligned',()=>{
 for(const quality of ['medium','high']){
  const track=new Track(TRACKS[0],quality);
  assert.ok(track.bridgeIndex>0);assert.ok(track.mist.length>0);
  for(const t of [0,0.5,15,120])track.update(1/60,t);
  track.group.updateMatrixWorld(true);
  track.group.traverse(o=>{
   assert.ok(o.matrixWorld.elements.every(Number.isFinite));
   const positions=o.geometry?.attributes.position?.array;
   if(positions)assert.ok(positions.every(Number.isFinite));
  });
  const bridge=track.sampleAt(track.bridgeIndex);
  const deck=track.group.getObjectByName('meadow-bridge-deck'),matrix=new THREE.Matrix4();deck.getMatrixAt(9,matrix);
  assert.ok(Math.abs(new THREE.Vector3().setFromMatrixPosition(matrix).y-bridge.pos.y-0.1)<1e-6);
 }
});

test('camera remains finite through cornering and reduced motion disables camera roll and boost zoom',()=>{
 const p={pos:new THREE.Vector3(0,2,0),heading:0,speed:40,stats:{max:40},idx:0,visualSteer:1,drift:{active:false},boost:2,finished:false};
 const camera=new THREE.PerspectiveCamera(65,1.5,0.5,1500);
 const subject={player:p,camera,time:1,shake:0,reducedMotion:true,speedStreaks:{material:{}},
  track:{sampleAt:i=>({tangent:new THREE.Vector3(Math.sin(i*0.03),0,Math.cos(i*0.03))})},baseFov:()=>65};
 Game.prototype.updateCamera.call(subject,1/60);
 assert.equal(camera.fov,65);assert.equal(subject.speedStreaks.visible,false);
 const unrolled=camera.clone();unrolled.lookAt(p.pos.clone().add(new THREE.Vector3(0,1.4,7)));assert.ok(camera.quaternion.angleTo(unrolled.quaternion)<1e-6);
 subject.reducedMotion=false;Game.prototype.updateCamera.call(subject,1/60);
 assert.ok(camera.fov>65);assert.ok(camera.position.toArray().every(Number.isFinite));assert.equal(subject.speedStreaks.visible,true);
});

test('every character kart has valid wheel geometry and soft satin painted bodywork',()=>{
 for(const character of CHARACTERS){const kart=buildKart(character);assert.equal(kart.wheels.length,4);
  assert.ok(kart.mats.some(m=>m.clearcoat===0.08&&m.roughness>=0.75));
  const box=new THREE.Box3().setFromObject(kart.group);assert.ok(box.min.toArray().every(Number.isFinite));assert.ok(box.max.toArray().every(Number.isFinite));
 }
});

test('four selectable avatars include two male and two female racers with distinct head silhouettes',()=>{
 const racers=CHARACTERS.filter(c=>c.pick);assert.equal(racers.length,4);assert.equal(racers.filter(c=>c.gender==='male').length,2);assert.equal(racers.filter(c=>c.gender==='female').length,2);assert.equal(new Set(racers.map(c=>c.avatar)).size,4);
 for(const ch of racers){const k=buildKart(ch);assert.equal(k.character.userData.head.scale.x,1.35);}
});
test('intro finishes at the stationary chase camera before the start',()=>{
 for(const reducedMotion of [false,true]){
  const p={pos:new THREE.Vector3(10,2,30),heading:0.4,speed:0,stats:{max:30},idx:0,cornerSlide:0,visualSteer:0,drift:{active:false},boost:0,finished:false};
  const g={player:p,camera:new THREE.PerspectiveCamera(65,1.5,0.5,1500),countdown:0.3,reducedMotion,time:0,shake:0,speedStreaks:{material:{}},track:{sampleAt:()=>({tangent:new THREE.Vector3(0,0,1)})},baseFov:()=>65};
  Game.prototype.cameraIntro.call(g,1/60);const before=g.camera.clone();Game.prototype.updateCamera.call(g,1/60);
  assert.ok(before.position.distanceTo(g.camera.position)<1e-8);assert.ok(before.quaternion.angleTo(g.camera.quaternion)<1e-6);
 }
});
test('each starting grid has a gentle run ahead before the first major bend',()=>{
 for(const def of TRACKS){const track=new Track(def,'medium'),n=track.samples.length;const forward=track.sampleAt(n-8).tangent;
  for(let i=-12;i<=35;i+=4)assert.ok(forward.dot(track.sampleAt(i).tangent)>0.85,def.id+' start turns too sharply');
 }
});
