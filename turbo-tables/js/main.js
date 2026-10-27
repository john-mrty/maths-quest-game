import { drivingChoice, itemAction } from './driving.js';
import * as THREE from 'three';
import { createHaptics } from './haptics.js';
import { createTapSteering } from './tap-steering.js';
import { Game } from './game.js';
import { Sound } from './audio.js';
import { TRACKS } from './track.js';
import { CHARACTERS, buildKart, ITEMS } from './karts.js';
import { LEVELS, OP_LABELS, OP_SYMBOL, Progress, describeFact } from './maths.js';
import { host, notify } from './host.js';
const OP_SHORT = { add: 'Adding', sub: 'Take away', mul: 'Times', div: 'Dividing' };

const $ = (id) => document.getElementById(id);
const ORD = (n) => n === 1 ? 'st' : n === 2 ? 'nd' : n === 3 ? 'rd' : 'th';
const fmtTime = (t) => { const m = Math.floor(t / 60), s = t - m * 60; return `${m}:${s.toFixed(2).padStart(5, '0')}`; };

// ---------- Setup state (remembered per device) ----------
const setup = { name: '', levelId: 3, charId: 'pip', trackId: 'meadow', tilt: false, tap: false, haptics: true, easy: false, opsByLevel: {} };
try { Object.assign(setup, host?host.setup:JSON.parse(localStorage.getItem('turbo-tables-setup') || '{}')); } catch (e) { /* ignore */ }
if(host){setup.name=host.name;setup.levelId=Math.max(1,Math.min(6,Number(host.classLevel)||1));}
if(setup.tilt)setup.tap=false;
const saveSetup = () => { if(host){notify('setup',setup);return;}try { localStorage.setItem('turbo-tables-setup', JSON.stringify(setup)); } catch (e) { /* ignore */ } };

const sound = new Sound();
if(host)sound.setMuted(host.sound===false);
$('btnMute').textContent=sound.muted?'🔇':'🔊';
const touch = { left: false, right: false, gas: false, reverse: false, drift: false, item: false, tiltSteer: null, padSteer: null };
if (navigator.maxTouchPoints > 0 || matchMedia('(any-pointer:coarse)').matches) document.body.classList.add('touch');

// ---------- HUD / UI bridge ----------
const hudEls = { pos: $('pos'), lap: $('lap'), timer: $('timer'), stars: $('stars'), itemIcon: $('itemIcon'), itemName: $('itemName'), item: $('item'), speedo: $('speedo'), drift: $('drift'), driftBar: $('drift').firstElementChild };
const mm = $('minimap'), mctx = mm.getContext('2d');
let mmPath = null, mmBounds = null;
let lastHud = {};
let feedbackTimer = 0, lapTimer = 0, countTimer = 0;

