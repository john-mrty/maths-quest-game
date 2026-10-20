import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import * as TEX from './textures.js';
import { toon, clay } from './track.js';

// ---------- Materials (made per kart so one kart can fade without affecting others) ----------
let treadTex = null;
const paintMat = (hex) => clay(hex, { roughness: 0.32, clearcoat: 1, clearcoatRoughness: 0.2, envMapIntensity: 0.85, normalScale: new THREE.Vector2(0.045, 0.045) });
const chromeMat = () => clay(0xeef0f8, { roughness: 0.55, metalness: 0.1, sheen: 0.8, envMapIntensity: 0.6 });
const darkMat = () => clay(0x676c8a);
const rubberMat = () => clay(0x585d78, { roughness: 0.95, sheen: 0.3 });
const furMat = (hex) => clay(hex, { roughness: 0.92, sheen: 0.8, sheenRoughness: 0.6 });
const glossMat = (hex) => new THREE.MeshPhysicalMaterial({ color: hex, roughness: 0.3, clearcoat: 0.6, clearcoatRoughness: 0.2 });
const glowMat = (hex, i = 2) => new THREE.MeshStandardMaterial({ color: hex, emissive: hex, emissiveIntensity: i, roughness: 0.3 });

// ---------- Shared geometry (built once, reused by every kart) ----------
const GEO = {};
const geo = (key, make) => GEO[key] || (GEO[key] = make());
const mesh = (g, m) => new THREE.Mesh(g, m);
const V = (x, y, z) => new THREE.Vector3(x, y, z);
const tube = (pts, r, seg = 24) => new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), seg, r, 10, false);

export const CHARACTERS = [
  { id: 'pip', pick: true, name: 'Pip', species: 'Fox', colour: 0xff9a52, accent: 0xfff4e6, kart: 0xff8a70, speed: 4, accel: 3, handling: 4, blurb: 'Quick and clever. Loves a shortcut.' },
  { id: 'momo', pick: true, name: 'Momo', species: 'Panda', colour: 0xfbfbfd, accent: 0x4a4a5c, kart: 0x7fdc95, speed: 3, accel: 3, handling: 5, blurb: 'Calm, cuddly and impossible to knock off line.' },
  { id: 'zip', pick: true, name: 'Zip', species: 'Robot', colour: 0xaad6ff, accent: 0xffd36b, kart: 0x7fb0ff, speed: 5, accel: 2, handling: 3, blurb: 'Top speed champion. Takes a moment to get going.' },
  { id: 'luna', pick: true, name: 'Luna', species: 'Cat', colour: 0xa893ff, accent: 0xfff2fb, kart: 0xc79cff, speed: 3, accel: 5, handling: 3, blurb: 'Pounces off the line faster than anyone.' },
  { id: 'bruno', name: 'Bruno', species: 'Bear', colour: 0xc28f6a, accent: 0xf3d3ad, kart: 0xffd970, speed: 4, accel: 2, handling: 2, blurb: 'Big, heavy and hard to bump. Likes honey.' },
  { id: 'kiki', name: 'Kiki', species: 'Frog', colour: 0x8fe08d, accent: 0xfffbc8, kart: 0x7fe0d2, speed: 2, accel: 5, handling: 5, blurb: 'Tiny, bouncy and brilliant on tight bends.' },
  { id: 'dot', name: 'Dot', species: 'Ladybird', colour: 0xff8496, accent: 0xffeef1, kart: 0xff98b6, speed: 3, accel: 4, handling: 4, blurb: 'Small, speedy and always smiling.' },
  { id: 'ollie', name: 'Ollie', species: 'Octopus', colour: 0x7fd0e6, accent: 0xe0f7ff, kart: 0x74d1c6, speed: 4, accel: 4, handling: 2, blurb: 'Eight arms, one steering wheel. Somehow it works.' },
];

