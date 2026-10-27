import {AdaptiveGraphics} from '../turbo-tables/js/graphics.js';
import {test} from 'node:test';
import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {Game,kartWallLimit,answerBoost,ANSWER_SECONDS} from '../turbo-tables/js/game.js';

function race(){
 const g=Object.create(Game.prototype),q={text:'7 × 8',answer:56,options:[54,56,63],correctIndex:1,key:'7x8'};
 let records=0,results=0;g.player={isPlayer:true,lap:0,drift:{active:false,charge:0},pos:new THREE.Vector3(),speed:30,boost:0,boostPower:1,slow:0};
 g.paused=false;g.bonusTime=ANSWER_SECONDS;g.keys={};g.quizPad=()=>[false,false,false];g.stats={asked:0,correct:0,stars:0,times:[],log:[]};
 g.sound=new Proxy({},{get:()=>()=>{}});g.ui={onQuizOpen(){},onQuizTick(){},onQuizClose(){},onQuizResult(){results++;},onFeedback(){}};
 g.progress={record(){records++;}};g.confetti=()=>{};g.bank={next:()=>({...q})};
 const gate={index:20,q,lastAskedLap:-1};g.openQuiz(gate);g.quiz.openedAt=performance.now()-1000;
 return {g,gate,records:()=>records,results:()=>results};
}
test('correct answers award a proportional boost without driving through an answer lane or double-counting',()=>{
 const early=race(),late=race();early.g.quiz.t=1;late.g.quiz.t=8;
 for(const {g,records,results} of [early,late]){g.answerQuiz(1);g.answerQuiz(0);assert.equal(records(),1);assert.equal(results(),1);g.updateQuiz(1);assert.equal(g.stats.correct,1);assert.ok(g.player.boost>0);assert.equal(g.player.laneLock,undefined);
  g.checkGate(g.player);assert.equal(g.stats.asked,1);
 }
 assert.ok(early.g.player.boost>late.g.player.boost);assert.ok(early.g.player.boostPower>late.g.player.boostPower);
 assert.ok(answerBoost(9.9).power>1);assert.equal(answerBoost(0).duration,3);
});
test('wrong answers cancel existing boosts and slow the kart after showing the correction',()=>{
 const {g}=race();g.player.boost=3;g.player.boostPower=1.6;g.answerQuiz(0);assert.equal(g.stats.correct,0);assert.ok(g.quiz.answered);
 g.updateQuiz(2);assert.equal(g.player.boost,0);assert.equal(g.player.speed,19.5);assert.equal(g.player.slow,2.2);assert.equal(g.quiz,null);
});
test('ten-second timeout records one miss, displays the answer and cannot accept a late answer',()=>{
 const {g,records}=race();g.updateQuiz(9.99);assert.equal(g.quiz.answered,false);g.updateQuiz(0.02);
 assert.equal(g.quiz.answered,true);assert.equal(g.stats.log[0].timedOut,true);assert.equal(g.stats.log[0].picked,null);assert.equal(g.stats.times[0],10);
 g.answerQuiz(1);assert.equal(records(),1);assert.equal(g.stats.correct,0);g.updateQuiz(2);assert.equal(g.player.slow,2.2);
});
test('pausing freezes the question timer, and each checkpoint asks once per lap',()=>{
 const {g,gate}=race();g.paused=true;g.updateQuiz(20);g.answerQuiz(1);assert.equal(g.quiz.t,0);assert.equal(g.stats.asked,0);
 g.paused=false;g.answerQuiz(1);g.updateQuiz(1);g.openQuiz(gate);assert.equal(g.quiz,null);
 g.player.lap=1;g.openQuiz(gate);assert.ok(g.quiz);assert.equal(gate.lastAskedLap,1);
});
test('an expired boost cannot raise the strength of a later slower answer',()=>{
 const {g}=race();g.player.boostPower=1.6;g.applyBoost(g.player,1.2,1.2);assert.equal(g.player.boostPower,1.2);
});
test('ordinary cornering develops a controlled slide which settles on a straight',()=>{
 const g=Object.create(Game.prototype),t={pos:new THREE.Vector3(),tangent:new THREE.Vector3(0,0,1),right:new THREE.Vector3(-1,0,0)};
 g.track={samples:Array(100).fill(t),sampleAt:()=>t,nearestIndex:()=>0,lateral:()=>0,heightAt:()=>0,def:{ground:0xffffff}};
 g.emit=g.checkGate=g.checkBoostPads=g.checkItemPickup=()=>{};g.sound={};
 const r={stats:{max:30,accel:12,handling:1.6},pos:new THREE.Vector3(),heading:0,speed:22,idx:0,spin:0,hop:0,slow:0,boost:0,drift:{active:false,charge:0},lateralVel:0,push:new THREE.Vector3()};
 for(let i=0;i<60;i++)g.physics(r,{throttle:1,steer:0.7},1/60);
 assert.ok(r.cornerSlide>0.4);assert.ok(r.lateralVel<0&&r.lateralVel>-3);assert.equal(r.drift.active,false);
 for(let i=0;i<120;i++)g.physics(r,{throttle:1,steer:0},1/60);assert.ok(Math.abs(r.cornerSlide)<0.001);
});
test('driving help supplies partial guidance but leaves steering and manual drift with the player',()=>{
 const g=Object.create(Game.prototype);g.track={lateral:()=>0,sampleAt:()=>({tangent:new THREE.Vector3(0,0,1)})};g.autoSteer=()=>0.7;
 const r={stats:{max:30},speed:20,idx:0,pos:new THREE.Vector3(),boost:0};
 const idle=g.easyInput(r,{steer:0},1/60),left=g.easyInput(r,{steer:-1,drift:true,driftPressed:true},1/60),right=g.easyInput(r,{steer:1},1/60);
 assert.ok(idle.steer>0&&idle.steer<0.3);assert.equal(idle.throttle,1);assert.ok(left.steer<0);assert.ok(right.steer>idle.steer);assert.equal(left.drift,true);assert.equal(left.driftPressed,true);
});
test('the visual countdown receives a declining fraction and freezes when the race is paused',()=>{
 const {g}=race(),frames=[];g.ui.onQuizTick=(fraction,seconds)=>frames.push({fraction,seconds});
 g.updateQuiz(2);g.paused=true;g.updateQuiz(4);assert.equal(frames.length,1);g.paused=false;g.updateQuiz(3);
 assert.deepEqual(frames,[{fraction:0.8,seconds:8},{fraction:0.5,seconds:5}]);
});

