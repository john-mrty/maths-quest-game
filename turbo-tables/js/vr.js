import * as THREE from 'three';
import { VRInput } from './vr-input.js';
import { ITEMS } from './karts.js';

// All essential information is a stereo scene surface, not a browser DOM overlay.
export class RaceVR {
  constructor(game, { retry } = {}) {
    this.game = game; this.retry = retry; this.controls = new VRInput();
    this.rig = new THREE.Group();
    this.canvas = document.createElement('canvas'); this.canvas.width = 1280; this.canvas.height = 640;
    this.ctx = this.canvas.getContext('2d');
    this.texture = new THREE.CanvasTexture(this.canvas); this.texture.colorSpace = THREE.SRGBColorSpace;
    this.panel = new THREE.Mesh(new THREE.PlaneGeometry(4.8, 2.4), new THREE.MeshBasicMaterial({ map: this.texture, transparent: true, depthTest: false, depthWrite: false, toneMapped: false }));
    this.panel.renderOrder = 1000; this.rig.add(this.panel);
    this.raycaster = new THREE.Raycaster(); this.rotation = new THREE.Matrix4();
    this.controllers = [0, 1].map(index => {
      const controller = game.renderer.xr.getController(index);
      const line = new THREE.Line(new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(), new THREE.Vector3(0, 0, -8)]), new THREE.LineBasicMaterial({ color: 0xcbb5ff }));
      line.visible = false; controller.add(line); controller.userData.pointer = line;
      controller.addEventListener('selectstart', () => this.select(controller));
      this.rig.add(controller); return controller;
    });
    game.renderer.xr.enabled = true;
    game.renderer.xr.setReferenceSpaceType('local');
    game.renderer.xr.setFramebufferScaleFactor(0.85);
  }

  get active() { return !!this.session; }

  async enter() {
    if (this.active) return;
    const session = await navigator.xr.requestSession('immersive-vr', { optionalFeatures: ['local-floor'] });
    this.session = session; this.controls.reset(); this.results = null;
    session.addEventListener('end', () => this.ended(), { once: true });
    session.addEventListener('visibilitychange', () => {
      if (session.visibilityState !== 'visible') { this.game.togglePause(true); this.controls.reset(); }
    });
    try {
      await this.game.renderer.xr.setSession(session);
      this.game.renderer.xr.setFoveation(1);
      this.game.setQuality('low');
    } catch (error) {
      await session.end().catch(() => {});
      if (this.session === session) this.ended();
      throw error;
    }
  }

  attach() {
    if (!this.active) return;
    this.results = null; this.controls.reset();
    this.game.scene.add(this.rig); this.rig.add(this.game.camera);
    this.game.camera.position.set(0, 0, 0); this.game.camera.quaternion.identity();
    this.updateCamera();
  }

  detach() {
    // Preserve XR-owned resources when the race scene is disposed/rebuilt.
    this.rig.removeFromParent();
    if (this.game.camera.parent === this.rig) {
      this.game.camera.removeFromParent(); this.game.scene?.add(this.game.camera);
    }
  }

  exit() { this.session?.end().catch(() => {}); }

  ended() {
    this.session = null; this.controls.reset(); this.detach();
    const g = this.game;
    if (g.scene) {
      g.scene.add(g.camera); g.camera.position.copy(this.rig.position);
      g.camera.lookAt(g.player.pos.clone().add(new THREE.Vector3(0, 1.4, 0)));
      g.togglePause(true);
    }
    g.clock.getDelta(); g.resize();
  }

  updateCamera() {
    const p = this.game.player;
    if (!p) return;
    // Seated chase view: no intro orbit, camera roll, collision shake or boost zoom.
    this.rig.position.copy(p.pos).add(new THREE.Vector3(-Math.sin(p.heading) * 8.5, 4, -Math.cos(p.heading) * 8.5));
    this.rig.rotation.set(0, p.heading + Math.PI, 0);
    if (this.game.speedStreaks) this.game.speedStreaks.visible = false;
  }

  readInput() {
    const g = this.game;
    if (this.session?.visibilityState !== 'visible') {
      Object.assign(g.input, { steer: 0, throttle: 0, brake: 0, item: false, itemPressed: false });
      return;
    }
    const input = this.controls.update(this.session?.inputSources, g.quiz);
    this.input = input;
    if (input.exitPressed) { this.exit(); return; }
    if (input.pausePressed) g.togglePause();
    const wasModal = !!(g.paused || g.quiz || this.results);
    if (input.confirmPressed) {
      if (this.results) { this.results = null; this.retry?.(); }
      else if (g.paused) g.togglePause(false);
      else if (g.quiz) g.answerQuiz(input.choice);
    }
    const item = !g.quiz && !g.paused && input.confirm;
    const brake = g.level?.id <= 3 ? 0 : input.brake;
    Object.assign(g.input, { steer: input.steer, throttle: brake ? 0 : 1, reverse: 0,
      brake, itemPressed: item && !g.input.item && !wasModal, item,
      drift: false, driftPressed: false, driftReleased: false });
    // Do not consume a question confirmation as an item press after the question closes.
    if (g.quiz || g.paused) g.input.item = input.confirm;
  }

  select(controller) {
    const g = this.game;
    if (!this.active || !g.scene || this.session.visibilityState !== 'visible') return;
    if (this.results) { this.results = null; this.retry?.(); return; }
    if (g.paused) { g.togglePause(false); return; }
    if (!g.quiz || g.quiz.answered) return;
    this.rig.updateMatrixWorld(true);
    this.rotation.extractRotation(controller.matrixWorld);
    this.raycaster.ray.origin.setFromMatrixPosition(controller.matrixWorld);
    this.raycaster.ray.direction.set(0, 0, -1).applyMatrix4(this.rotation);
    const hit = this.raycaster.intersectObject(this.panel)[0];
    if (!hit || hit.uv.y < 0.32 || hit.uv.y > 0.58 || hit.uv.x < 0.04 || hit.uv.x > 0.96) return;
    g.answerQuiz(Math.min(2, Math.floor((hit.uv.x - 0.04) / (0.92 / 3))));
  }

  draw(now = performance.now()) {
    if (now - (this.lastDraw || 0) < 80) return;
    this.lastDraw = now;
    const g = this.game, c = this.ctx, z = g.quiz, p = g.player;
    if (!p) return;
    const expanded = z || g.paused || this.results;
    this.panel.position.set(0, expanded ? -0.05 : -1.45, -5);
    this.controllers.forEach(controller => { controller.userData.pointer.visible = !!z && !g.paused && !z.answered; });
    c.clearRect(0, 0, 1280, 640);
    c.fillStyle = 'rgba(37,24,65,0.94)'; c.beginPath(); c.roundRect(0, expanded ? 0 : 410, 1280, expanded ? 640 : 230, 40); c.fill();
    c.textAlign = 'center'; c.textBaseline = 'middle';
    const text = (value, y, size = 42, colour = '#fff8ed') => { c.fillStyle = colour; c.font = `700 ${size}px system-ui, sans-serif`; c.fillText(value, 640, y, 1190); };
    if (this.results) {
      const r = this.results;
      text(r.rank === 1 ? 'You win!' : `Finished in ${r.rank} place!`, 135, 72, '#ffe18b');
      text(`${r.correct} / ${r.asked} questions correct`, 265, 50);
      text('A or trigger · Race again', 425); text('Y · Leave VR', 520, 34);
    } else if (g.paused) {
      text('Pit stop', 180, 76, '#ffe18b');
      text('A or trigger · Resume race', 340); text('Y · Leave VR', 460, 34);
    } else if (z) {
      text(z.answered ? (z.correct ? 'Turbo! Great answer' : `The answer is ${z.q.answer}`) : 'Maths boost', 80, 42, '#ffe18b');
      text(`${z.q.text}${z.answered ? ` = ${z.q.answer}` : ' = ?'}`, 200, 78);
      z.q.options.forEach((answer, i) => {
        const x = 51 + i * 393;
        c.fillStyle = z.answered ? (i === z.q.correctIndex ? '#b9efd1' : '#e8ddfa') : i === this.controls.choice ? '#ffe18b' : '#e8ddfa';
        c.beginPath(); c.roundRect(x, 270, 377, 165, 28); c.fill();
        c.fillStyle = '#32204e'; c.font = '800 66px system-ui, sans-serif'; c.fillText(String(answer), x + 188, 352);
      });
      text(z.answered ? 'Back to the race…' : 'Point + trigger, or right stick + A to answer', 505, 34);
      text(z.answered ? '' : `${Math.ceil(Math.max(0, 10 - z.t))} seconds`, 580, 32, '#d2c3eb');
    } else {
      const status = g.state === 'countdown' ? `Ready… ${Math.max(1, Math.ceil(g.countdown - 0.2))}` : `${p.rank} / ${g.racers.length}     Lap ${Math.min(p.lap + 1, g.laps)} / ${g.laps}`;
      text(status, 465, 48, '#ffe18b');
      const item = p.item ? `A · ${ITEMS[p.item]?.name || p.item}` : 'Auto accelerate';
      text(`Left stick · Steer     ${item}     X · Pause`, 535, 30);
      text(g.state === 'countdown' ? 'Stay seated. Right stick + A answers questions.' : p.boost > 0 ? 'Turbo boost!' : 'Maths Quest · Turbo Tables', 597, 28, '#d2c3eb');
    }
    this.texture.needsUpdate = true;
  }
}
