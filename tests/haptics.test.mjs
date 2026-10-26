import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createHaptics} from '../turbo-tables/js/haptics.js';
function rig() {
 let time=0,enabled=true,active=true;
 const calls=[], device={vibrate:p=>{calls.push(p);return true;},userActivation:{hasBeenActive:true}};
 const h=createHaptics({device,enabled:()=>enabled,active:()=>active,now:()=>time});
 return {h,calls,device,set time(v){time=v;},set enabled(v){enabled=v;},set active(v){active=v;}};
}
test('impacts scale by strength and scraping is rate limited',()=>{
 const r=rig();r.h.pulse('wall',5);r.time=300;r.h.pulse('wall',20);assert.deepEqual(r.calls,[18]);
 r.time=450;r.h.pulse('wall',20);assert.deepEqual(r.calls,[18,32]);
});
test('rumble cannot interrupt boost, but impact can; repeated boosts are bounded',()=>{
 const r=rig();r.h.pulse('rumble');r.time=1;r.h.pulse('boost');r.time=2;r.h.pulse('rumble');
 r.h.pulse('wall',20);assert.deepEqual(r.calls,[7,[14,35,24],32]);
 r.time=200;r.h.pulse('boost');assert.equal(r.calls.length,3);
 r.time=651;r.h.pulse('boost');assert.equal(r.calls.length,4);
});
test('off, paused, missing activation and unsupported APIs stay silent',()=>{
 const r=rig();r.enabled=false;r.h.pulse('boost');r.enabled=true;r.active=false;r.h.pulse('wall');
 r.active=true;r.device.userActivation.hasBeenActive=false;r.h.pulse('rumble');assert.deepEqual(r.calls,[]);
 const h=createHaptics({device:{},enabled:()=>true,active:()=>true});assert.equal(h.supported,false);h.pulse('boost');h.stop();
});
test('stop cancels vibration and blocked APIs never throw into the game',()=>{
 const r=rig();r.h.pulse('boost');r.h.stop();assert.equal(r.calls.at(-1),0);
 r.device.vibrate=()=>{throw Error('blocked');};assert.doesNotThrow(()=>{r.h.pulse('wall');r.h.stop();});
});