// ---------- Kart ----------
// Side profile of the bodywork (forward, up), extruded across the kart with soft bevels.
function bodyGeometry() {
  const s = new THREE.Shape();
  s.moveTo(-1.2, 0.3);
  s.lineTo(1.5, 0.3);
  s.quadraticCurveTo(1.95, 0.31, 1.92, 0.5);
  s.bezierCurveTo(1.7, 0.62, 1.05, 0.7, 0.62, 0.8);
  s.quadraticCurveTo(0.42, 0.84, 0.3, 0.7);
  s.quadraticCurveTo(0.0, 0.52, -0.45, 0.56);
  s.quadraticCurveTo(-0.75, 0.6, -0.86, 0.86);
  s.bezierCurveTo(-1.05, 0.95, -1.3, 0.8, -1.32, 0.52);
  s.quadraticCurveTo(-1.32, 0.3, -1.2, 0.3);
  const g = new THREE.ExtrudeGeometry(s, { depth: 0.82, bevelEnabled: true, bevelThickness: 0.2, bevelSize: 0.16, bevelSegments: 6, curveSegments: 28 });
  g.translate(0, 0, -0.41); g.rotateY(-Math.PI / 2); g.computeVertexNormals();
  return g;
}
function wingGeometry(width) {
  const s = new THREE.Shape();
  s.moveTo(0.32, 0); s.quadraticCurveTo(0.05, 0.13, -0.3, 0.03); s.quadraticCurveTo(0.0, -0.05, 0.32, 0);
  const g = new THREE.ExtrudeGeometry(s, { depth: width, bevelEnabled: true, bevelThickness: 0.02, bevelSize: 0.02, bevelSegments: 2, curveSegments: 16 });
  g.translate(0, 0, -width / 2); g.rotateY(-Math.PI / 2); return g;
}
// A rounded tyre: a soft-cornered cross-section spun around the axle
function tyreGeometry(R, w) {
  const Ri = R * 0.62, c = Math.min(w, R) * 0.32, pts = [];
  pts.push(new THREE.Vector2(Ri, -w / 2));
  for (let i = 0; i <= 6; i++) { const a = -Math.PI / 2 + (i / 6) * (Math.PI / 2); pts.push(new THREE.Vector2(R - c + Math.cos(a) * c, -w / 2 + c + Math.sin(a) * c)); }
  for (let i = 0; i <= 6; i++) { const a = (i / 6) * (Math.PI / 2); pts.push(new THREE.Vector2(R - c + Math.cos(a) * c, w / 2 - c + Math.sin(a) * c)); }
  pts.push(new THREE.Vector2(Ri, w / 2));
  const g = new THREE.LatheGeometry(pts, 36); g.rotateZ(Math.PI / 2); return g;
}
function buildWheel(R, w, mats) {
  const wheel = new THREE.Group();
  const tyre = mesh(geo(`tyre${R}${w}`, () => tyreGeometry(R, w)), mats.rubber); wheel.add(tyre);
  const rim = mesh(geo(`rim${R}${w}`, () => new THREE.CylinderGeometry(R * 0.63, R * 0.63, w * 0.82, 28).rotateZ(Math.PI / 2)), mats.chrome); wheel.add(rim);
  const dish = mesh(geo(`dish${R}${w}`, () => new THREE.CylinderGeometry(R * 0.5, R * 0.5, w * 0.86, 24).rotateZ(Math.PI / 2)), mats.dark); wheel.add(dish);
  const spokeG = geo(`spoke${R}${w}`, () => new RoundedBoxGeometry(w * 0.9, R * 0.95, R * 0.13, 2, 0.02));
  for (let i = 0; i < 5; i++) { const sp = mesh(spokeG, mats.chrome); sp.rotation.x = (i / 5) * Math.PI; wheel.add(sp); }
  const hub = mesh(geo(`hub${R}${w}`, () => new THREE.CylinderGeometry(R * 0.16, R * 0.2, w * 0.98, 16).rotateZ(Math.PI / 2)), mats.accent); wheel.add(hub);
  return wheel;
}
function numberTexture(n, bg) {
  const c = document.createElement('canvas'); c.width = c.height = 128; const x = c.getContext('2d');
  x.fillStyle = '#ffffff'; x.beginPath(); x.arc(64, 64, 62, 0, 7); x.fill();
  x.lineWidth = 8; x.strokeStyle = bg; x.stroke();
  x.fillStyle = '#1d2440'; x.font = 'bold 80px "Fredoka", "Nunito", sans-serif'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText(String(n), 64, 70);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}

