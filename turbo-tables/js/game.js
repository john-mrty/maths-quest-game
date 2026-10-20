import * as THREE from 'three';
import { Track, ROAD_HALF, LANES } from './track.js';
import { buildKart, buildItemBox, buildJelly, buildBall, CHARACTERS } from './karts.js';
import { QuestionBank } from './maths.js';
import * as TEX from './textures.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { GTAOPass } from 'three/addons/postprocessing/GTAOPass.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const lerp = (a, b, t) => a + (b - a) * t;
const wrapAngle = (a) => Math.atan2(Math.sin(a), Math.cos(a));
const UP = new THREE.Vector3(0, 1, 0);
// Answer keys during a maths stop: first / second / third answer.
const QUIZ_KEYS = { ArrowLeft: 0, KeyA: 0, Digit1: 0, Numpad1: 0, ArrowUp: 1, KeyW: 1, Digit2: 1, Numpad2: 1, ArrowRight: 2, KeyD: 2, Digit3: 2, Numpad3: 2 };
export const ANSWER_SECONDS = 10;
export function answerBoost(seconds) {
  const quickness = clamp(1 - seconds / ANSWER_SECONDS, 0, 1);
  return { duration: 1 + quickness * 2, power: 1.15 + quickness * 0.45 };
}

export class Game {
  constructor({ canvas, sound, ui }) {
    this.canvas = canvas; this.sound = sound; this.ui = ui;
    this.quality = 'high';
    this.reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.75));
    this.renderer.shadowMap.enabled = true; this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping; this.renderer.toneMappingExposure = 0.92;
    // Image based lighting for reflections on paint and chrome
    const pmrem = new THREE.PMREMGenerator(this.renderer); this.envMap = pmrem.fromScene(new RoomEnvironment(), 0.04).texture; pmrem.dispose();
    this.composer = null;
    this.timeScale = 1; this.quiz = null; this.gateMode = 'stop';
    this.camera = new THREE.PerspectiveCamera(65, 1, 0.5, 1500);
    this.input = { throttle: 0, brake: 0, steer: 0, drift: false, item: false, driftPressed: false, itemPressed: false };
    this.keys = {};
    this.state = 'idle'; this.paused = false;
    this.clock = new THREE.Clock();
    this.time = 0;
    this.bindInput();
    window.addEventListener('resize', () => this.resize());
    this.resize();
    this.loop = this.loop.bind(this);
    requestAnimationFrame(this.loop);
  }

  resize() {
    const w = this.canvas.clientWidth || window.innerWidth, h = this.canvas.clientHeight || window.innerHeight;
    this.renderer.setSize(w, h, false); this.camera.aspect = w / h; this.camera.updateProjectionMatrix();
    if (this.composer) { this.composer.setSize(w, h); this.composer.setPixelRatio(this.renderer.getPixelRatio()); }
  }
  setQuality(q) {
    this.quality = q;
    this.renderer.setPixelRatio(q === 'high' ? Math.min(window.devicePixelRatio || 1, 1.75) : 1);
    this.resize();
  }
  buildComposer() {
    const w = this.canvas.clientWidth || window.innerWidth, h = this.canvas.clientHeight || window.innerHeight;
    this.composer = new EffectComposer(this.renderer); this.composer.setPixelRatio(this.renderer.getPixelRatio()); this.composer.setSize(w, h);
    this.composer.addPass(new RenderPass(this.scene, this.camera));
    // Soft contact shading between parts makes the clay read as solid, hand-made objects. Skipped on phones to keep them smooth.
    if (this.quality === 'high' && !document.body.classList.contains('touch')) {
      try { const ao = new GTAOPass(this.scene, this.camera, w, h); ao.updateGtaoMaterial({ radius: 0.9, distanceExponent: 1.5, thickness: 1.5, scale: 1.1, samples: 12 }); ao.updatePdMaterial({ lumaPhi: 10, depthPhi: 2, normalPhi: 3, radius: 6, rings: 2, samples: 12 }); ao.blendIntensity = 0.85;
        // Leave clouds, glows and see-through overlays out of the shading pass, or they show up as dark squares
        const hide = ao.overrideVisibility.bind(ao);
        ao.overrideVisibility = function () { hide(); this.scene.traverse((o) => { if (o.isSprite || (o.material && o.material.transparent && o.material.depthWrite === false)) o.visible = false; }); };
        this.composer.addPass(ao); this.ao = ao; } catch (e) { this.ao = null; }
    }
    if (this.quality === 'high') { this.bloom = new UnrealBloomPass(new THREE.Vector2(w, h), 0.12, 0.4, 0.97); this.composer.addPass(this.bloom); }
    this.composer.addPass(new OutputPass());
  }

  bindInput() {
    const down = (e) => { this.keys[e.code] = true; if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(e.code)) e.preventDefault(); if ((e.code === 'Escape' || e.code === 'KeyP') && !e.repeat) this.togglePause();
      if (this.quiz && !this.quiz.answered && !e.repeat && !this.paused) { const c = QUIZ_KEYS[e.code]; if (c !== undefined) { e.preventDefault(); this.answerQuiz(c); } } };
    const up = (e) => { this.keys[e.code] = false; };
    window.addEventListener('keydown', down); window.addEventListener('keyup', up);
    window.addEventListener('blur', () => { this.keys = {}; });
  }

  togglePause(force) {
    if (!this.scene || !(this.state === 'racing' || this.state === 'countdown')) return;
    this.paused = force ?? !this.paused; this.ui.onPause(this.paused);
    if (this.paused) this.sound.setEngine(0, false);
  }

  readInput() {
    const k = this.keys, t = this.touch || {};
    const gp = navigator.getGamepads ? Array.from(navigator.getGamepads()).find((g) => g) : null;
    let steer = 0;
    if (k.ArrowLeft || k.KeyA || t.left) steer += 1; if (k.ArrowRight || k.KeyD || t.right) steer -= 1;
    if (steer === 0 && typeof t.tiltSteer === 'number') steer = t.tiltSteer;
    let throttle = (k.ArrowUp || k.KeyW || t.gas) ? 1 : 0, reverse = (k.ArrowDown || k.KeyS || t.reverse) ? 1 : 0;
    let drift = !!(k.Space || k.ShiftLeft || k.ShiftRight || t.drift);
    let item = !!(k.KeyE || k.Enter || k.ControlLeft || k.KeyQ || t.item);
    if (gp) {
      if (Math.abs(gp.axes[0]) > 0.15) steer = -gp.axes[0];
      if (gp.buttons[0]?.pressed || gp.buttons[7]?.value > 0.2) throttle = Math.max(throttle, gp.buttons[7]?.value || 1);
      if (gp.buttons[2]?.pressed || gp.buttons[6]?.value > 0.2) reverse = 1;
      if (gp.buttons[1]?.pressed || gp.buttons[5]?.pressed) drift = true;
      if (gp.buttons[3]?.pressed || gp.buttons[4]?.pressed) item = true;
      if (gp.buttons[14]?.pressed) steer = 1; if (gp.buttons[15]?.pressed) steer = -1;
    }
    if (this.autoGas) throttle = Math.max(throttle, 1);
    const i = this.input;
    i.driftPressed = drift && !i.drift; i.driftReleased = !drift && i.drift;
    i.itemPressed = item && !i.item;
    i.steer = lerp(i.steer, steer, 0.35); i.throttle = throttle; i.reverse = reverse; i.brake = 0; i.drift = drift; i.item = item;
  }

  // ---------- Race setup ----------
  start({ trackDef, character, level, ops, progress, laps, autoGas, gateMode, easy }) {
    this.dispose();
    this.scene = new THREE.Scene();
    this.scene.environment = this.envMap;
    this.scene.fog = new THREE.FogExp2(trackDef.fog, trackDef.stars ? 0.0022 : 0.0016);
    this.autoGas = !!autoGas; this.easy = !!easy;
    this.gateMode = 'stop'; this.bonusTime = ANSWER_SECONDS;
    this.quiz = null; this.timeScale = 1; this.ui.onQuizClose?.();
    this.track = new Track(trackDef, this.quality); this.scene.add(this.track.group);
    this.buildComposer();
    this.laps = laps || trackDef.laps;
    this.progress = progress; this.level = level;
    this.bank = new QuestionBank(level, ops, progress);
    this.buildSky(trackDef); this.buildLights(trackDef);
    this.buildGates(); this.buildItemBoxes(); this.buildBoostPads();
    this.buildParticles();
    this.camera.clear(); this.scene.add(this.camera);
    const streaks = [], streakCount = this.quality === 'high' ? 24 : 12;
    for (let i = 0; i < streakCount; i++) {
      const side = i % 2 ? -1 : 1, x = side * (5 + i % 3), y = ((i * 1.7) % 8) - 4, z = -8 - i % 5;
      streaks.push(x, y, z, x * 1.16, y * 1.16, z + 2.2);
    }
    const streakG = new THREE.BufferGeometry(); streakG.setAttribute('position', new THREE.Float32BufferAttribute(streaks, 3));
    this.speedStreaks = new THREE.LineSegments(streakG, new THREE.LineBasicMaterial({ color: 0xfff1ce, transparent: true, opacity: 0, depthWrite: false, depthTest: false }));
    this.speedStreaks.frustumCulled = false; this.camera.add(this.speedStreaks);
    this.entities = [];
    this.buildRacers(character);
    this.stats = { asked: 0, correct: 0, stars: 0, log: [], times: [] };
    this.state = 'countdown'; this.countdown = 4.2; this.lastCount = 4; this.raceTime = 0; this.time = 0; this.paused = false;
    this.ui.setTrack(this.track);
    this.ui.onCountdown(3);
    this.sound.resume(); this.sound.startEngine(); this.sound.startMusic(trackDef.id === 'moon' ? 2 : trackDef.id === 'candy' ? 1 : 0);
    this.clock.getDelta();
  }

  dispose() {
    if (this.scene) {
      const seen = new Set();
      this.scene.traverse((o) => {
        if (o.geometry) o.geometry.dispose?.();
        const mats = Array.isArray(o.material) ? o.material : o.material ? [o.material] : [];
        for (const m of mats) { if (seen.has(m)) continue; seen.add(m); for (const k of ['map', 'normalMap', 'roughnessMap', 'emissiveMap']) if (m[k]?.dispose) m[k].dispose(); m.dispose?.(); }
      });
      this.scene = null;
    }
    if (this.composer) { this.composer.dispose?.(); this.composer = null; }
    if (this.quiz) { this.quiz = null; this.ui.onQuizClose?.(); }
    this.timeScale = 1;
    this.sound.stopMusic(); this.sound.stopEngine && this.sound.setEngine(0, false);
  }

  buildSky(def) {
    const geo = new THREE.SphereGeometry(900, 24, 12);
    const mat = new THREE.ShaderMaterial({
      side: THREE.BackSide, depthWrite: false, fog: false,
      uniforms: { top: { value: new THREE.Color(def.sky) }, bottom: { value: new THREE.Color(def.skyBottom) }, horizon: { value: new THREE.Color(def.horizon) }, sunDir: { value: new THREE.Vector3(...def.sun).normalize() }, sunCol: { value: new THREE.Color(def.sunColour) }, night: { value: def.stars ? 1 : 0 } },
      vertexShader: 'varying vec3 vP; void main(){ vP = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
      fragmentShader: `uniform vec3 top; uniform vec3 bottom; uniform vec3 horizon; uniform vec3 sunDir; uniform vec3 sunCol; uniform float night; varying vec3 vP;
        void main(){ vec3 d = normalize(vP); float h = clamp(d.y, 0.0, 1.0);
          vec3 col = mix(bottom, top, pow(h, 0.55));
          col = mix(horizon, col, smoothstep(0.0, 0.18, h));
          float sd = max(dot(d, sunDir), 0.0);
          col += sunCol * (pow(sd, 350.0) * 2.5 * (1.0 - night) + pow(sd, 6.0) * 0.25 + pow(sd, 1.5) * 0.08);
          gl_FragColor = vec4(col, 1.0); }`,
      toneMapped: true,
    });
    this.sky = new THREE.Mesh(geo, mat); this.scene.add(this.sky);
    // Sun glare sprite
    if (!def.stars) { const glare = new THREE.Sprite(new THREE.SpriteMaterial({ map: TEX.softSprite(), color: def.sunColour, transparent: true, opacity: 0.55, depthWrite: false, depthTest: false, fog: false })); glare.scale.set(220, 220, 1); glare.position.set(...def.sun).normalize().multiplyScalar(820); this.scene.add(glare); }
  }

  buildLights(def) {
    const hemi = new THREE.HemisphereLight(def.skyBottom, def.ground, def.hemi); this.scene.add(hemi);
    this.scene.add(new THREE.AmbientLight(0xfff6ee, 0.32));
    const rim = new THREE.DirectionalLight(def.stars ? 0x989bff : 0xc5e9ff, 0.65);
    rim.position.set(-60, 35, -80); this.scene.add(rim);
    const sun = new THREE.DirectionalLight(def.sunColour, def.sunIntensity); this.sunOffset = new THREE.Vector3(...def.sun); sun.position.copy(this.sunOffset);
    sun.castShadow = true; const res = this.quality === 'high' ? 2048 : 1024; sun.shadow.mapSize.set(res, res);
    const s = 75; Object.assign(sun.shadow.camera, { left: -s, right: s, top: s, bottom: -s, near: 1, far: 400 }); sun.shadow.bias = -0.0004; sun.shadow.normalBias = 0.04; sun.shadow.radius = 4;
    this.scene.add(sun); this.scene.add(sun.target); this.sun = sun;
  }

  // ---------- Maths gates ----------
  buildGates() {
    // Invisible checkpoints schedule questions; answers no longer depend on a lane.
    this.gates = this.track.gateIndices.map(index => ({ index, q: this.bank.next(), lastAskedLap: -1 }));
  }
  refreshGate(gate) {
    gate.q = this.bank.next();
  }

  // ---------- Items ----------
  buildItemBoxes() {
    this.itemBoxes = [];
    for (const ii of this.track.itemIndices) {
      const s = this.track.sampleAt(ii);
      for (const lane of LANES) {
        const mesh = buildItemBox(); const pos = s.pos.clone().addScaledVector(s.right, lane); pos.y += 1.2;
        mesh.position.copy(pos); this.scene.add(mesh);
        this.itemBoxes.push({ mesh, pos, active: true, respawn: 0, phase: Math.random() * 6 });
      }
    }
  }
  buildBoostPads() {
    this.boostPads = [];
    const c = document.createElement('canvas'); c.width = 256; c.height = 128; const x = c.getContext('2d');
    x.fillStyle = '#ff9a2e'; x.fillRect(0, 0, 256, 128); x.fillStyle = '#fff176';
    for (let i = 0; i < 3; i++) { x.beginPath(); x.moveTo(30, 20 + i * 36); x.lineTo(128, 40 + i * 36); x.lineTo(226, 20 + i * 36); x.lineTo(226, 40 + i * 36); x.lineTo(128, 60 + i * 36); x.lineTo(30, 40 + i * 36); x.closePath(); x.fill(); }
    const tex = new THREE.CanvasTexture(c);
    for (const bi of this.track.boostIndices) {
      const s = this.track.sampleAt(bi);
      tex.colorSpace = THREE.SRGBColorSpace; const pad = new THREE.Mesh(new THREE.PlaneGeometry(ROAD_HALF * 2 - 2, 6), new THREE.MeshStandardMaterial({ map: tex, emissive: 0xffffff, emissiveMap: tex, emissiveIntensity: 0.5, roughness: 0.4, polygonOffset: true, polygonOffsetFactor: -2 }));
      pad.position.copy(s.pos); pad.position.y += 0.06; pad.rotation.set(-Math.PI / 2, 0, -Math.atan2(s.right.z, s.right.x));
      // make the arrows point along the tangent
      pad.rotation.set(0, 0, 0); pad.lookAt(s.pos.clone().add(s.tangent)); pad.rotateX(-Math.PI / 2); pad.rotateZ(Math.PI);
      this.scene.add(pad); this.boostPads.push({ index: bi, mesh: pad });
    }
  }

  // ---------- Racers ----------
  buildRacers(playerCh) {
    this.racers = [];
    const n = this.track.samples.length;
    const others = CHARACTERS.filter((c) => c.id !== playerCh.id).sort(() => Math.random() - 0.5);
    const grid = [playerCh, ...others].slice(0, 6);
    // Player starts in the middle of the pack
    const order = [grid[1], grid[2], grid[3], grid[0], grid[4], grid[5]].filter(Boolean);
    order.forEach((ch, i) => {
      const row = Math.floor(i / 2), col = i % 2;
      const idx = n - 4 - row * 4; const s = this.track.sampleAt(idx);
      const pos = s.pos.clone().addScaledVector(s.right, col ? 3.2 : -3.2);
      const kart = buildKart(ch);
      kart.group.position.copy(pos);
      this.scene.add(kart.group);
      const isPlayer = ch === playerCh && i === 3;
      const r = {
        id: i, ch, isPlayer, kart, pos, heading: Math.atan2(s.tangent.x, s.tangent.z), speed: 0, lateralVel: 0,
        idx, lap: 0, checkpoint: false, progress: 0, finished: false, finishTime: 0, rank: i + 1,
        drift: { active: false, dir: 0, charge: 0 }, hop: 0, boost: 0, boostPower: 1, spin: 0, slow: 0, offroad: false,
        item: null, shield: false, bestLap: Infinity, lapStart: 0,
        stats: { max: 26 + ch.speed * 1.6, accel: 9 + ch.accel * 1.6, handling: 1.4 + ch.handling * 0.16, mass: 0.8 + (ch.id === 'bruno' ? 0.6 : ch.id === 'kiki' ? -0.3 : 0) },
        ai: isPlayer ? null : { lane: (Math.random() - 0.5) * 7, laneTarget: (Math.random() - 0.5) * 7, laneTimer: 0, skill: 0.55 + Math.random() * 0.35, pace: 0.86 + Math.random() * 0.1, itemTimer: 0, gateChoice: null, lastGate: -1 },
        prevIdx: idx, wheelSpin: 0, visualTilt: 0, visualSteer: 0, push: new THREE.Vector3(), laneLock: null,
      };
      this.racers.push(r);
      if (isPlayer) this.player = r;
    });
    this.player.ai = null;
  }

  // ---------- Particles ----------
  buildParticles() {
    const N = 400; this.pN = N;
    const pos = new Float32Array(N * 3), col = new Float32Array(N * 3);
    this.pLife = new Float32Array(N); this.pVel = new Float32Array(N * 3);
    for (let i = 0; i < N; i++) { pos[i * 3 + 1] = -100; }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(pos, 3)); g.setAttribute('color', new THREE.BufferAttribute(col, 3));
    this.particles = new THREE.Points(g, new THREE.PointsMaterial({ size: 0.9, vertexColors: true, transparent: true, opacity: 0.95, sizeAttenuation: true, depthWrite: false, map: TEX.softSprite(), blending: THREE.AdditiveBlending }));
    this.particles.frustumCulled = false; this.scene.add(this.particles); this.pCursor = 0;
  }
  emit(p, v, colour, life = 0.6) {
    const i = this.pCursor; this.pCursor = (this.pCursor + 1) % this.pN;
    const pa = this.particles.geometry.attributes.position.array, ca = this.particles.geometry.attributes.color.array;
    pa[i * 3] = p.x; pa[i * 3 + 1] = p.y; pa[i * 3 + 2] = p.z;
    this.pVel[i * 3] = v.x; this.pVel[i * 3 + 1] = v.y; this.pVel[i * 3 + 2] = v.z; this.pLife[i] = life;
    const c = new THREE.Color(colour); ca[i * 3] = c.r; ca[i * 3 + 1] = c.g; ca[i * 3 + 2] = c.b;
  }
  updateParticles(dt) {
    const pa = this.particles.geometry.attributes.position.array;
    for (let i = 0; i < this.pN; i++) {
      if (this.pLife[i] <= 0) continue;
      this.pLife[i] -= dt;
      pa[i * 3] += this.pVel[i * 3] * dt; pa[i * 3 + 1] += this.pVel[i * 3 + 1] * dt; pa[i * 3 + 2] += this.pVel[i * 3 + 2] * dt;
      this.pVel[i * 3 + 1] -= 12 * dt;
      if (this.pLife[i] <= 0) pa[i * 3 + 1] = -100;
    }
    this.particles.geometry.attributes.position.needsUpdate = true; this.particles.geometry.attributes.color.needsUpdate = true;
  }
  confetti(pos, n = 40, cols = [0xff9fb2, 0xffe08a, 0x9cc4ff, 0x9fe3a8, 0xd2b3ff, 0xffffff]) {
    for (let i = 0; i < n; i++) this.emit(pos.clone().add(new THREE.Vector3(0, 1.5, 0)), new THREE.Vector3((Math.random() - 0.5) * 12, 6 + Math.random() * 8, (Math.random() - 0.5) * 12), cols[i % cols.length], 1.2);
  }

  // ---------- Main loop ----------
  loop() {
    requestAnimationFrame(this.loop);
    const dt = Math.min(0.1, this.clock.getDelta());
    this.frames = (this.frames || 0) + 1;
    if (!this.scene) return;
    this.readInput();
    if (!this.paused) {
      // A maths stop eases the whole race into a freeze, then eases back out after the answer
      const target = this.quiz ? 0 : 1;
      this.timeScale += (target - this.timeScale) * (1 - Math.exp(-(target ? 5 : 9) * dt));
      if (!target && this.timeScale < 0.02) this.timeScale = 0;
      if (target && this.timeScale > 0.98) this.timeScale = 1;
      if (this.quiz) this.updateQuiz(dt);
      const gdt = dt * this.timeScale;
      for (let k = 0; k < (this.simSteps || 1); k++) { this.time += gdt; this.update(gdt); }
    }
    if (this.composer) this.composer.render(); else this.renderer.render(this.scene, this.camera);
  }

  update(dt) {
    this.track.update(dt, this.time);
    if (this.state === 'countdown') {
      this.countdown -= dt;
      const c = Math.ceil(this.countdown - 0.2);
      if (c !== this.lastCount && c >= 0 && c <= 3) { this.lastCount = c; this.ui.onCountdown(c); this.sound.countdown(c); }
      if (this.countdown <= 0.2) { this.state = 'racing'; this.raceTime = 0; this.racers.forEach((r) => { r.lapStart = 0; }); }
      this.cameraIntro(dt);
      for (const r of this.racers) this.updateVisual(r, dt);
      this.updateItemBoxes(dt); this.updateParticles(dt);
      // Allow a rolling start: holding gas during "1" gives a small boost
      if (this.countdown < 1.2 && (this.input.throttle > 0.5 || this.easy)) this.player.startBoost = true;
      this.ui.onHud(this.hudState());
      return;
    }
    if (this.state === 'racing') this.raceTime += dt;
    if (this.player.startBoost) { this.player.startBoost = false; this.applyBoost(this.player, 1.3, 1.25); }
    if (this.gateMode === 'stop' && !this.quiz && this.state === 'racing' && !this.player.finished) {
      const n = this.track.samples.length;
      for (const gate of this.gates) { let d = gate.index - this.player.idx; if (d < 0) d += n; if (d > 0 && d < 34 && gate.lastAskedLap !== this.player.lap) { this.openQuiz(gate); break; } }
    }
    if (this.autoPilot && !this.player.ai) this.player.ai = { lane: 0, laneTarget: 0, laneTimer: 0, skill: 1, pace: 0.95, itemTimer: 0, gateChoice: null, lastGate: -1 };
    if (!this.autoPilot && this.player.ai) this.player.ai = null;
    for (const r of this.racers) { if (r.ai) this.aiControl(r, dt); this.physics(r, (r.isPlayer && !this.autoPilot) ? this.input : r.aiInput, dt); }
    this.collideRacers();
    for (const r of this.racers) { this.trackProgress(r); this.updateVisual(r, dt); }
    this.rank();
    this.updateItemBoxes(dt); this.updateEntities(dt); this.updateParticles(dt);
    this.updateCamera(dt);
    this.fadeNearCamera();
    this.sun.position.copy(this.player.pos).add(this.sunOffset); this.sun.target.position.copy(this.player.pos); this.sky.position.copy(this.camera.position);
    this.sound.setEngine(clamp(Math.abs(this.player.speed) / 40, 0, 1), !this.quiz);
    this.ui.onHud(this.hudState());
    this.updateQuestionHud();
  }

  hudState() {
    const p = this.player;
    return { speed: Math.abs(p.speed), lap: Math.min(p.lap + 1, this.laps), laps: this.laps, rank: p.rank, total: this.racers.length, item: p.item, time: this.raceTime, stars: this.stats.stars, boost: p.boost, drift: p.drift, state: this.state, racers: this.racers, shield: p.shield };
  }

  // ---------- Physics ----------
  physics(r, inp, dt) {
    const st = r.stats; const n = this.track.samples.length;
    if (r.finished && r.isPlayer) inp = { throttle: 0.6, steer: this.autoSteer(r), brake: 0, drift: false };
    else {
      if (r.isPlayer && this.easy && !this.autoPilot) inp = this.easyInput(r, inp, dt);
      if (r.isPlayer && r.laneLock !== null) inp = { ...inp, steer: this.autoSteer(r, r.laneLock), drift: false, driftPressed: false };
    }
    const spinning = r.spin > 0;
    if (spinning) { r.spin -= dt; }
    if (r.slow > 0) r.slow -= dt;
    // Target top speed
    let max = st.max * (r.boost > 0 ? r.boostPower : 1);
    if (r.offroad && r.boost <= 0) max *= 0.8;
    if (r.slow > 0) max *= 0.7;
    if (r.boost > 0) { r.boost -= dt; r.speed = Math.max(r.speed, Math.min(max, r.speed + 60 * dt)); }
    // Accelerate to go, let go to coast down, reverse to back up. AI can also brake for corners.
    const throttle = spinning ? 0 : inp.throttle, reverse = spinning ? 0 : (inp.reverse || 0), brake = spinning ? 0 : (inp.brake || 0);
    if (throttle > 0) r.speed += st.accel * throttle * dt * (r.speed > max ? 0 : 1);
    else if (reverse > 0) r.speed -= (r.speed > 0 ? st.accel * 1.3 : st.accel * 0.6) * dt;
    else if (brake > 0 && r.speed > 0) r.speed -= 20 * dt;
    else { const drag = 10 * dt; r.speed = Math.abs(r.speed) <= drag ? 0 : r.speed - Math.sign(r.speed) * drag; }
    if (r.speed > max) r.speed = lerp(r.speed, max, 1 - Math.exp(-3 * dt));
    r.speed = clamp(r.speed, -st.max * 0.35, max + 1);

    // Drift & hop
    const d = r.drift;
    if (!spinning && inp.driftPressed && r.hop <= 0 && Math.abs(r.speed) > st.max * 0.3) { r.hop = 0.32; if (r.isPlayer) this.sound.hop(); }
    if (r.hop > 0) { r.hop -= dt; if (r.hop <= 0 && inp.drift && Math.abs(inp.steer) > 0.3 && r.speed > st.max * 0.3) { d.active = true; d.dir = Math.sign(inp.steer); d.charge = 0; } }
    if (d.active && (!inp.drift || r.speed < st.max * 0.25 || spinning)) {
      // release: mini turbo
      if (d.charge > 2.2) this.applyBoost(r, 1.1, 1.3); else if (d.charge > 1) this.applyBoost(r, 0.6, 1.2);
      if (r.isPlayer && d.charge > 1) this.sound.miniTurbo();
      d.active = false; d.charge = 0;
    }
    const speedF = clamp(r.speed / st.max, -1, 1);
    const slideTarget = !spinning && !r.offroad && !d.active && r.speed > st.max * 0.35 && Math.abs(inp.steer) > 0.18 ? inp.steer * Math.abs(speedF) : 0;
    r.cornerSlide = lerp(r.cornerSlide || 0, slideTarget, 1 - Math.exp(-5 * dt));
    let turn = 0;
    if (!spinning) {
      if (d.active) {
        d.charge += dt * (1 + Math.abs(inp.steer) * 0.5);
        // In a drift the kart turns hard in the drift direction, steering tightens or loosens it
        turn = d.dir * (st.handling * 0.9 + inp.steer * d.dir * st.handling * 0.6) * dt * Math.abs(speedF);
        r.lateralVel = lerp(r.lateralVel, -d.dir * 7, 1 - Math.exp(-3 * dt));
      } else {
        turn = inp.steer * st.handling * (1.1 - 0.35 * Math.abs(speedF)) * dt * speedF;
        r.lateralVel = lerp(r.lateralVel, -r.cornerSlide * 1.4, 1 - Math.exp(-6 * dt));
      }
    } else { r.lateralVel = lerp(r.lateralVel, 0, 1 - Math.exp(-3 * dt)); }
    r.heading += turn;

    // Move
    const fwd = new THREE.Vector3(Math.sin(r.heading), 0, Math.cos(r.heading));
    const right = new THREE.Vector3(-Math.cos(r.heading), 0, Math.sin(r.heading));
    r.pos.addScaledVector(fwd, r.speed * dt).addScaledVector(right, r.lateralVel * dt * 0.5).addScaledVector(r.push, dt);
    r.push.multiplyScalar(Math.exp(-5 * dt));

    // Track constraints
    r.idx = this.track.nearestIndex(r.pos, r.idx);
    const s = this.track.samples[r.idx];
    const lat = this.track.lateral(r.pos, r.idx);
    r.offroad = Math.abs(lat) > ROAD_HALF + 0.6;
    const wall = ROAD_HALF + 1.6;
    if (Math.abs(lat) > wall) {
      // Bounce off the barrier: reflect the velocity, steer back along the track and keep most of the speed
      const side = Math.sign(lat), over = Math.abs(lat) - wall;
      const nrm = s.right.clone().multiplyScalar(side); nrm.y = 0; nrm.normalize(); // points into the wall
      r.pos.addScaledVector(nrm, -over - 0.05);
      const dir = new THREE.Vector3(Math.sin(r.heading), 0, Math.cos(r.heading));
      const v = dir.clone().multiplyScalar(r.speed); const vn = v.dot(nrm);
      if (vn > 0) {
        const prev = Math.abs(r.speed);
        v.addScaledVector(nrm, -1.35 * vn);
        r.push.addScaledVector(nrm, -Math.min(9, 2.5 + vn * 0.6));
        const along = dir.dot(s.tangent) >= 0 ? 1 : -1;
        const tH = Math.atan2(s.tangent.x * along, s.tangent.z * along);
        if (r.speed > 0.5) { r.heading = tH + wrapAngle(Math.atan2(v.x, v.z) - tH) * 0.5; r.speed = Math.max(v.length() * 0.97, prev * 0.8); }
        else if (r.speed < -0.5) { r.speed = -prev * 0.7; }
        if (vn > 3) {
          const hit = r.pos.clone().addScaledVector(nrm, 1.1); hit.y += 0.5;
          for (let k = 0; k < 8; k++) this.emit(hit, new THREE.Vector3((Math.random() - 0.5) * 6, 3 + Math.random() * 4, (Math.random() - 0.5) * 6).addScaledVector(nrm, -4), 0xfff176, 0.35);
          if (r.isPlayer && !this.wallCooldown) { this.sound.wall(); this.shake = 0.1; this.wallCooldown = 0.25; }
        }
        if (d.active && vn > 8) { d.active = false; d.charge = 0; }
      }
      r.lateralVel = 0;
    }
    if (this.wallCooldown && r.isPlayer) this.wallCooldown = Math.max(0, this.wallCooldown - dt);
    // Height follows the road
    const next = this.track.sampleAt(r.idx + 1); const along = r.pos.clone().sub(s.pos).dot(s.tangent) / Math.max(0.01, next.pos.distanceTo(s.pos));
    const groundY = this.track.heightAt(r.idx, clamp(along, 0, 1));
    r.pos.y = groundY + (r.hop > 0 ? Math.sin((0.32 - r.hop) / 0.32 * Math.PI) * 0.8 : 0);
    r.groundTangent = s.tangent;

    // Particles: drift sparks, offroad dust, boost flames
    if (d.active && r.speed > 5) {
      const col = d.charge > 2.2 ? 0xff9a2e : d.charge > 1 ? 0x7bdcff : 0xffffff;
      for (const side of [-1, 1]) { const p = r.pos.clone().addScaledVector(fwd, -0.9).addScaledVector(right, side * 0.85); p.y += 0.15; this.emit(p, new THREE.Vector3((Math.random() - 0.5) * 3, 2 + Math.random() * 3, (Math.random() - 0.5) * 3).addScaledVector(fwd, -6), col, 0.35); }
    }
    if (!d.active && Math.abs(r.cornerSlide) > 0.25 && Math.random() < 0.4) {
      const p = r.pos.clone().addScaledVector(fwd, -1).addScaledVector(right, Math.sign(r.cornerSlide) * 0.8); p.y += 0.15;
      this.emit(p, new THREE.Vector3(0, 0.8, 0).addScaledVector(fwd, -3), 0xd8e5ee, 0.4);
    }
    if (r.offroad && Math.abs(r.speed) > 4 && Math.random() < 0.6) { const p = r.pos.clone().addScaledVector(fwd, -0.8); p.y += 0.2; this.emit(p, new THREE.Vector3((Math.random() - 0.5) * 4, 2, (Math.random() - 0.5) * 4), this.track.def.ground, 0.5); }
    if (r.boost > 0 && Math.random() < 0.8) { const p = r.pos.clone().addScaledVector(fwd, -2.1); p.y += 0.5; this.emit(p, new THREE.Vector3((Math.random() - 0.5) * 2, 1, (Math.random() - 0.5) * 2).addScaledVector(fwd, -8), Math.random() < 0.5 ? 0xffa02e : 0xfff176, 0.3); }

    // Features
    this.checkGate(r); this.checkBoostPads(r); this.checkItemPickup(r);
    if (!spinning && inp.itemPressed && r.item) this.useItem(r);
  }

  // Driving help handles the accelerator, with partial corner/edge guidance.
  easyInput(r, inp, dt) {
    const st = r.stats;
    const lat = this.track.lateral(r.pos, r.idx);
    const guidance = this.autoSteer(r, clamp(lat, -5.5, 5.5));
    const edgeHelp = Math.abs(lat) > 6.5 ? this.autoSteer(r, 0) * 0.35 : 0;
    const steering = clamp(inp.steer * 0.85 + guidance * 0.3 + edgeHelp, -1, 1);
    const bend = 1 - clamp(this.track.sampleAt(r.idx).tangent.dot(this.track.sampleAt(r.idx + 20).tangent), 0, 1);
    const want = st.max * (1 - bend * 0.55);
    const boosting = r.boost > 0;
    return { throttle: boosting || r.speed < want ? 1 : 0, brake: !boosting && r.speed > want + 3 ? 1 : 0, reverse: 0, steer: steering, drift: inp.drift, driftPressed: inp.driftPressed, itemPressed: inp.itemPressed };
  }

  autoSteer(r, lane = 0) {
    const t = this.track.sampleAt(r.idx + 8); const target = t.pos.clone().addScaledVector(t.right, lane);
    const dx = target.x - r.pos.x, dz = target.z - r.pos.z;
    return clamp(wrapAngle(Math.atan2(dx, dz) - r.heading) * 3, -1, 1);
  }

  applyBoost(r, time, power) { const active = r.boost > 0; r.boost = Math.max(r.boost, time); r.boostPower = active ? Math.max(power, r.boostPower) : power; if (r.isPlayer) this.sound.boost(); }
  spinOut(r, strength = 1) {
    if (r.shield) { r.shield = false; if (r.isPlayer) this.sound.shield(); return; }
    r.spin = 1.2 * strength; r.speed *= 0.3; r.drift.active = false; r.boost = 0;
    if (r.isPlayer) { this.sound.spin(); this.shake = 0.5; }
  }

  collideRacers() {
    for (let i = 0; i < this.racers.length; i++) for (let j = i + 1; j < this.racers.length; j++) {
      const a = this.racers[i], b = this.racers[j]; const dx = a.pos.x - b.pos.x, dz = a.pos.z - b.pos.z; const d2 = dx * dx + dz * dz;
      if (d2 < 2.3 * 2.3 && d2 > 0.0001) {
        const d = Math.sqrt(d2); const nx = dx / d, nz = dz / d; const over = 2.3 - d;
        const ma = a.stats.mass, mb = b.stats.mass, tot = ma + mb;
        a.pos.x += nx * over * (mb / tot); a.pos.z += nz * over * (mb / tot); b.pos.x -= nx * over * (ma / tot); b.pos.z -= nz * over * (ma / tot);
        const avg = (a.speed + b.speed) / 2; a.speed = lerp(a.speed, avg, 0.3 * mb / tot); b.speed = lerp(b.speed, avg, 0.3 * ma / tot);
        if ((a.isPlayer || b.isPlayer) && Math.abs(a.speed - b.speed) > 3 && !this.bumpCooldown) { this.sound.bump(); this.bumpCooldown = 0.3; }
      }
    }
    if (this.bumpCooldown) this.bumpCooldown = Math.max(0, this.bumpCooldown - 0.016);
  }

  trackProgress(r) {
    const n = this.track.samples.length;
    if (r.idx > n * 0.45 && r.idx < n * 0.6) r.checkpoint = true;
    // Crossed the line (index wrapped from high to low)
    if (r.prevIdx > n * 0.8 && r.idx < n * 0.2 && this.state !== 'countdown') {
      if (r.checkpoint) {
        r.lap++; r.checkpoint = false;
        const lapTime = this.raceTime - r.lapStart; r.lapStart = this.raceTime; if (r.lap > 1 || true) r.bestLap = Math.min(r.bestLap, lapTime);
        if (r.lap >= this.laps && !r.finished) { r.finished = true; r.finishTime = this.raceTime; if (r.isPlayer) this.onPlayerFinish(); }
        else if (r.isPlayer) { this.sound.lapBell(); this.ui.onLap(r.lap + 1, r.lap === this.laps - 1); }
      }
    } else if (r.prevIdx < n * 0.2 && r.idx > n * 0.8 && r.lap > 0 && !r.checkpoint) {
      // went backwards over the line
      r.lap--; r.checkpoint = true;
    }
    const rel = r.checkpoint ? r.idx : (r.idx > n / 2 ? r.idx - n : r.idx);
    r.progress = r.lap + rel / n;
    r.prevIdx = r.idx;
  }

  rank() {
    const sorted = [...this.racers].sort((a, b) => (a.finished && b.finished) ? a.finishTime - b.finishTime : a.finished ? -1 : b.finished ? 1 : b.progress - a.progress);
    sorted.forEach((r, i) => { r.rank = i + 1; });
  }

  // ---------- Gates, pads, items ----------
  passedIndex(r, gi) {
    const n = this.track.samples.length; const prev = r.prevIdx, cur = r.idx;
    if (cur === prev) return false;
    if (cur > prev) return (cur - prev) < n / 2 && gi > prev && gi <= cur;
    // wrapped
    return (prev - cur) < n / 2 ? false : (gi > prev || gi <= cur);
  }
  checkGate(r) {
    if (r.isPlayer) return; // Player rewards are resolved directly by the question card.
    for (const gate of this.gates) {
      if (!this.passedIndex(r, gate.index)) continue;
      if (Math.random() < r.ai.skill) this.applyBoost(r, 1.6, 1.3); else r.slow = 0.9;
    }
  }
  checkBoostPads(r) {
    for (const p of this.boostPads) if (this.passedIndex(r, p.index) && Math.abs(this.track.lateral(r.pos, p.index)) < ROAD_HALF) this.applyBoost(r, 1.3, 1.35);
  }
  checkItemPickup(r) {
    if (r.item || r.itemRolling) return;
    for (const b of this.itemBoxes) {
      if (!b.active) continue;
      const dx = r.pos.x - b.pos.x, dz = r.pos.z - b.pos.z;
      if (dx * dx + dz * dz < 2.2 * 2.2) {
        b.active = false; b.respawn = 3; b.mesh.visible = false;
        const item = this.rollItem(r);
        if (r.isPlayer) { r.itemRolling = true; this.sound.item(); this.ui.onItemRoll(item, () => { r.item = item; r.itemRolling = false; }); }
        else { r.item = item; r.ai.itemTimer = 0.8 + Math.random() * 2.5; }
      }
    }
  }
  rollItem(r) {
    const behind = r.rank / this.racers.length; // 1 = last
    const pool = behind > 0.6 ? ['rocket', 'rocket', 'ball', 'bubble', 'jelly'] : behind > 0.3 ? ['rocket', 'ball', 'jelly', 'bubble'] : ['jelly', 'jelly', 'bubble', 'ball'];
    return pool[Math.floor(Math.random() * pool.length)];
  }
  useItem(r) {
    const item = r.item; r.item = null;
    const fwd = new THREE.Vector3(Math.sin(r.heading), 0, Math.cos(r.heading));
    if (item === 'rocket') this.applyBoost(r, 2.2, 1.5);
    else if (item === 'bubble') { r.shield = true; if (r.isPlayer) this.sound.shield(); }
    else if (item === 'jelly') {
      const mesh = buildJelly(); const pos = r.pos.clone().addScaledVector(fwd, -2.8); mesh.position.copy(pos); this.scene.add(mesh);
      this.entities.push({ type: 'jelly', mesh, pos, owner: r, life: 45, idx: this.track.nearestIndex(pos, r.idx) });
      if (r.isPlayer) this.sound.fire();
    } else if (item === 'ball') {
      const mesh = buildBall(); const pos = r.pos.clone().addScaledVector(fwd, 2.6); mesh.position.copy(pos); this.scene.add(mesh);
      const idx = this.track.nearestIndex(pos, r.idx);
      this.entities.push({ type: 'ball', mesh, pos, owner: r, life: 7, idx, lateral: this.track.lateral(pos, idx), speed: Math.max(42, r.speed + 18), armed: 0.25 });
      if (r.isPlayer) this.sound.fire();
    }
    if (r.isPlayer) this.ui.onItemUsed(item);
  }
  updateEntities(dt) {
    const n = this.track.samples.length;
    for (const e of this.entities) {
      e.life -= dt;
      if (e.type === 'ball') {
        e.armed -= dt;
        // home in on the nearest racer ahead
        let target = null, bestD = 90;
        for (const r of this.racers) { if (r === e.owner && e.armed > 0) continue; let d = r.idx - e.idx; if (d < -n / 2) d += n; if (d > 0 && d < bestD) { bestD = d; target = r; } }
        if (target) { const tl = this.track.lateral(target.pos, target.idx); e.lateral = lerp(e.lateral, tl, 1 - Math.exp(-2.5 * dt)); }
        e.along = (e.along || 0) + e.speed * dt;
        while (e.along >= 2) { e.along -= 2; e.idx = (e.idx + 1) % n; }
        if (Math.abs(e.lateral) > ROAD_HALF + 1) e.lateral = Math.sign(e.lateral) * (ROAD_HALF + 1);
        const s = this.track.samples[e.idx], s2 = this.track.sampleAt(e.idx + 1);
        e.pos.copy(s.pos).lerp(s2.pos, e.along / 2).addScaledVector(s.right, e.lateral);
        e.mesh.position.copy(e.pos); e.mesh.rotation.x += dt * 10;
        e.mesh.position.y += Math.abs(Math.sin(this.time * 12)) * 0.6;
      } else {
        e.mesh.rotation.y += dt;
      }
      // hits
      for (const r of this.racers) {
        if (e.type === 'ball' && r === e.owner && e.armed > 0) continue;
        if (e.type === 'jelly' && r === e.owner && e.life > 44) continue;
        const dx = r.pos.x - e.pos.x, dz = r.pos.z - e.pos.z;
        if (dx * dx + dz * dz < 1.7 * 1.7) { this.spinOut(r, e.type === 'ball' ? 1.1 : 0.9); e.life = 0; if (r.isPlayer) this.confetti(r.pos, 10); }
      }
    }
    for (const e of this.entities) if (e.life <= 0) this.scene.remove(e.mesh);
    this.entities = this.entities.filter((e) => e.life > 0);
  }
  updateItemBoxes(dt) {
    for (const b of this.itemBoxes) {
      if (!b.active) { b.respawn -= dt; if (b.respawn <= 0) { b.active = true; b.mesh.visible = true; } continue; }
      b.mesh.rotation.y += dt * 1.5; b.mesh.rotation.x += dt * 0.7; b.mesh.position.y = b.pos.y + Math.sin(this.time * 2 + b.phase) * 0.25;
      b.mesh.userData.inner.rotation.y -= dt * 3;
    }
  }

  // ---------- AI ----------
  aiControl(r, dt) {
    const ai = r.ai; const n = this.track.samples.length;
    // Lane choice: wander, aim for gates and item boxes
    ai.laneTimer -= dt;
    if (ai.laneTimer <= 0) { ai.laneTimer = 2 + Math.random() * 3; ai.laneTarget = (Math.random() - 0.5) * 8; }
    let laneGoal = ai.laneTarget;
    if (!r.item) for (const ii of this.track.itemIndices) { let d = ii - r.idx; if (d < 0) d += n; if (d < 40) laneGoal = LANES[(r.id + Math.floor(this.time / 10)) % 3]; }
    ai.lane = lerp(ai.lane, laneGoal, 1 - Math.exp(-2.5 * dt));
    // Steering towards a point ahead
    const look = 6 + Math.round(Math.abs(r.speed) * 0.25);
    const t = this.track.sampleAt(r.idx + look); const target = t.pos.clone().addScaledVector(t.right, ai.lane);
    const dx = target.x - r.pos.x, dz = target.z - r.pos.z;
    const steer = clamp(wrapAngle(Math.atan2(dx, dz) - r.heading) * 3.2, -1, 1);
    // Throttle: ease off for sharp bends ahead, rubber band to the player
    const curve = 1 - clamp(this.track.sampleAt(r.idx).tangent.dot(this.track.sampleAt(r.idx + 18).tangent), 0, 1);
    let pace = ai.pace * (1 - curve * 0.9);
    const gap = this.player.progress - r.progress; // positive: AI behind
    if (gap > 0.12) pace *= 1.15; else if (gap < -0.08) pace *= 0.85;
    if (this.player.finished) pace = Math.max(pace, 0.9);
    const want = r.stats.max * pace; const throttle = r.speed < want ? 1 : 0; const brake = r.speed > want + 6 ? 1 : 0;
    // Items
    let itemPressed = false;
    if (r.item) { ai.itemTimer -= dt; if (ai.itemTimer <= 0) { if (r.item === 'ball') { const ahead = this.racers.some((o) => { let d = o.idx - r.idx; if (d < 0) d += n; return o !== r && d > 2 && d < 60; }); itemPressed = ahead || ai.itemTimer < -6; } else if (r.item === 'rocket') itemPressed = r.boost <= 0; else itemPressed = true; } }
    // Occasional drift on long bends
    const drifting = curve > 0.25 && Math.abs(steer) > 0.5 && r.speed > r.stats.max * 0.6;
    const prev = r.aiInput || { drift: false };
    r.aiInput = { throttle, brake, steer, drift: drifting, driftPressed: drifting && !prev.drift, itemPressed };
  }

  // ---------- Visuals & camera ----------
  updateVisual(r, dt) {
    const k = r.kart; k.group.position.copy(r.pos);
    const spinAngle = r.spin > 0 ? (1.2 - r.spin) / 1.2 * Math.PI * 4 : 0;
    k.group.rotation.set(0, r.heading + spinAngle + (r.drift.active ? -r.drift.dir * 0.45 : -(r.cornerSlide || 0) * 0.3), 0);
    // Tilt with the road slope
    if (r.groundTangent) { const pitch = Math.asin(clamp(r.groundTangent.y, -0.5, 0.5)); k.body.rotation.x = lerp(k.body.rotation.x, -pitch, 0.2); }
    const steerVis = r.isPlayer ? this.input.steer : (r.aiInput?.steer || 0);
    r.visualSteer = lerp(r.visualSteer, steerVis, 0.2);
    r.visualTilt = lerp(r.visualTilt, (r.drift.active ? r.drift.dir * 0.12 : 0) - r.visualSteer * 0.05 * Math.abs(r.speed) / r.stats.max, 0.15);
    k.body.rotation.z = r.visualTilt;
    k.body.position.y = r.hop > 0 ? 0 : Math.sin(this.time * 25) * 0.015 * Math.abs(r.speed) / r.stats.max;
    r.wheelSpin += r.speed * dt / 0.38;
    for (const w of r.kart.wheels) { w.wheel.rotation.x = r.wheelSpin; if (w.front) w.pivot.rotation.y = r.visualSteer * 0.45; }
    for (const w of k.wheels) w.pivot.position.y = (w.front ? 0.38 : 0.46) + (this.reducedMotion ? 0 : Math.sin(this.time * 18 + w.pivot.position.z) * 0.022 * clamp(Math.abs(r.speed) / r.stats.max, 0, 1));
    k.flames.visible = r.boost > 0; if (k.flames.visible) k.flames.scale.setScalar(0.8 + Math.random() * 0.5);
    k.bubble.visible = r.shield; if (r.shield) k.bubble.scale.setScalar(1 + Math.sin(this.time * 6) * 0.05);
    k.blob.visible = true; k.blob.position.y = -(r.pos.y - this.track.heightAt(r.idx)) + 0.03;
    // Character leans and bobs
    const ch = r.kart.character; ch.rotation.z = -r.visualTilt * 2; ch.userData.head.rotation.y = r.visualSteer * 0.5; ch.position.y = (ch.userData.baseY ?? 0.55) + Math.sin(this.time * 10 + r.id) * 0.02;
    if (!this.reducedMotion) {
      ch.rotation.x = lerp(ch.rotation.x, r.boost > 0 ? 0.14 : -0.025, 1 - Math.exp(-7 * dt));
      if (r.finished) ch.position.y += Math.max(0, Math.sin(this.time * 5)) * 0.15;
    }
    if (ch.userData.tail) ch.userData.tail.rotation.y = 0.4 + Math.sin(this.time * 7 + r.id) * 0.35;
  }

  baseFov() { const a = this.camera.aspect; return a >= 1 ? 65 : 65 + Math.min(30, (1 - a) * 55); }

  cameraIntro(dt) {
    const p = this.player; const t = 1 - clamp(this.countdown / 4.2, 0, 1);
    const a = this.reducedMotion ? p.heading + Math.PI : Math.PI * 0.9 - t * Math.PI * 0.9 + p.heading;
    const r = 11 - t * 2.5; const h = 4.5 - t * 0.5;
    const target = new THREE.Vector3(p.pos.x + Math.sin(a) * r, p.pos.y + h, p.pos.z + Math.cos(a) * r);
    this.camera.position.lerp(target, 1 - Math.exp(-6 * dt));
    this.camera.lookAt(p.pos.x, p.pos.y + 1.5, p.pos.z);
    this.camera.fov = this.baseFov(); this.camera.updateProjectionMatrix();
  }
  updateCamera(dt) {
    const p = this.player; const fwd = new THREE.Vector3(Math.sin(p.heading), 0, Math.cos(p.heading));
    const bend = this.track.sampleAt(p.idx).tangent.clone().cross(this.track.sampleAt(p.idx + 12).tangent).y;
    const lag = this.reducedMotion ? 0 : (p.drift.active ? -p.drift.dir * 0.25 : 0) + clamp(bend, -0.3, 0.3) * 0.3;
    const dirBack = new THREE.Vector3(Math.sin(p.heading + lag), 0, Math.cos(p.heading + lag));
    const dist = 8.5 + clamp(p.speed / p.stats.max, 0, 1.5) * 1.2 + (p.boost > 0 && !this.reducedMotion ? 1.0 : 0);
    const target = p.pos.clone().addScaledVector(dirBack, -dist).add(new THREE.Vector3(0, 4.0, 0));
    if (p.finished && !this.reducedMotion) { const a = this.time * 0.6; target.set(p.pos.x + Math.sin(a) * 10, p.pos.y + 5, p.pos.z + Math.cos(a) * 10); }
    this.camera.position.lerp(target, 1 - Math.exp(-(p.finished ? 2 : 7) * dt));
    const look = p.pos.clone().addScaledVector(fwd, p.finished ? 0 : 7).add(new THREE.Vector3(0, 1.4, 0));
    if (this.shake > 0) { this.shake -= dt; look.x += (Math.random() - 0.5) * this.shake * 1.5; look.y += (Math.random() - 0.5) * this.shake * 1.5; }
    this.camera.lookAt(look);
    if (!this.reducedMotion && !p.finished) this.camera.rotateZ(clamp(-p.visualSteer * Math.abs(p.speed) / p.stats.max * 0.025, -0.035, 0.035));
    const fov = this.baseFov() + (this.reducedMotion ? 0 : (p.boost > 0 ? 9 : 0) + clamp(p.speed / p.stats.max - 0.8, 0, 0.5) * 10);
    this.camera.fov = lerp(this.camera.fov, fov, 1 - Math.exp(-5 * dt)); this.camera.updateProjectionMatrix();
    this.speedStreaks.visible = !this.reducedMotion && !p.finished && p.boost > 0;
    this.speedStreaks.material.opacity = 0.12 + Math.sin(this.time * 22) * 0.035;
  }

  fadeNearCamera() {
    for (const r of this.racers) {
      if (r.isPlayer) continue;
      const d = r.pos.distanceTo(this.camera.position);
      const target = d < 3 ? 0.08 : d < 6 ? (d - 3) / 3 : 1;
      if (Math.abs((r.fade ?? 1) - target) < 0.01) continue;
      r.fade = target;
      for (const m of r.kart.mats) { m.transparent = target < 1; m.opacity = target; m.depthWrite = target > 0.5; m.needsUpdate = false; }
      r.kart.blob.visible = target > 0.5;
    }
  }
  // ---------- Maths stop ----------
  quizPad() {
    const gp = navigator.getGamepads ? Array.from(navigator.getGamepads()).find((g) => g) : null;
    if (!gp) return [false, false, false];
    return [!!gp.buttons[14]?.pressed || gp.axes[0] < -0.6, !!gp.buttons[12]?.pressed || !!gp.buttons[0]?.pressed, !!gp.buttons[15]?.pressed || gp.axes[0] > 0.6];
  }
  openQuiz(gate) {
    if (gate.lastAskedLap === this.player.lap) return;
    if (gate.lastAskedLap >= 0) this.refreshGate(gate);
    gate.lastAskedLap = this.player.lap;
    this.quiz = { gate, q: gate.q, t: 0, openedAt: performance.now(), answered: false, resultT: 0, bonusTime: this.bonusTime, pad: this.quizPad() };
    this.player.drift.active = false; this.player.drift.charge = 0;
    this.sound.quizOpen();
    this.ui.onQuizOpen(gate.q, this.bonusTime);
  }
  answerQuiz(choice, timeout = false) {
    const z = this.quiz; if (!z || z.answered || this.paused || (!timeout && performance.now() - z.openedAt < 250)) return;
    timeout = timeout || z.t >= ANSWER_SECONDS;
    if (!timeout && (!Number.isInteger(choice) || choice < 0 || choice > 2)) return;
    const q = z.q; const correct = !timeout && q.options[choice] === q.answer; const fast = correct && z.t <= 3;
    z.t = Math.min(z.t, ANSWER_SECONDS);
    z.answered = true; z.correct = correct; z.resultT = 0;
    this.stats.asked++; if (correct) this.stats.correct++; this.stats.times.push(z.t);
    this.progress.record(q, correct);
    this.stats.log.push({ q: q.text, answer: q.answer, picked: timeout ? null : q.options[choice], correct, time: z.t, timedOut: timeout });
    z.reward = correct ? answerBoost(z.t) : null;
    if (correct) this.stats.stars += fast ? 2 : 1;
    if (correct) this.sound.correct(); else this.sound.wrong();
    this.ui.onQuizResult({ choice: timeout ? null : choice, correct, fast, timedOut: timeout, correctIndex: q.correctIndex, answer: q.answer, text: q.text, reward: z.reward });
  }
  updateQuiz(dt) {
    const z = this.quiz; if (!z || this.paused) return;
    if (!z.answered) {
      z.t = Math.min(ANSWER_SECONDS, z.t + dt);
      this.ui.onQuizTick(Math.max(0, 1 - z.t / ANSWER_SECONDS), Math.max(0, ANSWER_SECONDS - z.t));
      if (z.t >= ANSWER_SECONDS) { this.answerQuiz(null, true); return; }
      const pad = this.quizPad();
      for (let i = 0; i < 3; i++) if (pad[i] && !z.pad[i]) { this.answerQuiz(i); break; }
      z.pad = pad;
      if (this.autoPilot && z.t > 0.4) { const skill = this.player.ai?.skill ?? 1; this.answerQuiz(Math.random() < skill ? z.q.correctIndex : (z.q.correctIndex + 1) % 3); }
    } else {
      z.resultT += dt;
      if (z.resultT > (z.correct ? 0.9 : 1.8)) {
        const p = this.player;
        if (z.correct) { p.slow = 0; this.applyBoost(p, z.reward.duration, z.reward.power); this.confetti(p.pos, 50, [0xffc34d, 0xffe79e, 0xfff8de]); }
        else { p.boost = 0; p.boostPower = 1; p.slow = 2.2; p.speed *= 0.65; }
        this.quiz = null; this.keys = {}; this.ui.onQuizClose();
        this.ui.onFeedback({ correct: z.correct, title: z.correct ? 'TURBO!' : 'Slowed down!', text: `${z.q.text} = ${z.q.answer}` });
      }
    }
  }

  updateQuestionHud() {
    if (this.gateMode === 'stop') { this.ui.onQuestion(null); return; }
    const p = this.player; const n = this.track.samples.length;
    let near = null, nearD = 999;
    for (const gate of this.gates) { let d = gate.index - p.idx; if (d < 0) d += n; if (d < nearD) { nearD = d; near = gate; } }
    if (near && nearD < 110 && !p.finished) {
      const lat = this.track.lateral(p.pos, p.idx); let lane = 1; let best = 99; LANES.forEach((l, i) => { const d = Math.abs(lat - l); if (d < best) { best = d; lane = i; } });
      this.ui.onQuestion(near.q, nearD / 110, lane);
    } else this.ui.onQuestion(null);
  }

  onPlayerFinish() {
    this.state = 'finished'; this.sound.finish(); this.sound.setEngine(0, false);
    this.confetti(this.player.pos, 120);
    const p = this.player; const results = {
      rank: p.rank, total: this.racers.length, time: p.finishTime, bestLap: p.bestLap,
      asked: this.stats.asked, correct: this.stats.correct, stars: this.stats.stars, log: this.stats.log,
      avgTime: this.stats.times.length ? this.stats.times.reduce((a, b) => a + b, 0) / this.stats.times.length : null,
      weak: this.progress.weakFacts(6), character: p.ch, level: this.level,
    };
    setTimeout(() => this.ui.onFinish(results), 2200);
    // Let the pack finish for final standings
    setTimeout(() => { this.rank(); results.rank = p.rank; }, 100);
  }
  setTouch(t) { this.touch = t; }
}
