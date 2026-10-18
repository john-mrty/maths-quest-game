const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const source=fs.readFileSync(new URL('../racer.js',`file://${__filename}`),'utf8');
test('three lives preserve score and journey after two misses, show corrections, and end on the third',()=>{
 const start=source.indexOf(' function resolve()'),end=source.indexOf(' function finish()',start);
 const nodes=new Map(),node=()=>({textContent:'',hidden:false,className:'',querySelectorAll:()=>[]});
 const h={phase:'drive',answers:[4,11,15],lane:0,q:{text:'4 + 7',answer:11},correct:2,best:5,index:2,lives:3,feedbackTime:0,boost:2,bump:0,sprintUntil:100,travel:400,fast:false,learner:{classLevel:1},audio:{sound(){}},gateRoot:{},releaseAcceleration(){},updateLives(){},updatePace(){},racePace:()=>({multiplier:1.2}),$:s=>{if(!nodes.has(s))nodes.set(s,node());return nodes.get(s);},finish(){h.phase='finish';h.finishes++;},nextQuestion(){h.phase='drive';h.feedbackTime=0;h.next++;},finishes:0,next:0};
 vm.createContext(h);vm.runInContext(source.slice(start,end),h);
 for(let miss=1;miss<=3;miss++){
  h.resolve();assert.equal(h.lives,3-miss);assert.equal(h.correct,2);assert.equal(h.travel,400);assert.equal(h.boost,0);assert.match(nodes.get('#raceQuestion').textContent,/4 \+ 7 = 11/);
  h.resolve();assert.equal(h.lives,3-miss,'feedback cannot spend another life');
  h.advanceFeedback(2.9);assert.equal(h.phase,'feedback');h.advanceFeedback(.2);
  assert.equal(h.phase,miss===3?'finish':'drive');assert.equal(h.index,Math.min(2+miss,4));
 }
 assert.equal(h.next,2);assert.equal(h.finishes,1);
 h.phase='drive';h.lives=2;h.lane=1;h.feedbackTime=0;h.resolve();assert.equal(h.lives,2);assert.equal(h.correct,3);h.advanceFeedback(.7);assert.equal(h.phase,'drive');
 h.updateRaceTime=()=>{};h.raceSeconds=125;const reset=source.slice(source.indexOf('function startRace(){')+'function startRace(){'.length,source.indexOf("fast=$('#raceMode')"));vm.runInContext(reset,h);assert.equal(h.lives,3);assert.equal(h.raceSeconds,0);
});
test('race time counts active driving and recovery but excludes pauses, hidden tabs, ready and finish',()=>{
 const start=source.indexOf(' function trackRaceTime('),end=source.indexOf(' updateRaceTime();',start);
 const h={document:{hidden:false},phase:'drive',raceSeconds:0,updateRaceTime(){}};vm.createContext(h);vm.runInContext(source.slice(start,end),h);
 h.trackRaceTime(120);h.phase='feedback';h.trackRaceTime(3);assert.equal(h.raceSeconds,123);
 for(const phase of ['pause','ready','finish']){h.phase=phase;h.trackRaceTime(600);}assert.equal(h.raceSeconds,123);
 h.phase='drive';h.document.hidden=true;h.trackRaceTime(600);assert.equal(h.raceSeconds,123);h.document.hidden=false;h.trackRaceTime(1200);assert.equal(h.raceSeconds,1323);
 assert.equal((source.match(/finish\(\);/g)||[]).length,1);assert.match(source,/if\(lives===0\)finish\(\)/);
 assert.match(source,/if\(index>=questions.length\).*questions.push/);
});
test('control hints distinguish touch and keyboard devices and update on layout changes',()=>{
 const start=source.indexOf(' function defaultSteeringCopy()'),end=source.indexOf(' touchControls.addEventListener',start);
 const copy={},h={phase:'drive',touchControls:{matches:true},steeringStatus:{},$:()=>copy};vm.createContext(h);vm.runInContext(source.slice(start,end),h);h.syncControlHints();
 assert.match(copy.textContent,/Swipe up/);assert.doesNotMatch(copy.textContent,/Spacebar|A \/ D/);assert.match(h.steeringStatus.textContent,/Tap/);
 h.touchControls.matches=false;h.syncControlHints();assert.match(copy.textContent,/Spacebar/);assert.doesNotMatch(copy.textContent,/Swipe/);assert.doesNotMatch(h.steeringStatus.textContent,/Tap|tilt/);
});
test('tilt UI and motion permission requests are removed while touch steering remains',()=>{
 assert.doesNotMatch(source,/raceTilt|deviceorientation|DeviceOrientationEvent|tiltEnabled/);
 assert.match(source,/Math\.abs\(dx\)>24\)steer/);
 assert.match(source,/Math\.abs\(dy\)<24/);
});
test('driving style restores per learner and emits preference changes',()=>{
 const start=source.indexOf(" $('#raceMode').value=learner.turboDrivingStyle"),end=source.indexOf(" $('.race-audio>span')",start),snippet=source.slice(start,end);
 function load(learner){const mode={value:''};const h={learner,$:()=>mode,hooks:{onDrivingStyle:value=>learner.turboDrivingStyle=value}};vm.createContext(h);vm.runInContext(snippet,h);return mode;}
 const alice={turboDrivingStyle:'race'},bob={};
 const a=load(alice),b=load(bob);assert.equal(a.value,'race');assert.equal(b.value,'cruise');
 a.value='cruise';a.onchange();assert.equal(alice.turboDrivingStyle,'cruise');assert.equal(bob.turboDrivingStyle,undefined);
 assert.equal(load({turboDrivingStyle:'invalid'}).value,'cruise');
 const integration=fs.readFileSync(new URL('../adventure.js',`file://${__filename}`),'utf8');
 assert.match(integration,/onDrivingStyle:style=>\{l.turboDrivingStyle=style;save\(\);\}/);
});
test('questions reveal positioned answer numbers immediately without a timer gate',()=>{
 const start=source.indexOf(' function nextQuestion()'),end=source.indexOf(' function resolve()',start),body=source.slice(start,end);
 assert.match(body,/gateRoot.visible=true/);
 assert.match(body,/\$\('\.race-gates'\).hidden=false/);
 assert.match(body,/positionAnswers\(0\)/);
 assert.doesNotMatch(source,/clock\s*[<>]=?\s*\.55/);
});
test('Space toggles pause from buttons and form controls without repeated toggles',()=>{
 const start=source.indexOf(' function key(e)'),end=source.indexOf(" document.addEventListener('keydown',key",start);
 const h={dialog:{open:true},phase:'drive',toggles:0};
 h.togglePause=()=>{h.toggles++;h.phase=h.phase==='pause'?'drive':'pause'};
 vm.createContext(h);vm.runInContext(source.slice(start,end),h);
 for(const tagName of ['BUTTON','INPUT','SELECT','CANVAS']){
  h.phase='drive';const before=h.toggles;let prevented=0,stopped=0;
  const event={code:'Space',key:' ',target:{tagName},repeat:false,preventDefault(){prevented++},stopPropagation(){stopped++}};
  h.key(event);assert.equal(h.phase,'pause');assert.equal(h.toggles,before+1);
  h.key({...event,repeat:true});assert.equal(h.toggles,before+1);
  h.key(event);assert.equal(h.phase,'drive');assert.equal(h.toggles,before+2);
  assert.equal(prevented,3);assert.equal(stopped,3);
 }
 assert.match(source,/addEventListener\('keydown',key,true\)/);
 assert.match(source,/removeEventListener\('keydown',key,true\)/);
});