export function buildKart(ch) {
  const g = new THREE.Group();
  const body = new THREE.Group(); g.add(body);
  const hex = '#' + ch.kart.toString(16).padStart(6, '0');
  const mats = { paint: paintMat(ch.kart), trim: paintMat(ch.accent === 0x4a4a5c ? 0xffffff : ch.accent), chrome: chromeMat(), dark: darkMat(), rubber: rubberMat(), accent: paintMat(ch.colour), seat: clay(0x7a7fa0) };

  // Bodywork
  body.add(mesh(geo('body', bodyGeometry), mats.paint));
  // Sculpted wheel arches give the little racer a rounded, toy-car silhouette.
  const archG = geo('wheelarch', () => new THREE.TorusGeometry(0.49, 0.105, 8, 20, Math.PI).rotateY(Math.PI / 2));
  for (const x of [-0.86, 0.86]) for (const z of [-0.95, 1.12]) {
    const arch = mesh(archG, mats.paint); arch.position.set(x, 0.44, z); body.add(arch);
  }
  const tailLampG = geo('taillamp', () => new RoundedBoxGeometry(0.28, 0.12, 0.08, 2, 0.035));
  for (const x of [-0.58, 0.58]) { const lamp = mesh(tailLampG, glowMat(0xff557e, 0.7)); lamp.position.set(x, 0.62, -1.43); body.add(lamp); }
  // Side pods with a contrasting stripe
  const podG = geo('pod', () => new THREE.CapsuleGeometry(0.2, 1.15, 8, 16).rotateX(Math.PI / 2));
  const stripeG = geo('stripe', () => new THREE.CapsuleGeometry(0.205, 0.5, 6, 16).rotateX(Math.PI / 2));
  for (const sx of [-1, 1]) {
    const pod = mesh(podG, mats.paint); pod.position.set(sx * 0.66, 0.42, 0.05); body.add(pod);
    const stripe = mesh(stripeG, mats.trim); stripe.position.set(sx * 0.665, 0.45, 0.25); stripe.scale.set(1, 0.6, 1); body.add(stripe);
  }
  // Front wing with end plates
  const fw = mesh(geo('fwing', () => wingGeometry(2.0)), mats.trim); fw.position.set(0, 0.24, 1.96); fw.rotation.x = 0.08; body.add(fw);
  const plateG = geo('plate', () => new RoundedBoxGeometry(0.06, 0.32, 0.6, 2, 0.025));
  for (const sx of [-1, 1]) { const p = mesh(plateG, mats.paint); p.position.set(sx * 1.0, 0.3, 1.94); body.add(p); }
  const noseStrut = mesh(geo('nstrut', () => new RoundedBoxGeometry(0.5, 0.12, 0.35, 2, 0.04)), mats.dark); noseStrut.position.set(0, 0.28, 1.86); body.add(noseStrut);
  // Rear wing on swept supports
  const rw = mesh(geo('rwing', () => wingGeometry(1.8)), mats.paint); rw.position.set(0, 1.32, -1.42); rw.rotation.x = -0.18; body.add(rw);
  const rw2 = mesh(geo('rwing2', () => wingGeometry(1.7)), mats.trim); rw2.position.set(0, 1.18, -1.5); rw2.rotation.x = -0.3; rw2.scale.set(1, 0.7, 0.7); body.add(rw2);
  for (const sx of [-1, 1]) {
    const p = mesh(plateG, mats.paint); p.position.set(sx * 0.92, 1.25, -1.42); p.scale.set(1, 1.3, 1.1); body.add(p);
    const sup = mesh(geo('rsup', () => tube([V(0, 0.82, -1.0), V(0, 1.0, -1.18), V(0, 1.28, -1.36)], 0.05, 16)), mats.dark); sup.position.x = sx * 0.38; body.add(sup);
  }
  // Engine and curved exhausts
  const block = mesh(geo('engine', () => new RoundedBoxGeometry(0.72, 0.38, 0.5, 3, 0.1)), mats.dark); block.position.set(0, 0.86, -1.02); body.add(block);
  const headG = geo('ehead', () => new THREE.CylinderGeometry(0.11, 0.11, 0.18, 16));
  for (const sx of [-1, 1]) { const h = mesh(headG, mats.chrome); h.position.set(sx * 0.2, 1.08, -1.0); body.add(h); }
  const exG = geo('exhaust', () => tube([V(0.22, 0.82, -1.1), V(0.36, 0.78, -1.35), V(0.46, 0.86, -1.62)], 0.065, 20));
  const tipG = geo('extip', () => new THREE.CylinderGeometry(0.1, 0.075, 0.22, 16, 1, true).rotateX(Math.PI / 2));
  for (const sx of [-1, 1]) {
    const e = mesh(exG, mats.chrome); e.scale.x = sx; body.add(e);
    const tip = mesh(tipG, mats.chrome); tip.position.set(sx * 0.47, 0.88, -1.7); tip.rotation.x = -0.25; body.add(tip);
  }
  // Rear bumper bar
  const bumper = mesh(geo('rbump', () => tube([V(-0.75, 0.42, -1.36), V(-0.5, 0.4, -1.58), V(0.5, 0.4, -1.58), V(0.75, 0.42, -1.36)], 0.055, 28)), mats.chrome); body.add(bumper);
  // Seat, dashboard, steering wheel
  const seatBack = mesh(geo('seatb', () => new RoundedBoxGeometry(0.78, 0.82, 0.2, 3, 0.09)), mats.seat); seatBack.position.set(0, 1.0, -0.66); seatBack.rotation.x = -0.25; body.add(seatBack);
  const seatBase = mesh(geo('seatbase', () => new RoundedBoxGeometry(0.74, 0.18, 0.62, 3, 0.07)), mats.seat); seatBase.position.set(0, 0.7, -0.32); body.add(seatBase);
  const dash = mesh(geo('dash', () => new RoundedBoxGeometry(0.9, 0.14, 0.24, 3, 0.06)), mats.dark); dash.position.set(0, 0.86, 0.58); dash.rotation.x = -0.4; body.add(dash);
  const column = mesh(geo('column', () => new THREE.CylinderGeometry(0.03, 0.04, 0.4, 8)), mats.dark); column.position.set(0, 0.92, 0.5); column.rotation.x = -1.0; body.add(column);
  const wheelRing = mesh(geo('swheel', () => new THREE.TorusGeometry(0.2, 0.035, 10, 28)), mats.dark); wheelRing.position.set(0, 1.04, 0.36); wheelRing.rotation.x = -0.95; body.add(wheelRing);
  const wheelHub = mesh(geo('swhub', () => new THREE.CylinderGeometry(0.06, 0.06, 0.05, 12)), mats.accent); wheelHub.position.copy(wheelRing.position); wheelHub.rotation.x = -0.95 + Math.PI / 2; body.add(wheelHub);
  // Nose number and headlights
  const badge = mesh(geo('badge', () => new THREE.CircleGeometry(0.21, 32)), new THREE.MeshStandardMaterial({ map: numberTexture(CHARACTERS.indexOf(ch) + 1, hex), roughness: 0.3 }));
  badge.position.set(0, 0.93, 1.15); badge.rotation.x = -Math.PI / 2 + 0.2; body.add(badge);
  const lampG = geo('lamp', () => new THREE.SphereGeometry(0.09, 16, 12));
  for (const sx of [-0.42, 0.42]) { const l = mesh(lampG, glowMat(0xfff6d0, 2)); l.position.set(sx, 0.52, 2.04); l.scale.z = 0.55; body.add(l); }
  // Axles
  const axleG = geo('axle', () => new THREE.CylinderGeometry(0.05, 0.05, 1.9, 8).rotateZ(Math.PI / 2));
  for (const z of [1.12, -0.95]) { const a = mesh(axleG, mats.dark); a.position.set(0, z > 0 ? 0.38 : 0.46, z); body.add(a); }

  // Character
  const character = buildCharacter(ch); character.scale.setScalar(0.72); character.position.set(0, 0.66, -0.36);
  character.userData.baseY = 0.66; body.add(character);

  // Wheels: smaller at the front, chunky at the back
  const wheels = [];
  for (const [x, z, R, w] of [[-0.95, 1.12, 0.38, 0.34], [0.95, 1.12, 0.38, 0.34], [-1.0, -0.95, 0.46, 0.5], [1.0, -0.95, 0.46, 0.5]]) {
    const pivot = new THREE.Group(); pivot.position.set(x, R, z);
    const wheel = buildWheel(R, w, mats); pivot.add(wheel);
    g.add(pivot); wheels.push({ pivot, wheel, front: z > 0 });
  }
  // Boost flames at the exhaust tips
  const flames = new THREE.Group(); flames.visible = false;
  for (const x of [-0.47, 0.47]) {
    const f = mesh(geo('flame', () => new THREE.ConeGeometry(0.17, 1.1, 12)), new THREE.MeshStandardMaterial({ color: 0xffa02e, emissive: 0xff7a1a, emissiveIntensity: 3, roughness: 1, transparent: true, opacity: 0.9 }));
    f.rotation.x = -Math.PI / 2; f.position.set(x, 0.9, -2.3); flames.add(f);
    const f2 = mesh(geo('flame2', () => new THREE.ConeGeometry(0.09, 0.7, 10)), new THREE.MeshStandardMaterial({ color: 0xfff176, emissive: 0xfff176, emissiveIntensity: 4, roughness: 1 }));
    f2.rotation.x = -Math.PI / 2; f2.position.set(x, 0.9, -2.08); flames.add(f2);
  }
  body.add(flames);
  // Shield bubble
  const bubble = mesh(geo('bubble', () => new THREE.SphereGeometry(2.2, 28, 20)), new THREE.MeshPhysicalMaterial({ color: 0x7bdcff, transparent: true, opacity: 0.35, roughness: 0.05, transmission: 0.5, clearcoat: 1, emissive: 0x3aa8ff, emissiveIntensity: 0.3, iridescence: 1 }));
  bubble.position.y = 0.9; bubble.visible = false; g.add(bubble);
  // Soft contact shadow
  const blob = mesh(geo('blob', () => new THREE.CircleGeometry(1.5, 24)), new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.22, depthWrite: false }));
  blob.rotation.x = -Math.PI / 2; blob.position.y = 0.02; blob.scale.set(0.9, 1.35, 1); g.add(blob);

  g.traverse((o) => { if (o.isMesh && o !== blob && o !== bubble && !flames.children.includes(o)) { o.castShadow = true; o.receiveShadow = true; } });
  const matsList = []; g.traverse((o) => { if (o.material && o !== bubble && o !== blob) matsList.push(o.material); });
  return { group: g, body, wheels, character, flames, bubble, blob, mats: matsList };
}

