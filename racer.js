import * as T from './vendor/three.module.min.js';

export function raceQuestions(level, random=Math.random, count=8){
 const bank=[];
 if(level<3){for(let a=2;a<=12;a++)for(let b=2;b<=8;b++)if(a<=b&&a+b<=20)bank.push({a,b,op:'+',answer:a+b});}
 else {const tables=level>=5?[2,3,4,5,6,7,8,9,10,11,12]:[2,3,4,5,10];for(const a of tables)for(let b=2;b<=12;b++)if(a<=b)bank.push({a,b,op:'×',answer:a*b});}
 for(let i=bank.length-1;i>0;i--){const j=Math.floor(random()*(i+1));[bank[i],bank[j]]=[bank[j],bank[i]];}
 return bank.slice(0,count).map(q=>({...q,text:`${q.a} ${q.op} ${q.b}`}));
}
export function approachDistance(score,fast,classLevel=6){const start=fast?96:126,shrink=Number(classLevel)===1?.90:.84;return Math.max(start/4,start*shrink**Math.max(0,score));}
export function racePace(score,fast,classLevel=6){const start=fast?96:126,floor=start/4,distance=approachDistance(score,fast,classLevel);return {multiplier:start/distance,percent:(start-distance)/(start-floor)*100};}
export function formatRaceTime(seconds){const total=Number.isFinite(Number(seconds))?Math.max(0,Math.floor(Number(seconds))):0;return `${Math.floor(total/60)}:${String(total%60).padStart(2,'0')}`;}
export function gateAnswers(q,random=Math.random){
 const values=new Set([q.answer]);
 for(const n of [q.answer-q.b,q.answer+q.a,q.answer-1,q.answer+1])if(n>=0&&n!==q.answer&&values.size<3)values.add(n);
 const result=[...values];for(let i=2;i>0;i--){const j=Math.floor(random()*(i+1));[result[i],result[j]]=[result[j],result[i]];}return result;
}
export function drivingSpeed(fast,accelerating,boost,bump,classLevel=6){
 const base=(fast?24:18)*(Number(classLevel)===1?.85:1);
 return base*(bump>0 ? .62 : boost>0 ? 1.5 : 1)*(accelerating?1.8:1);
}

// Original two-phrase chip melody: no samples, streaming or borrowed soundtrack.
function chipAudio(){
 let ctx,master,timer,step=0,music=true,effects=true,duckUntil=0,generation=0;const voices=new Set();
 // Eight-bar A/B tune with register changes, rests, harmony and a contrasting reply.
 const melody=[
  [76,null,79,81,79,null,76,74,72,null,76,79,83,81,79,null],
  [81,null,84,83,81,79,76,null,79,null,81,83,84,null,83,79],
  [77,null,81,79,77,76,74,null,72,74,77,81,84,81,79,null],
  [79,null,83,86,83,79,74,null,76,79,83,86,88,86,83,79],
  [88,null,84,83,81,null,84,88,91,null,88,84,83,81,79,null],
  [81,83,84,null,88,86,84,83,81,null,79,76,74,76,79,null],
  [77,null,74,72,69,null,72,77,81,84,81,null,79,77,76,74],
  [79,null,83,86,88,86,83,79,76,null,74,71,72,null,79,null]
 ];
 const chords=[[60,64,67],[57,60,64],[53,57,60],[55,59,62]],bassRoots=[48,45,41,43];
 function note(midi,length,type='square',volume=.025){
  if(!ctx||ctx.state!=='running')return;const o=ctx.createOscillator(),g=ctx.createGain(),now=ctx.currentTime;
  o.type=type;o.frequency.value=440*2**((midi-69)/12);g.gain.setValueAtTime(0,now);g.gain.linearRampToValueAtTime(volume,now+.008);g.gain.exponentialRampToValueAtTime(.0001,now+length);
  o.connect(g);g.connect(master||ctx.destination);voices.add(o);o.onended=()=>{voices.delete(o);g.disconnect()};o.start();o.stop(now+length+.02);
 }
 return {
  async start(fast){const token=generation;try{ctx??=new (window.AudioContext||window.webkitAudioContext)();if(!master){master=ctx.createGain();master.gain.value=music||effects?1:0;master.connect(ctx.destination);}await ctx.resume();if(token!==generation||timer)return;timer=setInterval(()=>{
   if(!music)return;const gain=Date.now()<duckUntil ? .3 : 1,bar=Math.floor(step/16)%8,beat=step%16,m=melody[bar][beat],chord=chords[bar%4];
   if(m!==null)note(m,beat%4===0 ? .24 : .13,'square',.025*gain);
   if(beat%2===0)note(bassRoots[bar%4]+(beat===6||beat===14?12:0),.16,'triangle',.045*gain);
   if(beat%4===2)note(chord[Math.floor(beat/4)%3]+12,.1,'triangle',.02*gain);
   if(beat===0||beat===8)note(35,.07,'sine',.075*gain);
   if(beat===4||beat===12)note(54,.04,'square',.014*gain);
   if(beat%2===1)note(99,.018,'triangle',.008*gain);
   step=(step+1)%128;
  },fast?110:125);}catch{}},
  sound(kind){if(kind==='bump')duckUntil=Date.now()+1800;if(!effects)return;if(kind==='boost'){note(79,.1,'triangle',.09);setTimeout(()=>note(91,.22,'triangle',.07),90);}else if(kind==='bump')note(40,.18,'triangle',.07);else if(kind==='finish')[72,76,79,84].forEach((n,i)=>setTimeout(()=>note(n,.25,'square',.04),i*120));},
  set(m,e){music=m;effects=e;if(master)master.gain.setValueAtTime(music||effects?1:0,ctx.currentTime);},pause(){generation++;clearInterval(timer);timer=null;voices.forEach(o=>{try{o.stop()}catch{}});},
  close(){this.pause();ctx?.close();}
 };
}