test('touch pad holds acceleration beyond its edge, ignores extra fingers and clears on release or interruption',()=>{
 const listeners={},classes=new Set(),pad={getBoundingClientRect:()=>({left:0,top:0,width:148}),classList:{add:x=>classes.add(x),remove:x=>classes.delete(x)},setPointerCapture(){},addEventListener:(name,fn)=>listeners[name]=fn},knob={style:{}};
 const touch={gas:false,padSteer:null},context={touch,retroController:null,tilt:{on:false},$:(id)=>id==='drivePad'?pad:knob,window:{addEventListener:(name,fn)=>listeners[name]=fn}};
 const source=fs.readFileSync(new URL('../turbo-tables/js/main.js',import.meta.url),'utf8');
 vm.createContext(context);vm.runInContext(source.slice(source.indexOf("const pad = $('drivePad')"),source.indexOf('const touchDevice=')),context);
 const event=(id,x,y)=>({pointerId:id,clientX:x,clientY:y,preventDefault(){}});
 listeners.pointerdown(event(1,74,74));assert.equal(touch.gas,true);assert.equal(touch.padSteer,0);
 listeners.pointermove(event(1,400,300));assert.equal(touch.gas,true);assert.equal(touch.padSteer,-1);
 listeners.pointerdown(event(2,0,0));listeners.pointerup(event(2,0,0));assert.equal(touch.gas,true);
 listeners.pointerup(event(1,400,300));assert.equal(touch.gas,false);assert.equal(touch.padSteer,null);
 for(const name of ['pointercancel','lostpointercapture','blur']){listeners.pointerdown(event(1,30,74));assert.ok(touch.padSteer>0);listeners[name](event(1,30,74));assert.equal(touch.gas,false);assert.equal(touch.padSteer,null);}
 context.tilt.on=true;listeners.pointerdown(event(1,10,74));assert.equal(touch.gas,true);assert.equal(touch.padSteer,null);
});
test('maths stops warn before the checkpoint and hide the cue during questions or recovery',()=>{
 const g=Object.create(Game.prototype),cues=[];
 g.track={samples:Array(200)};g.player={idx:10,lap:0};g.gateMode='stop';g.state='racing';g.gates=[{index:80,lastAskedLap:-1}];g.ui={onApproach:v=>cues.push(Boolean(v)),onQuestion(){}};
 g.updateQuestionHud();g.quiz={};g.updateQuestionHud();g.quiz=null;g.resumeDelay=0.7;g.updateQuestionHud();g.resumeDelay=0;g.gates[0].lastAskedLap=0;g.updateQuestionHud();
 assert.deepEqual(cues,[true,false,false,false]);
});
test('answer feedback returns straight to driving without an extra recovery pause',()=>{
 const {g}=race();g.answerQuiz(1);g.updateQuiz(1);assert.equal(g.quiz,null);assert.equal(g.resumeDelay,0);assert.ok(g.player.boost>0);
});