const ui = {
  onRecovery(message) { const cue = $('recoveryCue'); cue.hidden = !message; if(message) cue.textContent = message; },
  onHaptic(kind, strength) { haptics.pulse(kind, strength); },
  onHapticsStop() { haptics.stop(); },
  onGraphics(restored) {
    haptics.stop();
    releasePad(); tapSteering.reset(); hideTapGuide();
    for (const key in touch) if (typeof touch[key] === 'boolean') touch[key] = false;
    document.querySelectorAll('.tbtn.active').forEach(el => el.classList.remove('active'));
    $('graphicsRecovery').hidden = restored;
    if (restored && game.paused) $('pause').hidden = false;
  },
  setTrack(track) {
    const pts = track.samples.map((s) => [s.pos.x, s.pos.z]);
    let minX = Infinity, maxX = -Infinity, minZ = Infinity, maxZ = -Infinity;
    for (const [x, z] of pts) { minX = Math.min(minX, x); maxX = Math.max(maxX, x); minZ = Math.min(minZ, z); maxZ = Math.max(maxZ, z); }
    mmBounds = { minX, maxX, minZ, maxZ, scale: 260 / Math.max(maxX - minX, maxZ - minZ) };
    mmPath = pts; this.gateIdx = track.gateIndices; this.track = track;
  },
  mmPoint(x, z) { const b = mmBounds; return [20 + (x - b.minX) * b.scale + (260 - (b.maxX - b.minX) * b.scale) / 2, 20 + (z - b.minZ) * b.scale + (260 - (b.maxZ - b.minZ) * b.scale) / 2]; },
  drawMinimap(racers) {
    if (!mmPath) return;
    mctx.clearRect(0, 0, 300, 300);
    mctx.lineWidth = 22; mctx.lineCap = 'round'; mctx.lineJoin = 'round'; mctx.strokeStyle = 'rgba(29,36,64,.85)';
    mctx.beginPath(); mmPath.forEach(([x, z], i) => { const [px, py] = this.mmPoint(x, z); if (i) mctx.lineTo(px, py); else mctx.moveTo(px, py); }); mctx.closePath(); mctx.stroke();
    mctx.lineWidth = 14; mctx.strokeStyle = '#fffaf0'; mctx.stroke();
    for (const gi of this.gateIdx) { const s = this.track.sampleAt(gi); const [px, py] = this.mmPoint(s.pos.x, s.pos.z); mctx.fillStyle = '#ffd23f'; mctx.beginPath(); mctx.arc(px, py, 7, 0, 7); mctx.fill(); }
    const [sx, sy] = this.mmPoint(mmPath[0][0], mmPath[0][1]); mctx.fillStyle = '#1d2440'; mctx.fillRect(sx - 6, sy - 6, 12, 12);
    for (const r of racers) {
      if (r.isPlayer) continue;
      const [px, py] = this.mmPoint(r.pos.x, r.pos.z); mctx.fillStyle = '#' + r.ch.kart.toString(16).padStart(6, '0'); mctx.strokeStyle = '#1d2440'; mctx.lineWidth = 3;
      mctx.beginPath(); mctx.arc(px, py, 8, 0, 7); mctx.fill(); mctx.stroke();
    }
    const p = racers.find((r) => r.isPlayer); const [px, py] = this.mmPoint(p.pos.x, p.pos.z);
    mctx.fillStyle = '#ffd23f'; mctx.strokeStyle = '#1d2440'; mctx.lineWidth = 4; mctx.beginPath(); mctx.arc(px, py, 12, 0, 7); mctx.fill(); mctx.stroke();
  },
  onApproach(visible) { $('approachCue').hidden = !visible; },
  onResumeReady(visible) { $('resumeCue').hidden = !visible; if(visible) $('feedback').classList.remove('show'); },
  onHud(s) {
    hudEls.item.hidden = !(s.item || s.shield || this.rolling);
    renderReadyItem(s.item);
    if (s.rank !== lastHud.rank) {
      hudEls.pos.innerHTML = `${s.rank}<sup>${ORD(s.rank)}</sup>`;
      if (s.state === 'racing' && lastHud.rank && s.rank < lastHud.rank) {
        const cue = $('positionCue'); cue.textContent = s.rank === 1 ? 'Into the lead!' : `${s.rank}${ORD(s.rank)} place!`;
        cue.hidden = false; clearTimeout(this.positionTimer);
        this.positionTimer = setTimeout(() => { cue.hidden = true; }, 1800);
        if (!game.reducedMotion) hudEls.pos.animate?.([{transform:'scale(1.18)'},{transform:'scale(1)'}],{duration:280});
      }
    }
    hudEls.pos.classList.toggle('leading', s.rank === 1);
    if (s.lap !== lastHud.lap || s.laps !== lastHud.laps) hudEls.lap.textContent = `LAP ${s.lap}/${s.laps}`;
    hudEls.timer.textContent = fmtTime(s.time);
    if (s.stars !== lastHud.stars) hudEls.stars.textContent = `⭐ ${s.stars}`;
    const kmh = Math.round(s.speed * 3.1); if (kmh !== lastHud.kmh) hudEls.speedo.innerHTML = `${kmh}<small> km/h</small>`;
    lastHud.kmh = kmh;
    if ((s.item !== lastHud.item || s.shield !== lastHud.shield) && !this.rolling) { if(s.item) showItemPicture(hudEls.itemIcon, s.item); else hudEls.itemIcon.textContent = s.shield ? '🫧' : ''; hudEls.itemName.textContent = s.item ? `${itemAction(s.item)} · ${touchDevice ? 'Tap icon' : 'Space'}` : (s.shield ? 'Shield active' : ''); }
    if (s.drift.active) { hudEls.drift.classList.add('show'); hudEls.driftBar.style.width = `${Math.min(100, s.drift.charge / 2.2 * 100)}%`; hudEls.driftBar.style.background = s.drift.charge > 2.2 ? '#ff9a2e' : s.drift.charge > 1 ? '#7bdcff' : '#fff'; }
    else hudEls.drift.classList.remove('show');
    Object.assign(lastHud, { rank: s.rank, lap: s.lap, laps: s.laps, stars: s.stars, item: s.item, shield:s.shield });
    // The map only needs ten updates per second, independently of rendering speed.
    const now = performance.now();
    if (!this.mapDrawAt || now - this.mapDrawAt >= 100) { this.drawMinimap(s.racers); this.mapDrawAt = now; }
  },
  onQuestion(q, approach, lane) {
    const el = $('question');
    if (!q) { el.classList.remove('show'); el.style.transform = 'translateX(-50%) scale(.85)'; this.qKey = null; return; }
    if (this.qKey !== q.key + q.options.join()) { this.qKey = q.key + q.options.join(); $('qText').textContent = q.text + ' = ?'; q.options.forEach((o, i) => { $('o' + i).textContent = o; }); }
    el.classList.add('show'); el.style.transform = `translateX(-50%) scale(${0.85 + (1 - approach) * 0.25})`;
    [0, 1, 2].forEach((i) => $('o' + i).classList.toggle('here', i === lane));
  },
  onFeedback({ correct, title, text }) {
    if (game.resumeDelay > 0) return;
    const el = $('feedback'); el.className = correct ? 'good show' : 'bad show';
    el.innerHTML = `${title || (correct ? 'TURBO!' : 'OOPS!')}<small>${text}</small>`;
    clearTimeout(feedbackTimer); feedbackTimer = setTimeout(() => el.classList.remove('show'), correct ? 1600 : 2400);
  },
  onCountdown(n) {
    if(n <= 2) hideTapGuide();
    const el = $('count'); el.textContent = n === 0 ? 'GO!' : String(n); el.classList.remove('show'); void el.offsetWidth; el.classList.add('show');
    clearTimeout(countTimer); countTimer = setTimeout(() => el.classList.remove('show'), n === 0 ? 900 : 700);
  },
  onLap(lap, final) { const el = $('lapToast'); el.textContent = final ? 'FINAL LAP!' : `LAP ${lap}`; el.classList.add('show'); clearTimeout(lapTimer); lapTimer = setTimeout(() => el.classList.remove('show'), 1600); },
  onItemRoll(item, done) {
    this.rolling = true; hudEls.item.hidden = false; const keys = Object.keys(ITEMS); let i = 0; hudEls.item.classList.add('pop'); hudEls.itemName.textContent = '';
    const tick = () => { hudEls.itemIcon.textContent = ITEMS[keys[i++ % keys.length]].emoji; if (i < 10) setTimeout(tick, 70 + i * 12); else { showItemPicture(hudEls.itemIcon, item); hudEls.itemName.textContent = `${itemAction(item)} · ${touchDevice ? 'Tap icon' : 'Space'}`; hudEls.item.classList.remove('pop'); this.rolling = false; lastHud.item = item; done(); } };
    tick();
  },
  onItemUsed() { renderReadyItem(null); hudEls.itemIcon.textContent = ''; hudEls.itemName.textContent = ''; lastHud.item = null; },
  onPause(p) { if(p){this.onRecovery(null);haptics.stop();releasePad();tapSteering.reset();hideTapGuide();} $('pause').hidden = !p;if(p)sound.ctx?.suspend();else sound.resume(); },
  onQuizOpen(q) {
    this.onRecovery(null);
    haptics.stop();
    releasePad();tapSteering.reset();hideTapGuide(); $('approachCue').hidden = true;
    $('quizQ').textContent = `${q.text} = ?`;
    q.options.forEach((o, i) => { $('qa' + i).textContent = o; });
    document.querySelectorAll('.qopt').forEach((b) => { b.classList.remove('right', 'wrong', 'dim'); b.disabled = false; });
    $('quizCard').className = 'quizCard'; $('quizTitle').textContent = 'Maths boost! Pick the answer';
    $('quizCountdown').setAttribute('aria-valuenow','10'); $('quizCountdown').setAttribute('aria-valuetext','10 seconds remaining'); $('quizCountdown').classList.remove('urgent');
    $('bonusLabel').textContent = '10 seconds. The faster you answer, the bigger your boost!';
    $('bonusBar').style.transform = 'scaleX(1)';
    $('question').classList.remove('show'); $('feedback').classList.remove('show');
    $('quiz').hidden = false;
    // Hide driving buttons so taps land on the answers, and release anything held
    document.body.classList.add('quizOpen');
    for (const k in touch) if (typeof touch[k] === 'boolean') touch[k] = false;
    document.querySelectorAll('.tbtn.active').forEach((el) => el.classList.remove('active'));
  },
  onQuizTick(f, seconds) { $('bonusBar').style.transform = `scaleX(${f})`; $('quizCountdown').setAttribute('aria-valuenow',seconds.toFixed(1)); $('quizCountdown').setAttribute('aria-valuetext',`${Math.ceil(seconds)} seconds remaining`); $('quizCountdown').classList.toggle('urgent', seconds <= 3); },
  onQuizResult({ choice, correct, fast, timedOut, correctIndex, answer, text, reward }) {
    document.querySelectorAll('.qopt').forEach((b, i) => { b.disabled = true; if (i === correctIndex) b.classList.add('right'); else if (i === choice) b.classList.add('wrong'); else b.classList.add('dim'); });
    $('quizCard').className = 'quizCard ' + (correct ? 'good' : 'bad');
    $('quizTitle').textContent = correct ? (fast ? 'Super turbo!' : 'Correct! Turbo boost!') : timedOut ? 'Time’s up! Here is the answer' : 'Here is the answer';
    $('quizQ').textContent = `${text} = ${answer}`;
    $('quizCountdown').setAttribute('aria-valuetext',timedOut?'Time is up':'Answer submitted');
    $('bonusLabel').textContent = correct ? `${reward.duration.toFixed(1)} second boost coming up!` : 'A short slowdown, then keep racing. You can get the next one!';
  },
  onQuizClose() { $('quiz').hidden = true; document.body.classList.remove('quizOpen'); },
  onFinish(results) { haptics.stop();tapSteering.reset();hideTapGuide();showResults(results);notify('complete',{runId,asked:results.asked,correct:results.correct,time:results.time,rank:results.rank,track:setup.trackId,classLevel:setup.levelId,easy:drivingChoice(setup) === 'relaxed'}); },
};