// ---------- Characters ----------
const IRIS = { Fox: 0x8a5a1c, Panda: 0x3a2a20, Cat: 0x3fae4a, Bear: 0x5a3a1a, Frog: 0x2a6a2a, Ladybird: 0x3a2a20, Octopus: 0x1f6f8f };

function addEyes(head, ch, { y = 0.1, z = 0.4, spread = 0.19, size = 1 } = {}) {
  const white = new THREE.MeshPhysicalMaterial({ color: 0xffffff, roughness: 0.35, clearcoat: 0.5 });
  const iris = glossMat(IRIS[ch.species] || 0x3a2a20), black = glossMat(0x0d0d14), shine = new THREE.MeshBasicMaterial({ color: 0xffffff });
  const lid = furMat(ch.colour);
  for (const s of [-1, 1]) {
    const eye = new THREE.Group(); eye.position.set(s * spread, y, z); eye.rotation.y = s * 0.28; eye.scale.setScalar(size); head.add(eye);
    const ball = mesh(geo('eyeball', () => new THREE.SphereGeometry(0.13, 24, 18)), white); ball.scale.set(0.9, 1.15, 0.7); eye.add(ball);
    const ir = mesh(geo('iris', () => new THREE.SphereGeometry(0.075, 20, 14)), iris); ir.position.set(0, -0.01, 0.075); ir.scale.set(1, 1.15, 0.5); eye.add(ir);
    const pu = mesh(geo('pupil', () => new THREE.SphereGeometry(0.045, 16, 12)), black); pu.position.set(0, -0.01, 0.1); pu.scale.set(1, 1.2, 0.4); eye.add(pu);
    const hi = mesh(geo('shine', () => new THREE.SphereGeometry(0.02, 10, 8)), shine); hi.position.set(0.025, 0.035, 0.115); eye.add(hi);
    const brow = mesh(geo('brow', () => new THREE.CapsuleGeometry(0.022, 0.12, 4, 8).rotateZ(Math.PI / 2)), furMat(0x2a2030)); brow.position.set(0, 0.24, 0.05); brow.rotation.z = -s * 0.18; eye.add(brow);
  }
}
function addSmile(head, y, z, w = 1) {
  const m = mesh(geo('smile', () => new THREE.TorusGeometry(0.085, 0.02, 8, 20, Math.PI)), new THREE.MeshStandardMaterial({ color: 0x8a3a4a, roughness: 0.9 }));
  m.rotation.z = Math.PI; m.position.set(0, y, z); m.scale.set(w, 1, 1); head.add(m);
  const tongue = mesh(geo('tongue', () => new THREE.SphereGeometry(0.04, 12, 8)), new THREE.MeshStandardMaterial({ color: 0xff7a8a, roughness: 0.5 })); tongue.position.set(0, y - 0.07, z - 0.01); tongue.scale.set(1.2, 0.6, 0.6); head.add(tongue);
}
function addCheeks(head, y = -0.1, z = 0.36, spread = 0.3) {
  const m = new THREE.MeshStandardMaterial({ color: 0xff9fb6, roughness: 1, transparent: true, opacity: 0.6, depthWrite: false });
  for (const s of [-1, 1]) { const c = mesh(geo('cheek', () => new THREE.SphereGeometry(0.075, 14, 10)), m); c.position.set(s * spread, y, z); c.scale.set(1, 0.7, 0.35); c.rotation.y = s * 0.6; head.add(c); }
}
function addGoggles(head, kartHex) {
  const frame = paintMat(kartHex), glass = new THREE.MeshPhysicalMaterial({ color: 0xc8ecff, roughness: 0.3, clearcoat: 0.6, transparent: true, opacity: 0.85 });
  const bridge = mesh(geo('gogbridge', () => new THREE.CapsuleGeometry(0.025, 0.08, 4, 8).rotateZ(Math.PI / 2)), frame); bridge.position.set(0, 0.42, 0.36); head.add(bridge);
  for (const s of [-1, 1]) {
    const g = new THREE.Group(); g.position.set(s * 0.15, 0.4, 0.31); g.rotation.set(-0.85, s * 0.3, 0); head.add(g);
    g.add(mesh(geo('gogring', () => new THREE.TorusGeometry(0.1, 0.035, 10, 24)), frame));
    const lens = mesh(geo('goglens', () => new THREE.SphereGeometry(0.1, 18, 10, 0, Math.PI * 2, 0, Math.PI / 2.5)), glass); lens.rotation.x = Math.PI / 2; g.add(lens);
  }
}
function earPair(head, main, inner, { x = 0.3, y = 0.4, z = -0.02, r = 0.17, h = 0.42, tilt = 0.35 } = {}) {
  for (const s of [-1, 1]) {
    const e = new THREE.Group(); e.position.set(s * x, y, z); e.rotation.set(-0.15, 0, -s * tilt); head.add(e);
    const outer = mesh(geo(`ear${r}${h}`, () => new THREE.ConeGeometry(r, h, 20, 1)), main); outer.position.y = h / 2; outer.scale.z = 0.55; e.add(outer);
    const inn = mesh(geo(`earin${r}${h}`, () => new THREE.ConeGeometry(r * 0.62, h * 0.72, 16, 1)), inner); inn.position.set(0, h * 0.38, r * 0.26); inn.scale.z = 0.3; e.add(inn);
  }
}

