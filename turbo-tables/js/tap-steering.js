// A quick tap nudges; a held touch keeps steering. Capture survives edge slips.
export function createTapSteering(surface, { enabled, setSteer, now = () => performance.now(), later = setTimeout, cancel = clearTimeout }) {
  const held = new Map(); let timer = null;
  const side = e => e.clientX < surface.getBoundingClientRect().left + surface.getBoundingClientRect().width / 2 ? 1 : -1;
  function reset() { if(timer !== null)cancel(timer);timer=null;held.clear();setSteer(null); }
  function down(e) {
    if(!enabled() || !['touch','pen'].includes(e.pointerType))return;
    e.preventDefault();if(timer !== null)cancel(timer);timer=null;
    held.set(e.pointerId,{steer:side(e),at:now()});surface.setPointerCapture(e.pointerId);setSteer(side(e));
  }
  function move(e) {
    if(!held.has(e.pointerId))return;
    if(!enabled()){reset();return;}
    held.get(e.pointerId).steer=side(e);
    if([...held.keys()].at(-1)===e.pointerId)setSteer(side(e));
  }
  function up(e) {
    const press=held.get(e.pointerId);if(!press)return;held.delete(e.pointerId);
    const other=[...held.values()].at(-1);if(other){setSteer(other.steer);return;}
    const delay=e.type==='pointerup'&&enabled()?Math.max(0,160-(now()-press.at)):0;
    if(delay)timer=later(()=>{timer=null;setSteer(null);},delay);else setSteer(null);
  }
  const events={pointerdown:down,pointermove:move,pointerup:up,pointercancel:up,lostpointercapture:up};
  for(const [name,fn] of Object.entries(events))surface.addEventListener(name,fn);
  return {reset,dispose(){reset();for(const [name,fn] of Object.entries(events))surface.removeEventListener(name,fn);}};
}