// ---------- Screens ----------
const screens = ['connecting', 'setup', 'hud', 'pause', 'results', 'loading'];
function show(...ids) { if(!ids.includes('hud')){tapSteering.reset();hideTapGuide();} for (const s of screens) $(s).hidden = !ids.includes(s); }

const game = new Game({ canvas: $('gl'), sound, ui });
window.__game = game;
const haptics = createHaptics({ enabled: () => setup.haptics,
  active: () => touchDevice && !document.hidden && !game.paused && !game.contextLost && !game.quiz && game.state === 'racing' });
function renderHaptics() {
  const button = $('btnHaptics');
  button.hidden = !haptics.supported || !touchDevice;
  button.textContent = `Haptics: ${setup.haptics ? 'On' : 'Off'}`;
  button.classList.toggle('on', setup.haptics);
  button.setAttribute('aria-pressed', String(setup.haptics));
}
$('btnHaptics').addEventListener('click', () => {
  setup.haptics = !setup.haptics; haptics.stop(); saveSetup(); renderHaptics();
});
window.addEventListener('pagehide', () => haptics.stop());
window.addEventListener('blur', () => haptics.stop());
let progress = null,runId=null;

// Setup is three taps: class, racer, track. Everything else uses a sensible default.
const PICKABLE = CHARACTERS.filter((c) => c.pick);
const portraits = {};
function makePortraits() {
  let r;
  // Render each racer once to a picture, then free the renderer
  try {
    const canvas = document.createElement('canvas'); canvas.width = 360; canvas.height = 300;
    r = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
    r.outputColorSpace = THREE.SRGBColorSpace; r.toneMapping = THREE.ACESFilmicToneMapping; r.toneMappingExposure = 0.95;
    const scene = new THREE.Scene(); scene.environment = game.envMap;
    scene.add(new THREE.HemisphereLight(0xeef8ff, 0xc9ecb8, 1.2)); scene.add(new THREE.AmbientLight(0xfff6ee, 0.4)); const sun = new THREE.DirectionalLight(0xfff2e0, 1.8); sun.position.set(3, 6, 5); scene.add(sun);
    const cam = new THREE.PerspectiveCamera(30, 360 / 300, 0.1, 50); cam.position.set(2.6, 2.3, 4.6); cam.lookAt(0, 0.9, 0);
    for (const ch of PICKABLE) {
      const k = buildKart(ch); k.blob.visible = false; k.group.rotation.y = 0.35; scene.add(k.group);
      r.render(scene, cam); portraits[ch.id] = canvas.toDataURL('image/png'); scene.remove(k.group);
    }
  } catch (e) { /* portraits are decoration: fall back to names only */ }
  finally { r?.dispose(); r?.forceContextLoss(); }
}
function buildSetup() {
  if (!PICKABLE.some((c) => c.id === setup.charId)) setup.charId = PICKABLE[0].id;
  if (!Object.keys(portraits).length) makePortraits();
  $('levels').innerHTML = LEVELS.map((l) => `<button class="chip ${l.id === setup.levelId ? 'on' : ''}" data-level="${l.id}">${l.name.split(' ')[0]}<small>class</small></button>`).join('');
  if(host){$('levels').hidden=true;const heading=$('levels').previousElementSibling;heading.textContent=`Ready, ${host.name}?`;if(host.avatar){const portrait=document.createElement('img');portrait.className='learnerPortrait';portrait.src=host.avatar;portrait.alt='';heading.prepend(portrait);}}
  const level = LEVELS.find((l) => l.id === setup.levelId);
  $('levelBlurb').textContent = `${level.name} · ${level.blurb}`;
  const on = opsFor(level);
  $('ops').innerHTML = level.ops.map((op) => `<button class="chip ${on.includes(op) ? 'on' : ''}" data-op="${op}" aria-pressed="${on.includes(op)}">${OP_SYMBOL[op]}<small>${OP_SHORT[op]}</small></button>`).join('');
  $('racers').innerHTML = PICKABLE.map((c) => `<button class="racer ${c.id === setup.charId ? 'on' : ''}" data-char="${c.id}" aria-pressed="${c.id === setup.charId}">${portraits[c.id] ? `<img src="${portraits[c.id]}" alt="">` : ''}<b>${c.name}</b><small>${c.species}</small></button>`).join('');
  renderTilt(); renderEasy(); renderTap(); renderHaptics();
  $('tracks').innerHTML = TRACKS.map((t) => `<button class="track ${t.id === setup.trackId ? 'on' : ''}" data-track="${t.id}" aria-pressed="${t.id === setup.trackId}"><img class="pic" src="../assets/turbo-track-${t.id}.jpg" alt="" width="640" height="360"><b>${t.name}</b></button>`).join('');
}
$('levels').addEventListener('click', (e) => { const b = e.target.closest('[data-level]'); if (!b) return; setup.levelId = +b.dataset.level; sound.click(); buildSetup(); });
// Topics: each class remembers which kinds of sums to practise. At least one stays on.
function opsFor(level) { if (!setup.opsByLevel || typeof setup.opsByLevel !== 'object') setup.opsByLevel = {}; const saved = (setup.opsByLevel[level.id] || level.ops).filter((o) => level.ops.includes(o)); return saved.length ? saved : level.ops.slice(); }
$('ops').addEventListener('click', (e) => {
  const b = e.target.closest('[data-op]'); if (!b) return;
  const level = LEVELS.find((l) => l.id === setup.levelId); const op = b.dataset.op; let on = opsFor(level);
  if (on.includes(op)) { if (on.length === 1) { b.animate?.([{ transform: 'translateX(-4px)' }, { transform: 'translateX(4px)' }, { transform: 'none' }], { duration: 200 }); return; } on = on.filter((o) => o !== op); }
  else on = level.ops.filter((o) => on.includes(o) || o === op);
  setup.opsByLevel[level.id] = on; sound.click(); saveSetup(); buildSetup();
});
$('racers').addEventListener('click', (e) => { const b = e.target.closest('[data-char]'); if (!b) return; setup.charId = b.dataset.char; sound.click(); saveSetup();buildSetup(); });
$('tracks').addEventListener('click', (e) => { const b = e.target.closest('[data-track]'); if (!b) return; setup.trackId = b.dataset.track; sound.click(); saveSetup();buildSetup(); });