test('auto acceleration maps Down to braking and Space to item use',()=>{
 const previous=globalThis.navigator;Object.defineProperty(globalThis,'navigator',{value:{getGamepads:()=>[]},configurable:true});
 try{const g=Object.create(Game.prototype);g.autoGas=true;g.keys={};g.touch={};g.input={steer:0};g.readInput();assert.equal(g.input.throttle,1);
  g.keys={ArrowDown:true,Space:true};g.readInput();assert.equal(g.input.throttle,0);assert.equal(g.input.brake,1);assert.equal(g.input.reverse,0);assert.equal(g.input.itemPressed,true);
  g.keys={};g.readInput();assert.equal(g.input.throttle,1);assert.equal(g.input.brake,0);
 }finally{Object.defineProperty(globalThis,'navigator',{value:previous,configurable:true});}
});


test('graphics loss freezes the race and restoration waits for explicit resume',()=>{
 const g=Object.create(Game.prototype);let prevented=false,restored=null,clockReset=0,freed=0;
 Object.assign(g,{graphics:new AdaptiveGraphics(),scene:{},state:'racing',paused:false,keys:{ArrowLeft:true},sound:{setEngine(){},setTyreScrub(){}},
  ui:{onPause(){},onGraphics(value){restored=value;}},clock:{getDelta(){clockReset++;}},
  setQuality(q){this.quality=q;},composer:{passes:[{dispose(){freed++;}}],dispose(){freed++;}}});
 g.onContextLost({preventDefault(){prevented=true;}});
 assert.ok(prevented);assert.ok(g.paused);assert.ok(g.contextLost);assert.deepEqual(g.keys,{});assert.equal(restored,false);
 g.togglePause(false);assert.ok(g.paused);
 g.onContextRestored();assert.equal(g.contextLost,false);assert.equal(g.quality,'low');assert.equal(freed,2);
 assert.equal(clockReset,1);assert.equal(restored,true);assert.ok(g.paused);
 g.togglePause(false);assert.equal(g.paused,false);
});
test('mobile rendering skips post-processing allocations and releases old passes',()=>{
 const g=Object.create(Game.prototype);let freed=0;
 Object.assign(g,{quality:'medium',composer:{passes:[{dispose(){freed++;}}],dispose(){freed++;}}});
 g.buildComposer();assert.equal(g.composer,null);assert.equal(freed,2);
 g.buildComposer();assert.equal(freed,2);
});

test('answer boost haptic starts after the question closes and AI boosts stay silent',()=>{
 const {g}=race();const events=[];g.ui.onHaptic=(kind)=>events.push([kind,!!g.quiz]);
 g.answerQuiz(1);g.updateQuiz(1);assert.deepEqual(events,[['boost',false]]);
 g.applyBoost({boost:0,isPlayer:false},1,1.3);assert.equal(events.length,1);
 g.applyBoost(g.player,2,1.5);assert.equal(events.length,1);
});

