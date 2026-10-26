import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {DRIVING,drivingDefault,drivingChoice,itemAction} from '../turbo-tables/js/driving.js';
test('class-based driving ignores stale configuration and keeps two automatic profiles',()=>{
 assert.equal(Object.keys(DRIVING).length,2);
 for(let level=1;level<=6;level++){
  assert.equal(drivingDefault(level),level<=3?'relaxed':'challenging');
  assert.equal(drivingChoice({levelId:level,easy:level>3,driving:'balanced'}),drivingDefault(level));
 }
 assert.ok(DRIVING.relaxed.speed<DRIVING.challenging.speed);
 assert.ok(DRIVING.relaxed.guidance>DRIVING.challenging.guidance);
 assert.ok(DRIVING.relaxed.pace<DRIVING.challenging.pace);
 assert.ok(DRIVING.relaxed.skill<DRIVING.challenging.skill);
});
test('ready button displays the held object, action and accessible name, and clears on use',()=>{
 const source=fs.readFileSync(new URL('../turbo-tables/js/main.js',import.meta.url),'utf8');
 const start=source.indexOf('let readyItem;'),end=source.indexOf('// ---------- Tilt',start);
 const button={hidden:true,replaceChildren(...nodes){this.nodes=nodes;},setAttribute(k,v){this[k]=v;},removeAttribute(k){delete this[k];}};
 const items={ball:{name:'Bouncy ball',hint:'Fire it ahead'},bubble:{name:'Bubble',hint:'Blocks one hit'}};
 const context=vm.createContext({$:()=>button,ITEMS:items,itemAction,document:{createElement:()=>({})}});
 vm.runInContext(source.slice(start,end),context);
 vm.runInContext('renderReadyItem("ball")',context);assert.equal(button.hidden,false);assert.equal(button.nodes[0].src,'icons/ball.svg');assert.equal(button.nodes[1].textContent,'Shoot');assert.match(button['aria-label'],/Bouncy ball/);
 vm.runInContext('renderReadyItem("bubble")',context);assert.equal(button.nodes[1].textContent,'Protect');
 vm.runInContext('renderReadyItem(null)',context);assert.equal(button.hidden,true);assert.equal(button.nodes.length,0);
 for(const id of ['ball','bubble','jelly','rocket'])assert.ok(fs.existsSync(new URL(`../turbo-tables/icons/${id}.svg`,import.meta.url)));
});
