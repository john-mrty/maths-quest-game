export function racerPortrait(learner){
 const names=['fox','panda','cat','dog','unicorn','owl','turtle','shark','badger'];
 return /^data:image\/(?:jpeg|png|webp);base64,[A-Za-z0-9+/]+={0,2}$/.test(learner.photo||'')?learner.photo:new URL(`./assets/avatars/${names[learner.avatarId]||'fox'}.png`,location.href).href;
}
// Isolate the imported game's CSS, keyboard handlers and renderer in its own document.
export function raceSummary(value) {
 if(!value||!Number.isInteger(value.asked)||value.asked<0||value.asked>10000||!Number.isInteger(value.correct)||value.correct<0||value.correct>value.asked||!Number.isFinite(value.time)||value.time<=0)return null;
 return {questions:value.asked,correct:value.correct,durationSeconds:value.time,rank:Math.max(1,Math.min(8,Math.floor(Number(value.rank)||8))),track:String(value.track||'').slice(0,40),classLevel:Math.max(1,Math.min(6,Math.floor(Number(value.classLevel)||1)))};
}
export function openTurboTables(learner,hooks){
 const dialog=document.createElement('dialog');dialog.className='tables-dialog';dialog.setAttribute('aria-label','Turbo Tables');
 dialog.innerHTML='<div class="tables-shell"><header><strong>Turbo Tables</strong><span class="tables-learner"></span><button class="tables-pause" aria-label="Pause or resume Turbo Tables">Ⅱ</button><button class="close" aria-label="Close Turbo Tables">×</button></header><p class="tables-loading" role="status">Opening Turbo Tables…</p><iframe title="Turbo Tables racing game" sandbox="allow-scripts allow-same-origin" allow="autoplay; accelerometer; gyroscope"></iframe></div>';
 const frame=dialog.querySelector('iframe'),token=crypto.randomUUID(),origin=location.origin,completed=new Set();let closed=false;
 const state=learner.turboTables||{setup:{},progress:{facts:{},history:[]}};learner.turboTables=state;
 dialog.querySelector('.tables-learner').textContent=learner.name;
 const send=(type,data)=>frame.contentWindow?.postMessage({source:'maths-quest',token,type,data},origin);
 dialog.querySelector('.tables-pause').onclick=()=>send('pause');
 function message(event){
  const m=event.data;if(closed||event.source!==frame.contentWindow||event.origin!==origin||m?.source!=='turbo-tables'||m.token!==token)return;
  if(m.type==='ready')send('init',{name:learner.name,classLevel:learner.classLevel,avatar:racerPortrait(learner),setup:state.setup,progress:state.progress,sound:hooks.sound!==false});
  if(m.type==='loaded')dialog.querySelector('.tables-loading').hidden=true;
  if(m.type==='exit'){dialog.close();return;}
  if(m.type==='error'){dialog.querySelector('.tables-loading').hidden=false;dialog.querySelector('.tables-loading').textContent='Turbo Tables could not start. Close it and try again.';}
  if(m.type==='setup'&&m.data&&typeof m.data==='object'){state.setup=m.data;hooks.save();}
  if(m.type==='progress'&&m.data?.facts&&typeof m.data.facts==='object'&&Array.isArray(m.data.history)){state.progress=m.data;hooks.save();}
  if(m.type==='complete'&&typeof m.data?.runId==='string'&&!completed.has(m.data.runId)){
   const result=raceSummary(m.data);if(!result)return;completed.add(m.data.runId);
   state.races=(state.races||0)+1;state.bestCorrect=Math.max(state.bestCorrect||0,result.correct);
   state.bestTimes||={};const key=`${result.track}:${result.classLevel}:${m.data.easy?'easy':'manual'}`;state.bestTimes[key]=Math.min(state.bestTimes[key]||Infinity,result.durationSeconds);
   hooks.complete(result);hooks.save();
  }
 }
 function close(){if(closed)return;closed=true;send('stop');window.removeEventListener('message',message);frame.src='about:blank';dialog.remove();hooks.close();}
 window.addEventListener('message',message);dialog.addEventListener('close',close,{once:true});dialog.addEventListener('cancel',e=>e.preventDefault());dialog.querySelector('.close').onclick=()=>dialog.close();
 frame.src=`./turbo-tables/index.html?embedded=1&token=${encodeURIComponent(token)}`;document.body.appendChild(dialog);dialog.showModal();
}
