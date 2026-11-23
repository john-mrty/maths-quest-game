import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { VRInput, readVRControllers } from '../turbo-tables/js/vr-input.js';
import { RaceVR } from '../turbo-tables/js/vr.js';
import { Game } from '../turbo-tables/js/game.js';

function controller(handedness, { axis = 0, a = false, b = false, grip = false } = {}) {
  return { handedness, gamepad: { mapping: 'xr-standard', axes: [0, 0, axis, 0], buttons: [{}, { pressed: grip }, {}, {}, { pressed: a }, { pressed: b }] } };
}
test('XR-standard left steering and right answers stay separate from ordinary gamepads', () => {
  const input = readVRControllers([controller('left', { axis: -1, grip: true }), controller('right', { axis: 1, a: true }), { handedness: 'left', gamepad: { mapping: 'standard', axes: [1], buttons: [] } }]);
  assert.equal(input.steer, 1); assert.equal(input.brake, 1); assert.equal(input.answerAxis, 1); assert.equal(input.confirm, true);
  assert.equal(readVRControllers([controller('left', { axis: 0.1 })]).steer, 0);
  assert.equal(readVRControllers([]).steer, 0);
});
test('questions require release before confirmation and only the right stick changes the choice', () => {
  const controls = new VRInput(), question = {};
  controls.update([controller('right', { a: true })], null);
  assert.equal(controls.update([controller('right', { a: true })], question).confirmPressed, false);
  controls.update([controller('right')], question);
  assert.equal(controls.update([controller('left', { axis: -1 })], question).choice, 1);
  assert.equal(controls.update([controller('right', { axis: 1 })], question).choice, 2);
  assert.equal(controls.update([controller('right', { axis: 1 })], question).choice, 2);
  assert.equal(controls.update([controller('right', { a: true })], question).confirmPressed, true);
  assert.equal(controls.update([controller('right', { a: true })], question).confirmPressed, false);
  assert.equal(controls.update([controller('right', { a: true })], {}).confirmPressed, false);
});
function harness({ fail = false } = {}) {
  const text = [], ctx = new Proxy({}, { get: (_, key) => key === 'fillText' ? value => text.push(value) : () => {} });
  globalThis.document = { createElement: () => ({ width: 0, height: 0, getContext: () => ctx }) };
  const session = new EventTarget(); session.visibilityState = 'visible'; session.inputSources = [];
  let xr;
  session.end = async () => { xr.isPresenting = false; session.dispatchEvent(new Event('end')); };
  const nav = { xr: { requestSession: async mode => { assert.equal(mode, 'immersive-vr'); return session; } } };
  Object.defineProperty(globalThis, 'navigator', { configurable: true, value: nav });
  xr = { isPresenting: false, getController: () => new THREE.Group(), setReferenceSpaceType() {}, setFramebufferScaleFactor() {}, setFoveation() {}, async setSession() { if (fail) throw new Error('XR unavailable'); this.isPresenting = true; } };
  const g = { scene: new THREE.Scene(), camera: new THREE.PerspectiveCamera(), renderer: { xr },
    player: { pos: new THREE.Vector3(10, 2, 20), heading: 0.6, rank: 1, lap: 0 },
    state: 'racing', paused: false, input: {}, level: { id: 3 }, clock: { getDelta() {} }, resize() {},
    setQuality(value) { this.quality = value; }, togglePause(value) { this.paused = value ?? !this.paused; },
    answerQuiz(choice) { this.chosen = choice; }, racers: Array(8), laps: 3 };
  let retries = 0;
  const vr = new RaceVR(g, { retry: () => retries++ }); g.vr = vr;
  return { vr, g, session, text, retries: () => retries };
}
test('VR lifecycle preserves tracked camera poses and scene UI across race rebuilds, then pauses on exit', async () => {
  const { vr, g, session } = harness(); await vr.enter(); vr.attach();
  assert.equal(g.quality, 'low'); assert.equal(g.camera.parent, vr.rig);
  assert.equal(vr.rig.parent, g.scene); assert.equal(g.camera.position.length(), 0);
  g.camera.position.set(0.1, 0.2, 0.3); g.camera.rotation.y = 0.2;
  g.player.heading += 0.4; vr.updateCamera();
  assert.equal(g.camera.position.y, 0.2); assert.equal(g.camera.rotation.y, 0.2);
  assert.equal(vr.rig.rotation.x, 0); assert.equal(vr.rig.rotation.z, 0);
  vr.detach(); assert.equal(vr.rig.parent, null); assert.equal(g.camera.parent, g.scene);
  g.scene = new THREE.Scene(); vr.attach(); assert.equal(vr.panel.parent, vr.rig);
  await session.end(); assert.equal(vr.active, false); assert.equal(g.paused, true); assert.equal(g.camera.parent, g.scene);
});
test('failed session entry restores non-VR state and permits retry', async () => {
  const { vr, g } = harness({ fail: true });
  await assert.rejects(() => vr.enter(), /XR unavailable/);
  assert.equal(vr.active, false); assert.equal(g.camera.parent, g.scene);
});
test('headset interruption freezes input; pause, resume, item edges and junior brakes work', async () => {
  const { vr, g, session } = harness(); await vr.enter(); vr.attach();
  session.inputSources = [controller('left', { axis: 1, grip: true })]; vr.readInput();
  assert.equal(g.input.brake, 0); assert.equal(g.input.throttle, 1); assert.equal(g.input.steer, -1);
  g.level.id = 4; vr.readInput(); assert.equal(g.input.brake, 1); assert.equal(g.input.throttle, 0);
  session.inputSources = [controller('left', { a: true })]; vr.readInput(); assert.equal(g.paused, true);
  session.inputSources = []; vr.readInput();
  session.inputSources = [controller('right', { a: true })]; vr.readInput(); assert.equal(g.paused, false);
  // Resuming never fires the held item.
  assert.equal(g.input.itemPressed, false);
  session.visibilityState = 'hidden'; session.dispatchEvent(new Event('visibilitychange')); vr.readInput();
  assert.equal(g.paused, true); assert.equal(g.input.throttle, 0); assert.equal(g.input.itemPressed, false);
});
test('maths question, feedback and results render in the stereo scene; results can restart without leaving VR', async () => {
  const { vr, g, text, session, retries } = harness(); await vr.enter(); vr.attach();
  g.quiz = { q: { text: '7 × 8', options: [54, 56, 63], answer: 56, correctIndex: 1 }, t: 2 };
  vr.draw(1000); assert.ok(text.includes('7 × 8 = ?')); assert.ok(text.includes('56'));
  assert.ok(text.includes('8 seconds')); assert.equal(vr.panel.parent, vr.rig);
  g.quiz.answered = true; g.quiz.correct = true; vr.draw(1200); assert.ok(text.includes('Turbo! Great answer'));
  g.quiz = null; vr.results = { rank: 1, correct: 8, asked: 9 }; vr.draw(1400); assert.ok(text.includes('You win!'));
  session.inputSources = []; vr.readInput(); session.inputSources = [controller('right', { a: true })]; vr.readInput();
  assert.equal(retries(), 1); assert.equal(vr.active, true);
});
test('VR frames bypass adaptive graphics and post-processing while continuing headset rendering when paused', () => {
  const g = Object.create(Game.prototype); let renders = 0, updates = 0;
  Object.assign(g, { clock: { getDelta: () => 1 / 72 }, graphics: { sample() { throw new Error('Do not sample flat-screen graphics in VR'); } },
    scene: new THREE.Scene(), camera: new THREE.PerspectiveCamera(), paused: true, readInput() {},
    vr: { active: true, updateCamera() { updates++; }, draw() {} }, composer: { render() { throw new Error('No post-processing in VR'); } },
    renderer: { render() { renders++; } } });
  globalThis.document.hidden = false; g.loop(); assert.equal(renders, 1); assert.equal(updates, 1);
});
test('controller rays pick only answer targets, and pause/results remain usable inside VR', async () => {
  const { vr, g, retries } = harness(); await vr.enter(); vr.attach();
  g.quiz = { q: { text: '2 + 2', options: [3, 4, 5], answer: 4, correctIndex: 1 }, t: 1 };
  vr.draw(1000);
  const pointer = vr.controllers[0]; pointer.position.set(0, 0, 0);
  vr.select(pointer); assert.equal(g.chosen, 1);
  g.chosen = null; pointer.position.x = 10;
  vr.select(pointer); assert.equal(g.chosen, null);
  g.quiz.answered = true; pointer.position.x = 0;
  vr.select(pointer); assert.equal(g.chosen, null);
  g.paused = true; vr.select(pointer); assert.equal(g.paused, false);
  g.quiz = null; vr.results = { rank: 1 }; vr.select(pointer); assert.equal(retries(), 1);
});
