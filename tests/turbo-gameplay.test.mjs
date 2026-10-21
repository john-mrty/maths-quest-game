import {test} from 'node:test';
import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {Game,answerBoost,ANSWER_SECONDS} from '../turbo-tables/js/game.js';

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
 const touch={gas:false,padSteer:null},context={touch,tilt:{on:false},$:(id)=>id==='drivePad'?pad:knob,window:{addEventListener:(name,fn)=>listeners[name]=fn}};
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