export function buildCharacter(ch) {
  const g = new THREE.Group();
  const main = furMat(ch.colour), acc = furMat(ch.accent), suit = paintMat(ch.kart), white = furMat(0xffffff), dark = furMat(0x4a4a5c);
  const pink = furMat(0xffc2d1);

  // Racing suit: rounded torso with a collar, zip and badge
  const torso = mesh(geo('torso', () => new THREE.LatheGeometry([0, 0.36, 0.43, 0.42, 0.34, 0.22, 0.12, 0].map((r, i) => new THREE.Vector2(Math.max(r, 0.001), [0, 0.04, 0.2, 0.36, 0.5, 0.6, 0.64, 0.66][i])), 32)), suit);
  g.add(torso);
  const collar = mesh(geo('collar', () => new THREE.TorusGeometry(0.2, 0.06, 10, 28)), white); collar.rotation.x = Math.PI / 2; collar.position.y = 0.62; g.add(collar);
  const zip = mesh(geo('zip', () => new THREE.CapsuleGeometry(0.015, 0.36, 4, 6)), white); zip.position.set(0, 0.36, 0.42); zip.rotation.x = -0.15; g.add(zip);
  const badge = mesh(geo('cbadge', () => new THREE.CylinderGeometry(0.07, 0.07, 0.02, 20).rotateX(Math.PI / 2)), paintMat(0xffd23f)); badge.position.set(0.18, 0.42, 0.39); badge.rotation.y = 0.35; g.add(badge);

  // Arms reach forward to the steering wheel, ending in gloves
  const armG = geo('arm', () => tube([V(0.36, 0.5, 0.02), V(0.5, 0.36, 0.42), V(0.24, 0.52, 0.98)], 0.085, 20));
  const gloveG = geo('glove', () => new THREE.SphereGeometry(0.12, 16, 12));
  const cuffG = geo('cuff', () => new THREE.TorusGeometry(0.09, 0.035, 8, 16));
  for (const s of [-1, 1]) {
    const arm = mesh(armG, suit); arm.scale.x = s; g.add(arm);
    const glove = mesh(gloveG, white); glove.position.set(s * 0.24, 0.53, 1.0); glove.scale.set(1, 0.85, 1.1); g.add(glove);
    const cuff = mesh(cuffG, white); cuff.position.set(s * 0.27, 0.5, 0.9); cuff.rotation.y = s * 0.4; g.add(cuff);
    const shoulder = mesh(geo('shoulder', () => new THREE.SphereGeometry(0.13, 16, 12)), suit); shoulder.position.set(s * 0.36, 0.5, 0.02); g.add(shoulder);
  }

  // Head
  const head = new THREE.Group(); head.position.y = 1.12; g.add(head);
  const skull = mesh(geo('skull', () => new THREE.SphereGeometry(0.5, 40, 30)), main); skull.scale.set(1.04, 0.96, 0.96); head.add(skull);
  const sp = ch.species;
  if (sp === 'Robot') {
    skull.geometry = geo('rhead', () => new RoundedBoxGeometry(0.95, 0.82, 0.82, 5, 0.22)); skull.scale.set(1, 1, 1); skull.material = paintMat(ch.colour);
    const visor = mesh(geo('visor', () => new RoundedBoxGeometry(0.74, 0.4, 0.12, 4, 0.08)), new THREE.MeshPhysicalMaterial({ color: 0x3a4170, roughness: 0.4, clearcoat: 0.5 }));
    visor.position.set(0, 0.04, 0.38); head.add(visor);
    for (const s of [-1, 1]) {
      const eye = mesh(geo('reye', () => new THREE.CapsuleGeometry(0.06, 0.06, 6, 12)), glowMat(0x6ef2ff, 2.5)); eye.position.set(s * 0.17, 0.08, 0.45); head.add(eye);
      const ear = mesh(geo('rear', () => new THREE.CylinderGeometry(0.13, 0.13, 0.1, 24).rotateZ(Math.PI / 2)), chromeMat()); ear.position.set(s * 0.5, 0.02, 0); head.add(ear);
      const bolt = mesh(geo('rbolt', () => new THREE.CylinderGeometry(0.05, 0.05, 0.14, 12).rotateZ(Math.PI / 2)), paintMat(ch.accent)); bolt.position.set(s * 0.56, 0.02, 0); head.add(bolt);
    }
    const mouthL = mesh(geo('rmouth', () => new THREE.TorusGeometry(0.1, 0.018, 6, 20, Math.PI)), glowMat(0x6ef2ff, 2)); mouthL.rotation.z = Math.PI; mouthL.position.set(0, -0.04, 0.45); head.add(mouthL);
    const ant = mesh(geo('rant', () => new THREE.CylinderGeometry(0.025, 0.035, 0.36, 8)), chromeMat()); ant.position.y = 0.58; head.add(ant);
    const bulb = mesh(geo('rbulb', () => new THREE.SphereGeometry(0.08, 16, 12)), glowMat(0xff4d6d, 2)); bulb.position.y = 0.8; head.add(bulb); head.userData.bulb = bulb;
    for (const s of [-1, 1]) { const ch2 = mesh(geo('rcheek', () => new THREE.CircleGeometry(0.05, 16)), glowMat(0xff8fa8, 1)); ch2.position.set(s * 0.3, -0.12, 0.415); head.add(ch2); }
  } else {
    // Muzzle, nose, face
    if (sp !== 'Frog' && sp !== 'Octopus' && sp !== 'Ladybird') {
      const muzzle = mesh(geo('muzzle', () => new THREE.SphereGeometry(0.25, 28, 20)), sp === 'Panda' ? white : acc);
      muzzle.position.set(0, -0.13, 0.33); muzzle.scale.set(1.2, 0.82, 0.85); head.add(muzzle);
      const nose = mesh(geo('nose', () => new THREE.SphereGeometry(0.075, 18, 12)), glossMat(0x1d1d26)); nose.position.set(0, -0.04, 0.55); nose.scale.set(1.25, 0.85, 0.9); head.add(nose);
      addSmile(head, -0.2, 0.53);
    } else { addSmile(head, -0.16, 0.47, 1.6); }
    if (sp === 'Panda') for (const s of [-1, 1]) { const patch = mesh(geo('patch', () => new THREE.SphereGeometry(0.15, 20, 14)), dark); patch.position.set(s * 0.19, 0.08, 0.34); patch.scale.set(0.95, 1.25, 0.6); patch.rotation.z = s * 0.5; head.add(patch); }
    addEyes(head, ch, sp === 'Frog' ? { y: 0.42, z: 0.18, spread: 0.24, size: 1.25 } : { y: 0.1, z: 0.4, size: 1.12 });
    addCheeks(head);
    if (sp === 'Fox') {
      earPair(head, main, dark, { x: 0.28, y: 0.38, r: 0.17, h: 0.46, tilt: 0.32 });
      for (const s of [-1, 1]) { const cheekFluff = mesh(geo('fluff', () => new THREE.ConeGeometry(0.12, 0.3, 12)), acc); cheekFluff.position.set(s * 0.42, -0.14, 0.12); cheekFluff.rotation.z = s * 1.9; head.add(cheekFluff); }
    } else if (sp === 'Cat') {
      earPair(head, main, pink, { x: 0.27, y: 0.36, r: 0.17, h: 0.34, tilt: 0.25 });
      const wm = furMat(0xffffff);
      for (const s of [-1, 1]) for (let i = -1; i <= 1; i++) { const w = mesh(geo('whisker', () => new THREE.CylinderGeometry(0.006, 0.006, 0.36, 4).rotateZ(Math.PI / 2)), wm); w.position.set(s * 0.32, -0.1 + i * 0.045, 0.42); w.rotation.set(0, -s * 0.35, s * i * 0.12); head.add(w); }
    } else if (sp === 'Panda' || sp === 'Bear') {
      const earM = sp === 'Panda' ? dark : main;
      for (const s of [-1, 1]) {
        const ear = mesh(geo('rearball', () => new THREE.SphereGeometry(0.16, 20, 14)), earM); ear.position.set(s * 0.36, 0.38, -0.02); ear.scale.z = 0.6; head.add(ear);
        const inn = mesh(geo('rearin', () => new THREE.SphereGeometry(0.09, 16, 10)), sp === 'Panda' ? furMat(0x3a3a46) : acc); inn.position.set(s * 0.36, 0.37, 0.06); inn.scale.z = 0.4; head.add(inn);
      }
    } else if (sp === 'Frog') {
      for (const s of [-1, 1]) { const bump = mesh(geo('fbump', () => new THREE.SphereGeometry(0.2, 20, 14)), main); bump.position.set(s * 0.24, 0.36, 0.12); head.add(bump); }
    } else if (sp === 'Ladybird') {
      for (let i = 0; i < 5; i++) { const spot = mesh(geo('lspot', () => new THREE.SphereGeometry(0.08, 14, 10)), dark); const a = i * 1.25 + 0.4; spot.position.set(Math.sin(a) * 0.3, 0.33, Math.cos(a) * 0.3 - 0.08); spot.scale.y = 0.4; spot.lookAt(spot.position.clone().multiplyScalar(3)); head.add(spot); }
      for (const s of [-1, 1]) { const ant = mesh(geo('lant', () => tube([V(0.12, 0.42, 0.05), V(0.2, 0.62, 0.08), V(0.3, 0.72, 0.18)], 0.02, 12)), dark); ant.scale.x = s; head.add(ant); const tip = mesh(geo('ltip', () => new THREE.SphereGeometry(0.055, 12, 8)), dark); tip.position.set(s * 0.3, 0.72, 0.18); head.add(tip); }
    } else if (sp === 'Octopus') {
      skull.scale.set(1.05, 1.2, 1.05); head.position.y = 1.2;
      for (let i = 0; i < 6; i++) { const a = (i / 6) * Math.PI * 2 + 0.5; const t = mesh(geo('tent' + i, () => tube([V(Math.sin(a) * 0.32, 0.25, Math.cos(a) * 0.32), V(Math.sin(a) * 0.5, 0.05, Math.cos(a) * 0.5), V(Math.sin(a) * 0.6, 0.12, Math.cos(a) * 0.62)], 0.07, 14)), main); g.add(t); }
    }
    if (sp !== 'Frog') addGoggles(head, ch.kart);
  }

  // Tails peek out behind the seat
  if (sp === 'Fox') {
    const tail = new THREE.Group(); tail.position.set(0.22, 0.22, -0.42); tail.rotation.set(-0.6, 0.5, 0); g.add(tail);
    const fur = mesh(geo('ftail', () => new THREE.SphereGeometry(0.22, 24, 16)), main); fur.scale.set(1, 1, 2.4); fur.position.z = -0.42; tail.add(fur);
    const tip = mesh(geo('ftip', () => new THREE.SphereGeometry(0.16, 20, 14)), furMat(0xffffff)); tip.position.z = -0.88; tip.scale.set(1, 1, 1.4); tail.add(tip);
    g.userData.tail = tail;
  } else if (sp === 'Cat') {
    const tail = new THREE.Group(); tail.position.set(0.2, 0.2, -0.38); g.add(tail);
    tail.add(mesh(geo('ctail', () => tube([V(0, 0, 0), V(0.1, 0.1, -0.35), V(0.15, 0.5, -0.5), V(0.05, 0.75, -0.4)], 0.06, 20)), main));
    g.userData.tail = tail;
  } else if (sp === 'Bear' || sp === 'Panda') {
    const stub = mesh(geo('stub', () => new THREE.SphereGeometry(0.1, 14, 10)), sp === 'Panda' ? dark : main); stub.position.set(0, 0.15, -0.42); g.add(stub);
  }

  g.userData.head = head; g.userData.body = torso;
  return g;
}