// ---------- Flow ----------
$('btnBack').addEventListener('click', () => notify('exit'));
$('btnGo').addEventListener('click', startRace);
$('btnReloadGraphics').addEventListener('click', () => location.reload());
$('btnAgain').addEventListener('click', startRace);
$('btnSetup').addEventListener('click', () => { sound.click(); game.dispose(); buildSetup(); show('setup'); });
$('btnResume').addEventListener('click', () => game.togglePause(false));
$('btnPause').addEventListener('click', () => game.togglePause(true));
$('btnQuit').addEventListener('click', () => { game.paused = false; game.dispose(); game.state = 'idle'; buildSetup(); show('setup'); });
$('btnMute').addEventListener('click', (e) => { sound.setMuted(!sound.muted); e.target.textContent = sound.muted ? '🔇' : '🔊'; });

function startRace() {
  sound.resume(); sound.click(); saveSetup();
  if (setup.tilt && !tilt.on) enableTilt();
  tilt.center = tilt.seen ? tilt.raw : 0;
  const level = LEVELS.find((l) => l.id === setup.levelId);
  const character = CHARACTERS.find((c) => c.id === setup.charId);
  const trackDef = TRACKS.find((t) => t.id === setup.trackId);
  runId=crypto.randomUUID();
  progress = new Progress(`turbo-tables-progress-${(setup.name || 'racer').toLowerCase()}-${level.id}`,host?(host.progress||{facts:{},history:[]}):null,host?value=>{host.progress=value;notify('progress',value);}:null);
  lastHud = {}; ui.qKey = null; ui.mapDrawAt = 0;
  renderReadyItem(null); clearTimeout(ui.positionTimer); $('positionCue').hidden = true;
  show('loading');
  game.setQuality(touchDevice?'medium':'high');
  // Let the loading card paint before the heavy texture generation starts
  setTimeout(() => {
    game.start({ trackDef, character, level, ops: opsFor(level), progress, laps: 3, autoGas: true, gateMode: 'stop', easy: drivingChoice(setup) === 'relaxed' });
    document.body.classList.toggle('easy', drivingChoice(setup) === 'relaxed');
    show('hud'); game.resize(); showTapGuide();
  }, 60);
}

