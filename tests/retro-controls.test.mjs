import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createRetroControls} from '../turbo-tables/js/retro-controls.js';
function rig(){
 const events={},directions=[],brakes=[];let enabled=true,actions=0;
 const buttons=Object.fromEntries(['left','right','action','brake'].map(kind=>[kind,{dataset:{retro:kind},classList:{add(){},remove(){}},setPointerCapture(){},closest(){return this;}}]));
 const surface={contains:()=>true,addEventListener:(n,fn)=>events[n]=fn,removeEventListener:n=>delete events[n]};
 const controller=createRetroControls(surface,{enabled:()=>enabled,direction:(v,p)=>directions.push([v,p]),brake:v=>brakes.push(v),action:()=>actions++});
 return {controller,events,directions,brakes,get actions(){return actions;},set enabled(v){enabled=v;},fire(type,kind,id=1){events[type]({target:buttons[kind],pointerId:id,pointerType:'touch',preventDefault(){}});}};
}
test('controller supports steering and action together and restores the remaining steering finger',()=>{
 const r=rig();r.fire('pointerdown','left',1);r.fire('pointerdown','action',2);assert.equal(r.actions,1);assert.deepEqual(r.directions.at(-1),[1,false]);
 r.fire('pointerdown','right',3);assert.deepEqual(r.directions.at(-1),[-1,true]);r.fire('pointerup','right',3);assert.deepEqual(r.directions.at(-1),[1,false]);
 r.fire('pointerup','left',1);assert.deepEqual(r.directions.at(-1),[0,false]);
});
test('pause gating, cancellations and resets cannot leave held controls',()=>{
 const r=rig();r.enabled=false;r.fire('pointerdown','action');assert.equal(r.actions,0);
 r.enabled=true;r.fire('pointerdown','brake');assert.equal(r.brakes.at(-1),true);r.fire('pointercancel','brake');assert.equal(r.brakes.at(-1),false);
 r.fire('pointerdown','left');r.controller.reset();assert.deepEqual(r.directions.at(-1),[0,false]);r.controller.dispose();assert.equal(Object.keys(r.events).length,0);
});