export function openRacer(learner,hooks){
 const reduced=matchMedia('(prefers-reduced-motion: reduce)').matches;
 const dialog=document.createElement('dialog');dialog.className='racer-dialog';
 dialog.setAttribute('aria-labelledby','racerTitle');
 dialog.innerHTML=`<div class="racer-shell"><header class="racer-header"><div><span class="racer-kicker">CLOUDTOP CIRCUIT</span><h2 id="racerTitle">Turbo Trail</h2></div><button class="close" aria-label="Close Turbo Trail">×</button></header><div class="racer-stage"><div class="racer-hud"><span id="raceProgress">Endless race · pause any time</span><strong id="raceQuestion">Ready to roll?</strong><span id="raceCue">Drive through the right number. Hold ↑ to accelerate.</span></div><div class="race-gates" aria-label="Answer numbers"></div><div class="race-message" id="raceMessage" role="status" aria-live="polite"></div><div class="race-speed" aria-hidden="true">✦ <span id="raceSpeed">CRUISE</span></div></div><section class="race-dashboard"><div class="race-steering"><button class="secondary" id="raceLeft" aria-label="Steer left">←</button><span id="raceLane" role="status">Middle lane</span><button class="secondary" id="raceRight" aria-label="Steer right">→</button></div><div class="race-options"><label>Driving style<select id="raceMode"><option value="cruise">Cruise · generous thinking time</option><option value="race">Race · faster gates</option></select></label><button class="secondary" id="racePause" disabled>Pause</button><button class="secondary" id="raceHelp" disabled>Pit stop · help</button><button class="primary" id="raceStart">Start driving</button></div><div class="race-audio"><label><input type="checkbox" id="raceMusic"> Music</label><label><input type="checkbox" id="raceEffects"> Sound effects</label><span>← → steer · hold ↑ / W to accelerate · 1 2 3 choose a lane</span></div></section><section class="race-pit" hidden><h3 id="racePitTitle">Safe pit stop</h3><p id="racePitCopy"></p><div id="raceModel"></div><button class="primary" id="raceResume">Back to the track</button></section></div>`;
 document.body.appendChild(dialog);dialog.showModal();const $=s=>dialog.querySelector(s),stage=$('.racer-stage'),audio=chipAudio();
 let disposed=false,renderer,frame,observer,phase='ready',beforePause='drive',lane=1,carX=0,index=0,correct=0,helped=0,clock=0,travel=0,boost=0,bump=0,last=0,fast=false,accelerating=false,sprintUntil=0,approach=0,answers=[],q,questions=raceQuestions(learner.classLevel,Math.random,Infinity),feedbackTime=0,completionSaved=false,best=Number(learner.turboBest)||0;
 let lives=3;
 let raceSeconds=0,longestSeconds=Math.max(0,Number(learner.turboLongestSeconds)||0);
 const raceClock=document.createElement('span');raceClock.id='raceClock';$('.racer-hud').appendChild(raceClock);
 function updateRaceTime(){const text=`Race: ${formatRaceTime(raceSeconds)} · Longest: ${formatRaceTime(Math.max(longestSeconds,raceSeconds))}`;if(raceClock.textContent!==text)raceClock.textContent=text;}
 function trackRaceTime(seconds){if(!document.hidden&&['drive','feedback'].includes(phase)){raceSeconds+=Math.max(0,seconds);updateRaceTime();}}
 updateRaceTime();
 const hearts=document.createElement('div');hearts.id='raceLives';hearts.setAttribute('role','status');hearts.setAttribute('aria-live','polite');$('.racer-hud').prepend(hearts);
 function updateLives(){hearts.setAttribute('aria-label',`${lives} ${lives===1?'life':'lives'} remaining`);hearts.innerHTML=Array.from({length:3},(_,i)=>`<span aria-hidden="true" class="${i<lives?'':'lost-life'}">${i<lives?'♥':'♡'}</span>`).join('');}
 updateLives();$('#raceProgress').textContent=`Personal best: ${best} · 3 lives · no time limit`;
 $('#raceCue').textContent='Drive through the right number. Hold ↑ or swipe up to accelerate.';
 $('.racer-hud').appendChild($('#raceStart'));
 $('#raceHelp').remove();
 $('#racePause').textContent='Ⅱ';$('#racePause').setAttribute('aria-label','Pause and work it out');
 const endControls=document.createElement('div');endControls.className='race-end-controls';endControls.hidden=true;endControls.innerHTML='<button class="primary" id="raceNew">New race</button><button class="secondary" id="raceBack">Back to games</button>';$('.racer-hud').appendChild(endControls);
 $('#raceBack').onclick=()=>dialog.close();
 $('#raceMode').value=learner.turboDrivingStyle==='race'?'race':'cruise';
 $('#raceMode').onchange=()=>hooks.onDrivingStyle?.($('#raceMode').value);
 $('.race-audio>span').textContent='← → steer · hold ↑ / W to accelerate · swipe up for a burst · Spacebar to pause game';
 const steeringStatus=document.createElement('span');steeringStatus.id='raceSteeringStatus';$('.race-audio').appendChild(steeringStatus);
 const touchControls=window.matchMedia('(pointer: coarse), (max-width: 700px)');
 function defaultSteeringCopy(){return touchControls.matches?'Tap either side or swipe left/right to steer.':'You can also click either side of the track to steer.';}
 function syncControlHints(){if(phase==='ready')$('#raceCue').textContent=touchControls.matches?'Drive through the right number. Swipe up or hold Accelerate for a burst.':'Drive through the right number. Hold ↑ or W to accelerate.';$('.race-audio>span').textContent=touchControls.matches?'Swipe up for a speed burst · hold Accelerate for more speed · tap pause to work it out':'← / → or A / D steer · hold ↑ / W to accelerate · Spacebar to pause game';steeringStatus.textContent=defaultSteeringCopy();}
 touchControls.addEventListener('change',syncControlHints);syncControlHints();
 const pace=document.createElement('div');pace.className='race-pace';pace.innerHTML='<strong id="racePaceText">PACE 1.00×</strong><div class="race-pace-meter" role="progressbar" aria-label="Race pace" aria-valuemin="0" aria-valuemax="100"><i></i></div>';stage.appendChild(pace);
 function updatePace(flash=false){const p=racePace(correct,fast,learner.classLevel);$('#racePaceText').textContent='PACE '+p.multiplier.toFixed(2)+'×';pace.querySelector('i').style.width=p.percent+'%';pace.querySelector('[role="progressbar"]').setAttribute('aria-valuenow',String(Math.round(p.percent)));pace.querySelector('[role="progressbar"]').setAttribute('aria-valuetext',p.multiplier.toFixed(2)+' times starting pace');pace.classList.remove('pace-up');if(flash&&!reduced){void pace.offsetWidth;pace.classList.add('pace-up');}}
 for(const id of ['raceLeft','raceRight']){const b=$('#'+id);b.className='race-edge-control';b.innerHTML='<span aria-hidden="true">'+(id==='raceLeft'?'←':'→')+'</span>';stage.appendChild(b);}
 const geometries=new Set(),materials=new Set(),gateMeshes=[],props=[],wheels=[];
 $('#raceMusic').parentElement.remove();$('#raceEffects').parentElement.remove();
 let audioMuted=hooks.sound===false;const mute=document.createElement('button');mute.id='raceMute';mute.className='secondary';$('.racer-header').appendChild(mute);
 function syncAudio(){audio.set(!audioMuted,!audioMuted);mute.textContent=audioMuted?'🔇':'🔊';mute.setAttribute('aria-label',audioMuted?'Unmute audio':'Mute audio');mute.setAttribute('aria-pressed',String(audioMuted));mute.title=audioMuted?'Unmute audio':'Mute audio';}
 mute.onclick=()=>{audioMuted=!audioMuted;syncAudio();};syncAudio();
 function cleanup(){if(disposed)return;touchControls.removeEventListener('change',syncControlHints);disposed=true;cancelAnimationFrame(frame);observer?.disconnect();document.removeEventListener('keydown',key,true);document.removeEventListener('keyup',releaseKey);window.removeEventListener('blur',releaseAcceleration);document.removeEventListener('visibilitychange',visibility);audio.close();geometries.forEach(g=>g.dispose());materials.forEach(m=>m.dispose());renderer?.dispose();renderer?.forceContextLoss();dialog.remove();hooks.close();}
 dialog.addEventListener('close',cleanup,{once:true});$('.close').onclick=()=>dialog.close();
 try{renderer=new T.WebGLRenderer({antialias:true,powerPreference:'low-power'});}catch{$('#raceQuestion').textContent='This track needs 3D graphics';$('#raceCue').textContent='Try an up-to-date browser. Your other maths games are still available.';$('#raceStart').disabled=true;return;}
 renderer.setPixelRatio(Math.min(devicePixelRatio,1.6));renderer.shadowMap.enabled=true;renderer.shadowMap.type=T.PCFSoftShadowMap;renderer.outputColorSpace=T.SRGBColorSpace;renderer.toneMapping=T.ACESFilmicToneMapping;renderer.toneMappingExposure=1.15;
 const canvas=renderer.domElement;canvas.setAttribute('aria-label','A toy kart on a three-lane floating garden race track. Use the steering controls below.');canvas.setAttribute('role','img');stage.prepend(canvas);
 const scene=new T.Scene();scene.background=new T.Color('#cbece8');scene.fog=new T.Fog('#cbece8',28,100);
 const camera=new T.PerspectiveCamera(48,1,.1,150);camera.position.set(0,5.5,12);camera.lookAt(0,1,-12);
 scene.add(new T.HemisphereLight('#fff4d3','#9c87bf',2));const sun=new T.DirectionalLight('#fff3d8',3);sun.position.set(-10,16,5);sun.castShadow=true;sun.shadow.mapSize.set(1024,1024);scene.add(sun);
 const palette=new Map(),geometryCache=new Map();
 function material(color){if(!palette.has(color)){const m=new T.MeshStandardMaterial({color,roughness:.78});materials.add(m);palette.set(color,m);}return palette.get(color);}
 function mesh(g,color,x,y,z,parent=scene){geometries.add(g);const m=new T.Mesh(g,material(color));m.position.set(x,y,z);m.receiveShadow=true;parent.add(m);return m;}
 function ball(color,x,y,z,size,parent=scene){const key='sphere:'+size;if(!geometryCache.has(key))geometryCache.set(key,new T.SphereGeometry(size,12,8));return mesh(geometryCache.get(key),color,x,y,z,parent);}
 function block(color,x,y,z,w,h,d,parent=scene){
  const key=[w,h,d].join(':');if(geometryCache.has(key))return mesh(geometryCache.get(key),color,x,y,z,parent);
  const r=Math.min(.15,w/4,h/4,d/4),s=new T.Shape(),a=-w/2,b=-h/2;
  s.moveTo(a+r,b);s.lineTo(a+w-r,b);s.quadraticCurveTo(a+w,b,a+w,b+r);s.lineTo(a+w,b+h-r);s.quadraticCurveTo(a+w,b+h,a+w-r,b+h);s.lineTo(a+r,b+h);s.quadraticCurveTo(a,b+h,a,b+h-r);s.lineTo(a,b+r);s.quadraticCurveTo(a,b,a+r,b);
  const g=new T.ExtrudeGeometry(s,{depth:d-r,bevelEnabled:true,bevelSegments:2,steps:1,bevelSize:r/2,bevelThickness:r/2,curveSegments:3});g.translate(0,0,-(d-r)/2);geometryCache.set(key,g);return mesh(g,color,x,y,z,parent);
 }
 const road=new T.Group();scene.add(road);
 for(let i=0;i<24;i++){const g=new T.Group();road.add(g);g.position.z=8-i*4;block('#afa8d4',0,0,0,10,.35,4,g);[-1,1].forEach(side=>{block('#ffead4',side*5,.15,0,.45,.45,4,g);block(i%2?'#f29eb2':'#fff3da',side*4.75,.24,0,.4,.12,4,g)});[-1.67,1.67].forEach(x=>block('#fff9dc',x,.2,0,.08,.04,1.4,g));}
 for(let i=0;i<34;i++){
  const g=new T.Group();scene.add(g);g.userData={z:-i*3,x:(i%2?1:-1)*(7+(i%4)*1.3)};g.position.set(g.userData.x,0,g.userData.z);props.push(g);
  const mound=ball(i%2?'#96cfb1':'#b2d8a6',0,-.5,0,2.1,g);mound.scale.y=.4;
  block('#bd937a',0,.7,0,.22,1.7,.22,g);const crown=ball(['#edafcd','#b4a6e5','#e5d994'][i%3],0,2,0,1.1,g);crown.scale.y=.85;ball('#fff3be',.45,.3,.6,.16,g);
 }
 // Floating cloud banks and distant clay hills frame the track.
 for(let i=0;i<14;i++){const c=ball('#fff6e8',(i%2?1:-1)*(12+i%3*3),-2,-i*7,3);c.scale.set(1.8,.45,1);}
 const kart=new T.Group();scene.add(kart);kart.position.set(0,.65,3);
 // A sculpted, bevelled toy shell rather than a rectangular chassis.
 const shell=new T.Shape();shell.moveTo(0,1.18);shell.bezierCurveTo(.6,1.18,.8,1.05,.83,.55);shell.bezierCurveTo(.85,.2,.9,-.4,.84,-.83);shell.bezierCurveTo(.78,-1.2,-.78,-1.2,-.84,-.83);shell.bezierCurveTo(-.9,-.4,-.85,.2,-.83,.55);shell.bezierCurveTo(-.8,1.05,-.6,1.18,0,1.18);
 const shellGeometry=new T.ExtrudeGeometry(shell,{depth:.18,bevelEnabled:true,bevelSegments:4,bevelSize:.12,bevelThickness:.13,curveSegments:12});shellGeometry.translate(0,0,-.09);shellGeometry.rotateX(-Math.PI/2);const body=mesh(shellGeometry,'#7554da',0,.14,0,kart);
 const toyPaint=new T.MeshPhysicalMaterial({color:'#8356df',roughness:.3,metalness:.08,clearcoat:.8,clearcoatRoughness:.22});materials.add(toyPaint);body.material=toyPaint;material('#ad8bfa').roughness=.35;material('#9269e5').roughness=.35;
 function toyOval(color,x,y,z,sx,sy,sz,parent=kart){const key='toy-sphere';if(!geometryCache.has(key))geometryCache.set(key,new T.SphereGeometry(1,24,16));const part=mesh(geometryCache.get(key),color,x,y,z,parent);part.scale.set(sx,sy,sz);return part;}
 toyOval('#ad8bfa',0,.33,-.65,.74,.25,.62); // Rounded bonnet.
 toyOval('#9269e5',0,.34,.79,.78,.2,.4); // Soft rear deck.
 toyOval('#493561',0,.43,.16,.55,.12,.49); // Cockpit inset.
 toyOval('#fff1c9',0,.52,.34,.43,.25,.32); // Padded seat.
 toyOval('#b6e9e4',0,.52,-.28,.56,.17,.1); // Toy windscreen.
 for(const side of [-1,1]){
  for(const z of [-.65,.65])toyOval('#9269e5',side*.76,.17,z,.28,.25,.43);
  toyOval('#ad8bfa',side*.7,.33,.7,.32,.3,.46); // Plump rear wheel arches.
  toyOval('#ffd772',side*.78,.09,.08,.095,.095,.4); // Gold side sills.
  toyOval('#fff1c9',side*.46,.32,-1.12,.18,.13,.08);
  toyOval('#f793b4',side*.49,.25,1.09,.2,.1,.06);
 }
 toyOval('#ffd772',0,.09,-1.23,.65,.095,.12);
 toyOval('#fff1c9',0,.09,1.16,.69,.095,.13);
 toyOval('#ffd772',0,.565,-.62,.13,.035,.44);
 toyOval('#ffd772',0,.53,.8,.13,.04,.25);
 for(const side of [-1,1]){
  toyOval('#493561',side*.56,.53,.97,.055,.25,.06);
  toyOval('#7554da',side*.92,.76,1.01,.105,.17,.24);
  toyOval('#ad8bfa',side*.79,.55,-.08,.17,.09,.1); // Little wing mirrors.
 }
 toyOval('#ad8bfa',0,.74,1.02,1.02,.085,.23); // Sweeping rear spoiler.
 const rollbar=mesh(new T.TorusGeometry(.42,.055,8,24,Math.PI),'#ffd772',0,.6,.52,kart);
 toyOval('#ffd772',0,.82,.55,.11,.1,.045); // A tiny round racing badge.
 const steering=mesh(new T.TorusGeometry(.17,.035,8,20),'#493561',0,.63,-.08,kart);steering.rotation.x=-Math.PI/3;
 const driver=ball('#f5bb7c',0,.9,.22,.34,kart);[-1,1].forEach(s=>{const ear=ball('#f5bb7c',s*.17,1.23,.22,.13,kart);ear.scale.y=2;ball('#403451',s*.11,.93,-.065,.04,kart);});
 const tyreGeometry=new T.TorusGeometry(.245,.105,10,20),hubGeometry=new T.CylinderGeometry(.19,.19,.24,20);
 for(const x of [-.89,.89])for(const z of [-.65,.65]){const wheel=new T.Group();wheel.position.set(x,-.1,z);kart.add(wheel);const tyre=mesh(tyreGeometry,'#3d345a',0,0,0,wheel);tyre.rotation.y=Math.PI/2;const hub=mesh(hubGeometry,'#ffd772',0,0,0,wheel);hub.rotation.z=Math.PI/2;toyOval('#fff1c9',Math.sign(x)*.13,0,0,.035,.09,.09,wheel);wheels.push(wheel);}
 const trail=block('#ffe28a',0,.23,1.8,.8,.035,2,kart);trail.visible=false;
 kart.traverse(o=>{if(o.isMesh)o.castShadow=true;});
 const gateRoot=new T.Group();scene.add(gateRoot);
 for(let i=0;i<3;i++){const g=new T.Group();gateRoot.add(g);g.position.x=(i-1)*3.2;const pad=ball(['#f4b7c8','#b9acec','#a4d9bf'][i],0,.26,0,.85,g);pad.scale.set(1.2,.065,1);gateMeshes.push(g);}
 gateRoot.visible=false;
 function steer(next){if(!['drive','ready','feedback'].includes(phase))return;lane=Math.max(0,Math.min(2,next));$('#raceLane').textContent=['Left lane','Middle lane','Right lane'][lane];$('.race-gates').querySelectorAll('button').forEach((b,i)=>b.setAttribute('aria-pressed',String(i===lane)));$('#raceLeft').disabled=false;$('#raceRight').disabled=false;}
 $('#raceLeft').onclick=e=>{if(e.detail===0)steer(lane-1)};$('#raceRight').onclick=e=>{if(e.detail===0)steer(lane+1)};
 function setAcceleration(value){accelerating=value&&phase==='drive';$('#raceAccelerate').setAttribute('aria-pressed',String(accelerating));}
 function releaseAcceleration(){setAcceleration(false);}
 function releaseKey(e){if(e.key==='ArrowUp'||e.key==='w'||e.key==='W')releaseAcceleration();}
 function key(e){if(!dialog.open)return;
  if((e.code==='Space'||e.key===' ')&&['drive','feedback','pause'].includes(phase)&&!e.ctrlKey&&!e.metaKey&&!e.altKey){e.preventDefault();e.stopPropagation();if(!e.repeat)togglePause();return;}
  if(e.target.tagName==='SELECT'||e.target.tagName==='INPUT')return;
  if(['ArrowUp','w','W'].includes(e.key)){e.preventDefault();setAcceleration(true);return;}
  if(['ArrowLeft','a','A','ArrowRight','d','D'].includes(e.key)&&!e.repeat){e.preventDefault();steer(lane+(['ArrowLeft','a','A'].includes(e.key)?-1:1));}
  if(['1','2','3'].includes(e.key))steer(Number(e.key)-1);
 }
 document.addEventListener('keydown',key,true);document.addEventListener('keyup',releaseKey);window.addEventListener('blur',releaseAcceleration);let touchX,touchY;
 const pedal=document.createElement('button');pedal.id='raceAccelerate';pedal.className='secondary';pedal.textContent='↑ Accelerate';pedal.setAttribute('aria-label','Hold to accelerate');pedal.setAttribute('aria-pressed','false');$('.race-options').appendChild(pedal);
 pedal.onpointerdown=e=>{e.preventDefault();pedal.setPointerCapture(e.pointerId);setAcceleration(true)};pedal.onpointerup=releaseAcceleration;pedal.onpointercancel=releaseAcceleration;pedal.onlostpointercapture=releaseAcceleration;
 pedal.onkeydown=e=>{if(e.key===' '||e.key==='Enter'){e.preventDefault();setAcceleration(true)}};pedal.onkeyup=e=>{if(e.key===' '||e.key==='Enter')releaseAcceleration()};pedal.onblur=releaseAcceleration;
 for(const surface of [canvas,$('#raceLeft'),$('#raceRight')]){
  surface.addEventListener('pointerdown',e=>{if(e.button!==0)return;touchX=e.clientX;touchY=e.clientY;surface.setPointerCapture(e.pointerId)});
  surface.addEventListener('pointerup',e=>{if(touchX!==undefined){const dx=e.clientX-touchX,dy=e.clientY-touchY;if(dy<-24&&Math.abs(dy)>Math.abs(dx)&&phase==='drive')sprintUntil=performance.now()+1000;else if(Math.abs(dx)>24)steer(lane+(dx>0?1:-1));else if(Math.abs(dy)<24){const r=stage.getBoundingClientRect();steer(lane+(e.clientX<r.left+r.width/2?-1:1));}}touchX=touchY=undefined;});
  surface.addEventListener('pointercancel',()=>touchX=touchY=undefined);
 }
 function model(){return window.mathsModels?.render({kind:q.op==='×'?'group-strategy':'number-strategy',a:q.a,b:q.b,op:q.op})||'';}
 function pause(help=true){
  if(!['drive','feedback'].includes(phase))return;beforePause=phase;phase='pause';releaseAcceleration();sprintUntil=0;audio.pause();$('.race-pit').hidden=false;
  $('#racePitTitle').textContent=help?'Work it out':'Taking a breather';$('#racePitCopy').textContent=help?(q.op==='×'?`${q.a} groups of ${q.b}. Count in ${q.b}s to find the total.`:`Start with ${q.a}, then add ${q.b}. Count both parts.`):'The kart is parked safely. Nothing moves until you are ready.';
  $('#raceModel').innerHTML=help?model():'';if(help&&!q.helped){helped++;q.helped=true;}$('#racePause').textContent='▶';$('#racePause').setAttribute('aria-label','Resume race');$('.race-gates').hidden=true;
 }
 function resume(){if(phase!=='pause')return;phase=beforePause;$('.race-pit').hidden=true;$('#racePause').textContent='Ⅱ';$('#racePause').setAttribute('aria-label','Pause and work it out');audio.start(fast);$('.race-gates').hidden=phase!=='drive';last=performance.now();}
 function togglePause(){phase==='pause'?resume():pause();}
 function visibility(){if(document.hidden)pause();}
 document.addEventListener('visibilitychange',visibility);$('#racePause').onclick=togglePause;$('#raceResume').onclick=resume;
 canvas.addEventListener('webglcontextlost',e=>{e.preventDefault();pause();$('#racePitCopy').textContent='The graphics paused. Close this race and reopen it to try again.';$('#raceResume').disabled=true;$('#raceStart').disabled=true;});
 function nextQuestion(){
  if(index>=questions.length){const recent=new Set(questions.slice(-8).map(q=>q.text));questions.push(...raceQuestions(learner.classLevel,Math.random,Infinity).filter(q=>!recent.has(q.text)));}
  q=questions[index];answers=gateAnswers(q);clock=0;approach=0;phase='drive';gateRoot.visible=true;
  $('#raceProgress').textContent=`Completed: ${correct} · Best: ${Math.max(best,correct)}`;$('#raceQuestion').textContent=q.text;updatePace();
  $('#raceCue').textContent='Choose your lane. The road gets quicker as you progress.';
  $('#raceMessage').textContent='';$('#raceMessage').className='race-message';$('.race-gates').hidden=false;$('.race-gates').replaceChildren();
  answers.forEach((n,i)=>{const b=document.createElement('button');b.className='race-gate-label';b.textContent=String(n);b.setAttribute('aria-label',`Steer towards ${['left','middle','right'][i]} answer: ${n}`);b.onclick=()=>{steer(i)};$('.race-gates').appendChild(b)});positionAnswers(0);steer(lane);
 }
 function resolve(){
  if(phase!=='drive')return;
  const hit=answers[lane]===q.answer;q.passed=hit;phase='feedback';feedbackTime=0;releaseAcceleration();sprintUntil=0;$('.race-gates').hidden=true;gateRoot.visible=false;
  $('#raceQuestion').textContent=`${q.text} = ${q.answer}`;$('#raceCue').textContent=hit?'Perfect line! Enjoy the boost.':'A little bump. Here’s the correct answer.';
  $('#raceMessage').textContent=hit?'BOOST!':`${q.text} = ${q.answer}`;$('#raceMessage').className='race-message '+(hit?'boost':'bump');
  $('.race-gates').querySelectorAll('button').forEach((b,i)=>{b.classList.toggle('correct-gate',answers[i]===q.answer);b.disabled=true;});
  if(hit){correct++;boost=2.2;audio.sound('boost');$('#raceProgress').textContent=`Completed: ${correct} · Best: ${Math.max(best,correct)}`;updatePace(true);$('#raceCue').textContent='Pace up! '+racePace(correct,fast,learner.classLevel).multiplier.toFixed(2)+'× — next answers arrive sooner.';}else{lives--;updateLives();boost=0;bump=3;audio.sound('bump');$('#raceCue').textContent=lives>0?`Not quite — ${q.text} = ${q.answer}. ${lives} ${lives===1?'life':'lives'} left. Keep going!`:`${q.text} = ${q.answer}. No lives left — try a new race!`;}
 }
 function advanceFeedback(dt){
  feedbackTime+=dt;
  if(feedbackTime>(q.passed ? .65 : 3)){if(lives===0)finish();else{index++;nextQuestion();}}
 }
 function finish(){
  phase='finish';audio.pause();audio.sound('finish');gateRoot.visible=false;$('.race-gates').hidden=true;
  const newBest=correct>best,newLongest=raceSeconds>longestSeconds;best=Math.max(best,correct);longestSeconds=Math.max(longestSeconds,raceSeconds);updateRaceTime();
  if(!completionSaved){completionSaved=true;hooks.complete({questions:index+1,correct,independent:questions.slice(0,index+1).filter(q=>q.passed&&!q.helped).length,helped,best,durationSeconds:raceSeconds});}
  $('#raceQuestion').textContent=newBest?'New personal best!':newLongest?'New longest race!':'Run complete';
  $('#raceProgress').textContent=`${correct} sums completed · Personal best: ${best}`;
  $('#raceCue').textContent=`${q.text} = ${q.answer}. Take another run when you’re ready.`;
  $('#raceMessage').textContent='';$('#racePause').disabled=true;endControls.hidden=false;$('#raceSpeed').textContent='FINISH';
 }
 function startRace(){lives=3;updateLives();raceSeconds=0;updateRaceTime();fast=$('#raceMode').value==='race';index=correct=helped=clock=travel=boost=bump=approach=0;lane=1;carX=0;accelerating=false;sprintUntil=0;completionSaved=false;questions=raceQuestions(learner.classLevel,Math.random,Infinity);endControls.hidden=true;$('.race-pit').hidden=true;$('#raceMode').disabled=true;$('#raceMode').parentElement.hidden=true;$('#raceStart').hidden=true;$('#racePause').disabled=false;audio.start(fast);nextQuestion();last=performance.now();}
 $('#raceStart').onclick=startRace;$('#raceNew').onclick=startRace;
 function resize(){const {width,height}=stage.getBoundingClientRect();renderer.setSize(width,height);camera.aspect=width/height;camera.fov=width<600?60:48;camera.updateProjectionMatrix();}
 observer=new ResizeObserver(resize);observer.observe(stage);resize();steer(1);
 const projection=new T.Vector3();
 function positionAnswers(p){
  const startZ=stage.clientWidth<600?-8:-18;gateRoot.position.z=startZ+p*(4-startZ);gateRoot.position.x=curve(gateRoot.position.z);
  $('.race-gates').querySelectorAll('button').forEach((b,i)=>{
   projection.set(gateRoot.position.x+(i-1)*3.2,1,gateRoot.position.z);projection.project(camera);
   const edge=stage.clientWidth<600?16:10;
   b.style.left=`${T.MathUtils.clamp((projection.x+1)/2*100,edge,100-edge)}%`;
   b.style.top=`${T.MathUtils.clamp((1-projection.y)/2*100,53,78)}%`;
   b.style.fontSize=`${stage.clientWidth<600?18+p*24:22+p*26}px`;
  });
 }
 function tick(now){
  if(disposed)return;frame=requestAnimationFrame(tick);const elapsed=Math.max(0,(now-(last||now))/1000),dt=Math.min(.05,elapsed);last=now;trackRaceTime(elapsed);
  if(document.hidden)return;
  if(!document.hidden&&['drive','feedback'].includes(phase)){
   const sprinting=accelerating||now<sprintUntil,speed=drivingSpeed(fast,sprinting,boost,bump,learner.classLevel);travel+=dt*speed;boost=Math.max(0,boost-dt);bump=Math.max(0,bump-dt);
   $('#raceAccelerate').setAttribute('aria-pressed',String(sprinting));
   $('#raceSpeed').textContent=sprinting?'ACCELERATING':boost>0?'BOOST':bump>0?'RECOVERING':fast?'RACE':'CRUISE';trail.visible=(boost>0||sprinting)&&!reduced;
   road.children.forEach((g,i)=>{g.position.z=8-((i*4-travel)%96+96)%96;g.position.x=curve(g.position.z);g.rotation.y=Math.atan(2.6*.032*Math.cos((travel+g.position.z)*.032));});
   props.forEach(g=>{g.position.z=8-(((-g.userData.z-travel)%102+102)%102);g.position.x=g.userData.x+curve(g.position.z)});
   wheels.forEach(w=>w.rotation.x-=dt*speed*2);
   if(phase==='drive'){
    clock+=dt;approach+=dt*speed;const distance=approachDistance(correct,fast,learner.classLevel),p=Math.min(1,approach/distance);
    gateRoot.visible=true;$('.race-gates').hidden=false;positionAnswers(p);
    if(p>=1){q.passed=answers[lane]===q.answer;resolve();}
   }else{advanceFeedback(dt);}
  }
  const target=(lane-1)*3.2;carX+=(target-carX)*(reduced?1:Math.min(1,dt*15));kart.position.x=carX+curve(3);kart.rotation.z=reduced?0:(target-carX)*-.13+(bump>0?Math.sin(now*.035)*.08:0);
  const wantedFov=(stage.clientWidth<600?60:48)+(!reduced&&(accelerating||now<sprintUntil||boost>0)?5:0);camera.fov+=(wantedFov-camera.fov)*Math.min(1,dt*6);camera.updateProjectionMatrix();
  camera.position.x=curve(3)+carX*.22;camera.lookAt(curve(-12)+carX*.2,1,-12);renderer.render(scene,camera);
 }
 function curve(z){return 2.6*Math.sin((travel+z)*.032);}
 frame=requestAnimationFrame(tick);
}