function showResults(r) {
  const acc = r.asked ? Math.round(r.correct / r.asked * 100) : 0;
  $('rPlace').innerHTML = `${r.rank}<sup>${ORD(r.rank)}</sup>`;
  $('rTitle').textContent = r.rank === 1 ? `${r.character.name} wins!` : r.rank <= 3 ? 'On the podium!' : acc >= 80 ? 'Maths superstar!' : 'Good race!';
  $('rSub').textContent = `${setup.name || 'Racer'} · ${r.level.name} · ${acc >= 90 ? 'Nearly perfect answers.' : acc >= 70 ? 'Great answering under pressure.' : 'Keep practising, every question helps.'}`;
  $('rScores').innerHTML = [
    [fmtTime(r.time), 'Race time'], [isFinite(r.bestLap) ? fmtTime(r.bestLap) : '–', 'Best lap'],
    [`${r.correct}/${r.asked}`, 'Questions correct'], [`${acc}%`, 'Accuracy'], [`⭐ ${r.stars}`, 'Stars earned'],
    ...(r.avgTime !== null && r.avgTime !== undefined ? [[`${r.avgTime.toFixed(1)}s`, 'Average answer time']] : []),
  ].map(([v, l]) => `<div class="score"><b>${v}</b><small>${l}</small></div>`).join('');
  $('rWeak').innerHTML = r.weak.length ? r.weak.map((k) => `<span>${describeFact(k)}</span>`).join('') : '<span>Nothing yet. You know these!</span>';
  $('rLog').innerHTML = r.log.map((e) => `<span class="${e.correct ? 'ok' : 'no'}">${e.q} = ${e.answer}${e.correct ? '' : e.picked === null ? ' (missed)' : ` (you: ${e.picked})`}</span>`).join('');
  show('hud', 'results');
}