test('classes 1–3 ignore manual brakes while classes 4–6 retain them',()=>{
 const previous=globalThis.navigator;Object.defineProperty(globalThis,'navigator',{value:{getGamepads:()=>[{axes:[0],buttons:Array.from({length:16},()=>({pressed:true,value:1}))}]},configurable:true});
 try{for(let id=1;id<=6;id++){
  const g=Object.create(Game.prototype);Object.assign(g,{level:{id},autoGas:true,keys:{ArrowDown:true,KeyS:true},touch:{reverse:true},input:{steer:0}});
  g.readInput();assert.equal(g.input.brake,id<=3?0:1);assert.equal(g.input.throttle,id<=3?1:0);
 }}finally{Object.defineProperty(globalThis,'navigator',{value:previous,configurable:true});}
});
function recoveryRace(easy=false){
 const g=Object.create(Game.prototype);let cue;
 Object.assign(g,{state:'racing',easy,input:{brake:0},ui:{onRecovery:v=>cue=v},track:{samples:[{tangent:new THREE.Vector3(0,0,1),right:new THREE.Vector3(1,0,0)}],lateral:pos=>pos.x},
 player:{idx:0,pos:new THREE.Vector3(0,0,10),heading:Math.PI,speed:20,push:new THREE.Vector3(),lateralVel:0,drift:{active:false,charge:0},spin:0}});
 return {g,cue:()=>cue};
}
test('wrong-way recovery warns first, turns smoothly and never advances along the track',()=>{
 const {g,cue}=recoveryRace();for(let i=0;i<10;i++)g.updateRecovery(.1);
 assert.ok(cue().includes('Follow'));assert.equal(g.player.heading,Math.PI);
 for(let i=0;i<26;i++)g.updateRecovery(.1);
 assert.ok(Math.abs(g.player.heading)<Math.PI);assert.equal(g.player.pos.z,10);assert.equal(g.player.idx,0);
 for(let i=0;i<60;i++)g.updateRecovery(.1);
 assert.ok(Math.abs(g.player.heading)<.18);assert.equal(cue(),null);
});
test('assistance recovers earlier, ordinary corners and item spins are left alone',()=>{
 const helped=recoveryRace(true),normal=recoveryRace();for(let i=0;i<20;i++){helped.g.updateRecovery(.1);normal.g.updateRecovery(.1);}
 assert.ok(helped.g.recovery.turning);assert.equal(normal.g.recovery.turning,false);
 const {g}=recoveryRace();g.player.heading=.8;for(let i=0;i<50;i++)g.updateRecovery(.1);assert.equal(g.player.heading,.8);
 g.player.heading=Math.PI;g.player.spin=1;for(let i=0;i<50;i++)g.updateRecovery(.1);assert.equal(g.recovery.trouble,0);
 g.player.spin=0;g.quiz={};g.updateRecovery(10);assert.equal(g.recovery.trouble,0);
});
test('sustained barrier scraping moves sideways towards the road without teleporting',()=>{
 const {g}=recoveryRace(true);g.player.heading=0;g.player.pos.x=12;
 for(let i=0;i<25;i++)g.updateRecovery(.1);
 assert.ok(g.player.pos.x<12);assert.ok(g.player.pos.x>0);assert.equal(g.player.pos.z,10);
});


test('barrier clearance includes kart width, nose, slide and spin on either side',()=>{
 const sample={tangent:new THREE.Vector3(0,0,1),right:new THREE.Vector3(1,0,0)};
 const g=Object.create(Game.prototype);g.track={samples:[sample],nearestIndex:()=>0,lateral:p=>p.x};
 for(const side of [-1,1]) for(const heading of [0,.4,Math.PI/2,Math.PI]) for(const spin of [0,.9]){
  const r={idx:0,pos:new THREE.Vector3(side*9.6,0,20),heading,spin,cornerSlide:.7,drift:{active:false}};
  g.keepKartInsideWalls(r);
  assert.ok(Math.abs(r.pos.x)<=kartWallLimit(r,sample)+1e-8);
  assert.equal(r.pos.z,20);assert.equal(r.idx,0);
 }
 const r={heading:0,spin:0,drift:{active:false}};
 assert.ok(kartWallLimit(r,sample)>kartWallLimit({...r,heading:Math.PI/2},sample));
});
test('racer separation against a barrier is clamped again before drawing',()=>{
 const sample={tangent:new THREE.Vector3(0,0,1),right:new THREE.Vector3(1,0,0)};
 const g=Object.create(Game.prototype);g.track={samples:[sample],nearestIndex:()=>0,lateral:p=>p.x};g.sound={};
 const kart=x=>({idx:0,pos:new THREE.Vector3(x,0,0),heading:0,spin:0,drift:{active:false},stats:{mass:1},speed:20});
 const a=kart(8),b=kart(7);g.racers=[a,b];g.collideRacers();assert.ok(a.pos.x>8);
 for(const r of g.racers)g.keepKartInsideWalls(r);
 assert.ok(a.pos.x<=kartWallLimit(a,sample));
});
