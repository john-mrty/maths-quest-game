import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createTapSteering} from '../turbo-tables/js/tap-steering.js';
function control(){
 const events={},timers=new Map(),output=[];let active=true,time=0,id=0;
 const surface={getBoundingClientRect:()=>({left:10,width:1000}),setPointerCapture(){},addEventListener:(n,f)=>events[n]=f,removeEventListener:n=>delete events[n]};
 const c=createTapSteering(surface,{enabled:()=>active,setSteer:v=>output.push(v),now:()=>time,later:(fn,ms)=>{timers.set(++id,{fn,ms});return id;},cancel:id=>timers.delete(id)});
 return {c,events,timers,output,set active(v){active=v;},set time(v){time=v;},fire(type,x,pointerId=1,pointerType='touch'){events[type]({type,clientX:x,pointerId,pointerType,preventDefault(){}});}};
}
test('both full-screen halves steer, including the far edges',()=>{const t=control();t.fire('pointerdown',11);assert.equal(t.output.at(-1),1);t.fire('pointermove',1009);assert.equal(t.output.at(-1),-1);t.time=500;t.fire('pointerup',1009);assert.equal(t.output.at(-1),null);});
test('quick taps nudge for 160ms',()=>{const t=control();t.fire('pointerdown',100);t.time=30;t.fire('pointerup',100);const timer=[...t.timers.values()][0];assert.equal(timer.ms,130);timer.fn();assert.equal(t.output.at(-1),null);});
test('reset and cancellation release steering and cancel pending nudges',()=>{const t=control();t.fire('pointerdown',900);t.fire('pointerup',900);assert.equal(t.timers.size,1);t.c.reset();assert.equal(t.timers.size,0);assert.equal(t.output.at(-1),null);t.active=false;t.fire('pointerdown',10);assert.equal(t.output.at(-1),null);t.active=true;t.fire('pointerdown',10);t.fire('pointercancel',10);assert.equal(t.output.at(-1),null);assert.equal(t.timers.size,0);});
test('two thumbs use the latest press and restore the remaining thumb',()=>{const t=control();t.fire('pointerdown',100,1);t.fire('pointerdown',900,2);assert.equal(t.output.at(-1),-1);t.fire('pointerup',900,2);assert.equal(t.output.at(-1),1);t.time=500;t.fire('pointerup',100,1);assert.equal(t.output.at(-1),null);});
test('mouse input is ignored and disposal removes handlers',()=>{const t=control();t.fire('pointerdown',100,1,'mouse');assert.deepEqual(t.output,[]);t.c.dispose();assert.equal(Object.keys(t.events).length,0);});