// ---------- Easy driving ----------
function renderEasy() {
  const junior = setup.levelId <= 3;
  $('tReverse').hidden = junior;
  document.querySelector('.keys').innerHTML = '<kbd>←</kbd> <kbd>→</kbd> steer · <kbd>Space</kbd> item' + (junior ? '' : ' · <kbd>↓</kbd> brake');
  const choice = drivingChoice(setup);
  $('easyMsg').textContent = ({relaxed:'Gentler speed, stronger steering help and forgiving opponents.',challenging:'Full speed, independent steering and faster opponents.'})[choice] + (junior ? '' : ' Hold brake to slow down.');
}
function showItemPicture(container, id) {
  const picture = document.createElement('img'); picture.src = `icons/${id}.svg`; picture.alt = ITEMS[id].name;
  container.replaceChildren(picture);
}
let readyItem;
function renderReadyItem(id) {
  const button = $('tItem'); button.hidden = !id;
  if (id === readyItem) return;
  readyItem = id;
  if (!id) { button.replaceChildren(); button.removeAttribute('aria-label'); return; }
  const item = ITEMS[id], action = itemAction(id);
  const picture = document.createElement('img'); picture.src = `icons/${id}.svg`; picture.alt = '';
  const caption = document.createElement('span'); caption.textContent = action;
  button.replaceChildren(picture, caption);
  button.setAttribute('aria-label', `${action}: ${item.name}. ${item.hint}`);
  button.title = `${item.name}: ${item.hint}`;
}