// Item visuals
export function buildItemBox() {
  const g = new THREE.Group();
  const box1 = new THREE.Mesh(new THREE.BoxGeometry(1.5, 1.5, 1.5), new THREE.MeshPhysicalMaterial({ color: 0xffffff, transparent: true, opacity: 0.45, roughness: 0.05, transmission: 0.6, thickness: 1, clearcoat: 1, iridescence: 1, iridescenceIOR: 1.6 }));
  const edge = new THREE.LineSegments(new THREE.EdgesGeometry(box1.geometry), new THREE.LineBasicMaterial({ color: 0xffffff }));
  box1.add(edge);
  const q = new THREE.Mesh(new THREE.TorusKnotGeometry(0.28, 0.1, 40, 8), new THREE.MeshStandardMaterial({ color: 0xffd23f, emissive: 0xffd23f, emissiveIntensity: 1.2, roughness: 0.3, metalness: 0.5 }));
  g.add(box1, q); g.userData.inner = q; g.userData.box = box1;
  return g;
}
export function buildJelly() {
  const m = new THREE.Mesh(new THREE.SphereGeometry(0.7, 20, 16), new THREE.MeshPhysicalMaterial({ color: 0xb14cff, roughness: 0.1, transmission: 0.4, thickness: 1, clearcoat: 1 })); m.scale.set(1, 0.45, 1); m.position.y = 0.3;
  const g = new THREE.Group(); g.add(m);
  const dot = new THREE.Mesh(new THREE.SphereGeometry(0.2, 8, 8), toon(0xfff176)); dot.position.set(0.2, 0.5, 0.1); g.add(dot);
  return g;
}
export function buildBall() {
  const g = new THREE.Group();
  const m = new THREE.Mesh(new THREE.SphereGeometry(0.6, 24, 18), paintMat(0xff4d6d)); m.position.y = 0.6; g.add(m);
  const stripe = new THREE.Mesh(new THREE.TorusGeometry(0.6, 0.08, 6, 20), toon(0xffffff)); stripe.position.y = 0.6; stripe.rotation.x = Math.PI / 2; g.add(stripe);
  return g;
}
export function buildRocketIcon() {
  const g = new THREE.Group();
  const b = new THREE.Mesh(new THREE.CapsuleGeometry(0.3, 0.9, 4, 10), toon(0xff5c2a)); b.rotation.x = Math.PI / 2; g.add(b);
  return g;
}
export const ITEMS = {
  rocket: { name: 'Rocket', emoji: '🚀', colour: '#ff5c2a', hint: 'Big boost!' },
  jelly: { name: 'Jelly', emoji: '🟣', colour: '#b14cff', hint: 'Drop it behind you' },
  ball: { name: 'Bouncy Ball', emoji: '🔴', colour: '#ff4d6d', hint: 'Fire it ahead' },
  bubble: { name: 'Bubble', emoji: '🫧', colour: '#7bdcff', hint: 'Blocks one hit' },
};
