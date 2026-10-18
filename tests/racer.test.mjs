import {test} from 'node:test';
import assert from 'node:assert/strict';
import {raceQuestions,gateAnswers,drivingSpeed,approachDistance,racePace,formatRaceTime} from '../racer.js';
test('race duration displays minutes and seconds without an upper time limit',()=>{
 assert.equal(formatRaceTime(0),'0:00');assert.equal(formatRaceTime(125.8),'2:05');assert.equal(formatRaceTime(7205),'120:05');assert.equal(formatRaceTime(-3),'0:00');assert.equal(formatRaceTime(NaN),'0:00');
});
test('every class gets eight unique, correct, age-banded racing facts',()=>{
 for(let level=1;level<=6;level++)for(let run=0;run<100;run++){
 const qs=raceQuestions(level);assert.equal(qs.length,8);assert.equal(new Set(qs.map(q=>q.text)).size,8);assert.equal(new Set(qs.map(q=>[Math.min(q.a,q.b),q.op,Math.max(q.a,q.b)].join(':'))).size,8);
 for(const q of qs){assert.equal(q.answer,q.op==='+'?q.a+q.b:q.a*q.b);if(level<3)assert.ok(q.answer<=20);else if(level<5)assert.ok([2,3,4,5,10].includes(q.a));const gates=gateAnswers(q);assert.equal(new Set(gates).size,3);assert.ok(gates.includes(q.answer));assert.ok(gates.every(n=>Number.isInteger(n)&&n>=0));}
 }
});
test('accelerating genuinely closes distance faster, while bumps and boosts change speed',()=>{
 for(const fast of [false,true]){
  const base=drivingSpeed(fast,false,0,0);
  assert.ok(drivingSpeed(fast,true,0,0)>base);assert.ok(drivingSpeed(fast,false,1,0)>base);
  assert.ok(drivingSpeed(fast,false,0,1)<base);
  assert.ok(96/drivingSpeed(fast,true,0,0)<96/base);
 }
 assert.ok(drivingSpeed(true,false,0,0)>drivingSpeed(false,false,0,0));
});
test('endless race approaches get shorter with success and cap at exactly four times starting pace',()=>{
 for(const fast of [false,true])for(let level=1;level<=6;level++){
  const start=approachDistance(0,fast,level);
  let previous=Infinity;
  for(let score=0;score<1000;score++){const distance=approachDistance(score,fast,level),pace=racePace(score,fast,level);assert.ok(distance<=previous);assert.ok(distance>=start/4);assert.ok(pace.multiplier<=4);assert.ok(pace.percent>=0&&pace.percent<=100);previous=distance;}
  assert.ok(approachDistance(10,fast)<approachDistance(0,fast));
  assert.ok(approachDistance(3,fast)<=approachDistance(0,fast)*.6);
  assert.ok(racePace(3,fast).multiplier>1.6);
  assert.equal(racePace(0,fast).percent,0);
  assert.equal(racePace(1000,fast).percent,100);
  assert.equal(racePace(1000,fast,level).multiplier,4);
  assert.equal(approachDistance(1000,fast,level),start/4);
 }
});
test('only first class gets slower driving and a gentler difficulty ramp',()=>{
 for(const fast of [false,true]){
  const junior=drivingSpeed(fast,false,0,0,1),normal=drivingSpeed(fast,false,0,0,2);
  assert.equal(junior,normal*.85);
  assert.ok(approachDistance(3,fast,1)>approachDistance(3,fast,2));
  assert.ok(racePace(3,fast,1).multiplier<racePace(3,fast,2).multiplier);
  assert.ok(drivingSpeed(fast,true,0,0,1)>junior);
  for(let level=2;level<=6;level++){assert.equal(drivingSpeed(fast,false,0,0,level),normal);assert.equal(approachDistance(3,fast,level),approachDistance(3,fast));}
 }
});