// ---------- Tilt to steer ----------
// Uses the phone's orientation sensor. Some hosts block the sensor, so we check that readings arrive.
const tilt = { on: false, raw: 0, center: 0, seen: false, listening: false };
function tiltAngle(e) {
  if (e.beta == null || e.gamma == null) return null;
  const ang = (((screen.orientation && screen.orientation.angle) ?? window.orientation ?? 0) % 360 + 360) % 360;
  // Negative means the left side of the screen is lower
  if (ang === 90) return e.beta; if (ang === 270) return -e.beta; if (ang === 180) return -e.gamma; return e.gamma;
}
function onTilt(e) {
  if (!tilt.on) return;
  const v = tiltAngle(e); if (v === null) return;
  if (!tilt.seen || tilt.center === null) tilt.center = v;
  tilt.seen = true; tilt.raw = v;
  const d = v - tilt.center; const dz = Math.abs(d) < 3 ? 0 : d - Math.sign(d) * 3;
  touch.tiltSteer = Math.max(-1, Math.min(1, -dz / 18));
}
function renderTap(){
  const b=$('btnTap');b.textContent=`Tap to steer: ${setup.tap?'On':'Off'}`;b.classList.toggle('on',setup.tap);b.setAttribute('aria-pressed',String(setup.tap));
  document.body.classList.toggle('tapSteering',setup.tap && touchDevice);
}
function renderTilt(msg) {
  const b = $('btnTilt'); b.textContent = `Tilt to steer: ${setup.tilt ? 'On' : 'Off'}`; b.classList.toggle('on', setup.tilt); b.setAttribute('aria-pressed', String(setup.tilt));
  document.body.classList.toggle('tilt', tilt.on);
  if (msg !== undefined) $('tiltMsg').textContent = msg;
}
function tiltFail(msg) { tilt.on = false; setup.tilt = false; touch.tiltSteer = null; saveSetup(); renderTilt(msg); }
// Must be called straight from a tap: iPhones only ask for motion access inside a tap
function enableTilt() {
  const finish = () => {
    if(!setup.tilt)return;
    if (!tilt.listening) { window.addEventListener('deviceorientation', onTilt);
      screen.orientation?.addEventListener('change', () => { tilt.center = null; touch.tiltSteer = null; }); tilt.listening = true; }
    tilt.on = true; tilt.seen = false; tilt.center = null; renderTilt('Hold your device level, then tilt like a steering wheel.');
    setTimeout(() => { if (tilt.on && !tilt.seen) tiltFail('Tilt is not available here, so use the driving pad. Some apps block the motion sensor.'); }, 1500);
  };
  try {
    if (typeof DeviceOrientationEvent !== 'undefined' && typeof DeviceOrientationEvent.requestPermission === 'function') {
      DeviceOrientationEvent.requestPermission().then((r) => { if (r === 'granted') finish(); else tiltFail('Tilt needs motion access, so use the driving pad.'); }).catch(() => tiltFail('Tilt is not available here, so use the driving pad.'));
    } else if (typeof DeviceOrientationEvent !== 'undefined') finish();
    else tiltFail('This device has no tilt sensor, so use the driving pad.');
  } catch (e) { tiltFail('Tilt is not available here, so use the driving pad.'); }
}
$('btnTilt').addEventListener('click', () => {
  sound.click(); setup.tilt = !setup.tilt; if(setup.tilt){setup.tap=false;tapSteering.reset();renderTap();}saveSetup();
  if (setup.tilt) enableTilt(); else { tilt.on = false; touch.tiltSteer = null; renderTilt(''); }
});

$('btnTap').addEventListener('click',()=>{
  sound.click();setup.tap=!setup.tap;releasePad();tapSteering.reset();hideTapGuide();
  if(setup.tap){setup.tilt=false;tilt.on=false;touch.tiltSteer=null;renderTilt('');}
  renderTap();saveSetup();
});

// ---------- Maths stop answers (mouse and touch) ----------
document.querySelectorAll('.qopt').forEach((b) => b.addEventListener('pointerdown', (e) => { e.preventDefault(); game.answerQuiz(+b.dataset.choice); }));

// ---------- Touch controls ----------
game.setTouch(touch);
for (const [id, key] of [['tGas', 'gas'], ['tReverse', 'reverse'], ['tItem', 'item']]) {
  const el = $(id);
  const on = (e) => { e.preventDefault(); touch[key] = true; el.setPointerCapture(e.pointerId); el.classList.add('active'); };
  const off = (e) => { e.preventDefault(); touch[key] = false; el.classList.remove('active'); };
  el.addEventListener('pointerdown', on); el.addEventListener('pointerup', off); el.addEventListener('pointercancel', off); el.addEventListener('lostpointercapture', off);
}

// One thumb steers and accelerates. Pointer capture keeps gas held even
// when the thumb slips beyond the circle; only lifting or cancelling releases it.
const pad = $('drivePad'), knob = $('driveKnob');
let padPointer = null;
function releasePad() {
  padPointer = null; touch.gas = false; touch.padSteer = null;
  knob.style.transform = ''; pad.classList.remove('active');
}
function movePad(e) {
  if (e.pointerId !== padPointer) return;
  const rect = pad.getBoundingClientRect(), radius = rect.width / 2;
  const x = Math.max(-1, Math.min(1, (e.clientX - rect.left - radius) / (radius * 0.75)));
  const y = Math.max(-1, Math.min(1, (e.clientY - rect.top - radius) / (radius * 0.75)));
  touch.gas = true;
  touch.padSteer = tilt.on ? null : (Math.abs(x) < 0.16 ? 0 : -Math.sign(x) * (Math.abs(x) - 0.16) / 0.84);
  const scale = Math.max(1, Math.hypot(x, y));
  knob.style.transform = `translate(${x / scale * radius * 0.5}px,${y / scale * radius * 0.5}px)`;
}
pad.addEventListener('pointerdown', e => {
  if (padPointer !== null || (e.pointerType === 'mouse' && e.button !== 0)) return;
  e.preventDefault(); padPointer = e.pointerId; pad.setPointerCapture(e.pointerId);
  pad.classList.add('active'); movePad(e);
});
pad.addEventListener('pointermove', movePad);
for (const name of ['pointerup', 'pointercancel', 'lostpointercapture']) pad.addEventListener(name, e => { if(e.pointerId === padPointer) releasePad(); });
window.addEventListener('blur', releasePad);
const touchDevice=navigator.maxTouchPoints>0||matchMedia('(any-pointer:coarse)').matches;
const tapSteering=createTapSteering($('tapSteering'),{
  enabled:()=>setup.tap && !setup.tilt && !game.paused && !game.quiz && ['countdown','racing'].includes(game.state) && !$('hud').hidden && $('results').hidden,
  setSteer:value=>{touch.padSteer=value;$('tapSteering').dataset.steer=value===1?'left':value===-1?'right':'';}
});
let tapGuideTimer=null;
function hideTapGuide(){clearTimeout(tapGuideTimer);$('tapGuide').hidden=true;document.body.classList.remove('tapGuideVisible');}
function showTapGuide(){hideTapGuide();if(!touchDevice||!setup.tap)return;$('tapGuide').hidden=false;document.body.classList.add('tapGuideVisible');tapGuideTimer=setTimeout(hideTapGuide,6500);}
window.addEventListener('blur',()=>{tapSteering.reset();hideTapGuide();});
window.addEventListener('resize',()=>tapSteering.reset());
if(host){$('btnBack').textContent='← Back to games';$('btnPause').hidden=true;}
window.addEventListener('message',e=>{if(!host||e.source!==window.parent||e.origin!==location.origin||e.data?.source!=='maths-quest'||e.data.token!==new URLSearchParams(location.search).get('token'))return;if(e.data.type==='pause')game.togglePause();if(e.data.type==='stop'){tapSteering.reset();hideTapGuide();game.togglePause(true);sound.setMuted(true);game.dispose();}});
document.addEventListener('visibilitychange',()=>{if(document.hidden){tapSteering.reset();hideTapGuide();releasePad();game.togglePause(true);game.keys={};for(const k in touch)if(typeof touch[k]==='boolean')touch[k]=false;}});
buildSetup();
show('setup');notify('loaded');
