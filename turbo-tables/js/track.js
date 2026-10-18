import * as THREE from 'three';
import * as TEX from './textures.js';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

// Shared material helper: physically based, with a slightly stylised matte finish by default.
// Matte clay: soft roughness, a faint velvet sheen on the edges and gentle hand-made lumps
let clayN = null;
export function clay(color, extra = {}) {
  clayN = clayN || TEX.clayNormal();
  return new THREE.MeshPhysicalMaterial({ color, roughness: 0.86, metalness: 0, normalMap: clayN, normalScale: new THREE.Vector2(0.22, 0.22), sheen: 0.55, sheenRoughness: 0.85, sheenColor: new THREE.Color(0xffffff), envMapIntensity: 0.3, ...extra });
}
export const toon = clay;

export const ROAD_HALF = 8;
export const LANES = [-5, 0, 5];

export const TRACKS = [
  {
    id: 'meadow', name: 'Sunny Meadow', blurb: 'Gentle bends, big skies. A good first race.', laps: 3,
    sky: 0x8ccaf5, skyBottom: 0xe6f5ff, horizon: 0xfff3d6, fog: 0xdcefff, sun: [60, 90, 40], sunColour: 0xfff2e0, sunIntensity: 1.7, hemi: 1.1,
    ground: 0xa6e28f, ground2: 0x8fd47f, road: 0xaaacc6, kerbA: 0xff9fb2, kerbB: 0xfffaf0,
    wall: 0xfffaf3, wallB: 0xa9d8ff, tree: [0x9fdc8c, 0xb8e89a, 0x86cf86], trunk: 0xc7a184, hill: 0xb3e6a0, decor: 'trees', cloud: 0xffffff, lake: true,
    points: [[0, 0], [120, 0], [200, 40], [220, 140], [160, 210], [60, 230], [-40, 200], [-80, 120], [-160, 90], [-200, 0], [-150, -90], [-60, -110], [0, -60]],
  },
  {
    id: 'candy', name: 'Candy Canyon', blurb: 'Twisty sweets and sugar cliffs. Hold that drift!', laps: 3,
    sky: 0xffb8dc, skyBottom: 0xfff0f7, horizon: 0xfff3c4, fog: 0xffe3f0, sun: [-50, 70, 60], sunColour: 0xfff4ea, sunIntensity: 1.6, hemi: 1.15,
    ground: 0xffc6e3, ground2: 0xf7b0d6, road: 0xb39fc8, kerbA: 0xffffff, kerbB: 0xff9fc9,
    wall: 0xfff3b8, wallB: 0xffb3d4, tree: [0xff9fc9, 0xa8e2ff, 0xfff0a0, 0xd3b8ff], trunk: 0xfffaf3, hill: 0xe9b8e6, decor: 'lollipops', cloud: 0xfff6fb,
    points: [[0, 0], [100, 10], [150, 70], [110, 130], [160, 190], [240, 170], [260, 80], [220, -20], [120, -60], [40, -30], [-40, -80], [-140, -70], [-190, 10], [-150, 100], [-60, 110], [-30, 50]],
  },
  {
    id: 'moon', name: 'Moon Loop', blurb: 'Race under the stars with long, fast straights.', laps: 3,
    sky: 0x2a2f6e, skyBottom: 0x6a6fc4, horizon: 0xa9a6ff, fog: 0x4a4f9a, sun: [-80, 70, -60], sunColour: 0xe2e6ff, sunIntensity: 1.3, hemi: 0.85,
    ground: 0xb9bbd9, ground2: 0xa3a6cc, road: 0x7d82b0, kerbA: 0xa8f2ff, kerbB: 0x8a8fd0,
    wall: 0xc8f6ff, wallB: 0x9aa3ec, tree: [0xa8f2ff, 0xd4bbff, 0xb5ffd6], trunk: 0xe6e8ff, hill: 0x8c90c4, decor: 'crystals', cloud: 0x6a6fb0, stars: true,
    points: [[0, 0], [180, 0], [260, 60], [240, 160], [120, 200], [20, 160], [-60, 220], [-180, 200], [-240, 100], [-200, -20], [-100, -40], [-40, -100], [-20, -60]],
  },
];

function makeCurve(points) {
  const pts = points.map(([x, z], i) => new THREE.Vector3(x, 1.3 + Math.sin(i * 1.7) * 0.8 + Math.cos(i * 0.9) * 0.4, z));
  return new THREE.CatmullRomCurve3(pts, true, 'centripetal', 0.6);
}

export class Track {
  constructor(def, quality = 'high') {
    this.def = def; this.quality = quality;
    this.curve = makeCurve(def.points);
    this.length = this.curve.getLength();
    this.N = Math.round(this.length / 2);
    const pts = this.curve.getSpacedPoints(this.N);
    pts.pop();
    this.samples = pts.map((p, i) => {
      const t = i / this.N;
      const tangent = this.curve.getTangentAt(t).normalize();
      const right = new THREE.Vector3().crossVectors(tangent, new THREE.Vector3(0, 1, 0)).normalize();
      return { pos: p, tangent, right, t };
    });
    this.group = new THREE.Group();
    this.textures = this.makeTextures();
    this.buildRoad();
    this.buildWalls();
    this.buildStartLine();
    this.buildDecor();
    this.layoutFeatures();
  }

  makeTextures() {
    const d = this.def; const big = 512;
    const t = { asphalt: TEX.asphalt(d.road, big), kerb: TEX.kerb(d.kerbA, d.kerbB), bark: TEX.bark(d.trunk), foliage: d.tree.map((c) => TEX.foliage(c, 256)), cloud: TEX.cloudSprite() };
    if (d.decor === 'crystals') t.ground = TEX.regolith(big); else t.ground = TEX.grass(d.ground, d.ground2, big);
    if (d.decor === 'lollipops') t.candy = TEX.candy();
    return t;
  }

  sampleAt(i) { const n = this.samples.length; return this.samples[((i % n) + n) % n]; }
  nearestIndex(pos, hint = 0) {
    const n = this.samples.length; let best = hint, bestD = Infinity;
    const range = 40, start = hint - range;
    for (let k = start; k < start + range * 2; k++) { const i = ((k % n) + n) % n; const d = this.samples[i].pos.distanceToSquared(pos); if (d < bestD) { bestD = d; best = i; } }
    return best;
  }
  lateral(pos, i) { const s = this.samples[i]; return pos.clone().sub(s.pos).dot(s.right); }
  heightAt(i, frac = 0) { const a = this.sampleAt(i).pos.y, b = this.sampleAt(i + 1).pos.y; return a + (b - a) * frac; }

  buildRoad() {
    const n = this.samples.length; const tx = this.textures;
    // Road surface with UVs: u across, v along in metres so the asphalt tiles cleanly.
    const pos = [], uv = [], idx = [];
    let along = 0;
    for (let i = 0; i <= n; i++) {
      const s = this.sampleAt(i);
      if (i > 0) along += this.sampleAt(i - 1).pos.distanceTo(s.pos);
      const l = s.pos.clone().addScaledVector(s.right, -ROAD_HALF), r = s.pos.clone().addScaledVector(s.right, ROAD_HALF);
      pos.push(l.x, l.y, l.z, r.x, r.y, r.z); uv.push(0, along / 16, 1, along / 16);
      if (i < n) { const a = i * 2; idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); }
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
    g.setIndex(idx); g.computeVertexNormals(); g.computeTangents?.();
    const roadMat = new THREE.MeshStandardMaterial({ map: tx.asphalt.map, normalMap: tx.asphalt.normalMap, normalScale: new THREE.Vector2(0.35, 0.35), roughness: 0.95, metalness: 0, envMapIntensity: 0.2, side: THREE.DoubleSide });
    const road = new THREE.Mesh(g, roadMat); road.receiveShadow = true; this.group.add(road);

    // Kerbs with a striped texture
    const kp = [], kuv = [], kidx = []; let v = 0;
    for (const side of [-1, 1]) {
      const base = kp.length / 3; let along2 = 0;
      for (let i = 0; i <= n; i++) {
        const s = this.sampleAt(i); if (i > 0) along2 += this.sampleAt(i - 1).pos.distanceTo(s.pos);
        const a = s.pos.clone().addScaledVector(s.right, side * (ROAD_HALF - 0.25)); a.y += 0.04;
        const b = s.pos.clone().addScaledVector(s.right, side * (ROAD_HALF + 1.4)); b.y += 0.12;
        kp.push(a.x, a.y, a.z, b.x, b.y, b.z); kuv.push(0, along2 / 6, 1, along2 / 6);
        if (i < n) { const q = base + i * 2; kidx.push(q, q + 1, q + 2, q + 1, q + 3, q + 2); }
      }
    }
    const kg = new THREE.BufferGeometry(); kg.setAttribute('position', new THREE.Float32BufferAttribute(kp, 3)); kg.setAttribute('uv', new THREE.Float32BufferAttribute(kuv, 2)); kg.setIndex(kidx); kg.computeVertexNormals();
    const kerb = new THREE.Mesh(kg, new THREE.MeshStandardMaterial({ map: tx.kerb, roughness: 0.9, envMapIntensity: 0.25, side: THREE.DoubleSide })); kerb.receiveShadow = true; this.group.add(kerb);

    // Raised shoulders: a flat verge at road height, then a grassy bank down to the ground.
    // This keeps the road sitting on top of the landscape instead of sinking into it.
    const ep = [], euv = [], eidx = [];
    const offs = [[ROAD_HALF + 1.3, 0.07], [ROAD_HALF + 3.6, 0.05], [ROAD_HALF + 11, null]];
    for (const side of [-1, 1]) {
      const base = ep.length / 3;
      for (let i = 0; i <= n; i++) {
        const s = this.sampleAt(i);
        for (const [o, dy] of offs) {
          const p = s.pos.clone().addScaledVector(s.right, side * o);
          p.y = dy === null ? -0.5 : s.pos.y + dy;
          ep.push(p.x, p.y, p.z); euv.push(p.x / 14, p.z / 14);
        }
        if (i < n) { const a = base + i * 3, b = a + 3; eidx.push(a, a + 1, b, a + 1, b + 1, b, a + 1, a + 2, b + 1, a + 2, b + 2, b + 1); }
      }
    }
    const eg = new THREE.BufferGeometry(); eg.setAttribute('position', new THREE.Float32BufferAttribute(ep, 3)); eg.setAttribute('uv', new THREE.Float32BufferAttribute(euv, 2)); eg.setIndex(eidx); eg.computeVertexNormals();
    const bankMap = tx.ground.map.clone(); bankMap.repeat.set(1, 1); bankMap.needsUpdate = true;
    const bankNormal = tx.ground.normalMap.clone(); bankNormal.repeat.set(1, 1); bankNormal.needsUpdate = true;
    const bank = new THREE.Mesh(eg, new THREE.MeshStandardMaterial({ map: bankMap, normalMap: bankNormal, normalScale: new THREE.Vector2(0.3, 0.3), roughness: 1, envMapIntensity: 0.2, side: THREE.DoubleSide }));
    bank.receiveShadow = true; this.group.add(bank);

    // Centre dashes and edge lines (painted, slightly glossy)
    const dp = [];
    const strip = (offset, half, i0, i1) => {
      const s0 = this.sampleAt(i0), s1 = this.sampleAt(i1);
      const a = s0.pos.clone().addScaledVector(s0.right, offset - half), b = s0.pos.clone().addScaledVector(s0.right, offset + half);
      const c = s1.pos.clone().addScaledVector(s1.right, offset - half), e = s1.pos.clone().addScaledVector(s1.right, offset + half);
      for (const p of [a, b, c, b, e, c]) dp.push(p.x, p.y + 0.03, p.z);
    };
    for (let i = 0; i < n; i += 4) strip(0, 0.22, i, i + 2);
    for (let i = 0; i < n; i++) { strip(-ROAD_HALF + 0.9, 0.12, i, i + 1); strip(ROAD_HALF - 0.9, 0.12, i, i + 1); }
    const dg = new THREE.BufferGeometry(); dg.setAttribute('position', new THREE.Float32BufferAttribute(dp, 3)); dg.computeVertexNormals();
    this.group.add(new THREE.Mesh(dg, new THREE.MeshStandardMaterial({ color: 0xfffaf0, roughness: 0.85, envMapIntensity: 0.2, side: THREE.DoubleSide, polygonOffset: true, polygonOffsetFactor: -1 })));
  }

  buildWalls() {
    const d = this.def; const n = this.samples.length; const step = 3;
    const geo = new RoundedBoxGeometry(1.2, 1.3, 2 * step - 0.2, 4, 0.42);
    const mat = clay(0xffffff);
    const mesh = new THREE.InstancedMesh(geo, mat, Math.ceil(n / step) * 2 + 2);
    mesh.castShadow = true; mesh.receiveShadow = true;
    const m = new THREE.Matrix4(), q = new THREE.Quaternion(), sc = new THREE.Vector3(1, 1, 1);
    const cA = new THREE.Color(d.wall), cB = new THREE.Color(d.wallB); let k = 0;
    for (let i = 0; i < n; i += step) {
      const s = this.sampleAt(i + 1);
      for (const side of [-1, 1]) {
        const p = s.pos.clone().addScaledVector(s.right, side * (ROAD_HALF + 2.2)); p.y += 0.5;
        q.setFromUnitVectors(new THREE.Vector3(0, 0, 1), s.tangent); m.compose(p, q, sc); mesh.setMatrixAt(k, m);
        mesh.setColorAt(k, (Math.floor(i / step) % 2) ? cA : cB); k++;
      }
    }
    mesh.count = k; this.group.add(mesh);
    // Light posts with glowing lamps every so often
    const postG = new THREE.CylinderGeometry(0.12, 0.18, 6, 8), lampG = new THREE.SphereGeometry(0.45, 12, 10);
    const postM = clay(0xf4f1ff);
    const lampM = new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: d.stars ? 0x9ef3ff : 0xffe9a8, emissiveIntensity: d.stars ? 1.6 : 0.6, roughness: 0.6 });
    for (let i = 0; i < n; i += 36) {
      const s = this.sampleAt(i); const side = (i / 36) % 2 ? -1 : 1;
      const p = s.pos.clone().addScaledVector(s.right, side * (ROAD_HALF + 4));
      const post = new THREE.Mesh(postG, postM); post.position.copy(p); post.position.y += 3; post.castShadow = true; this.group.add(post);
      const lamp = new THREE.Mesh(lampG, lampM); lamp.position.copy(p); lamp.position.y += 6.2; this.group.add(lamp);
    }
  }

  buildStartLine() {
    const s = this.sampleAt(0);
    const c = document.createElement('canvas'); c.width = 512; c.height = 128; const x = c.getContext('2d');
    for (let i = 0; i < 16; i++) for (let j = 0; j < 4; j++) { x.fillStyle = (i + j) % 2 ? '#15161f' : '#f5f5f8'; x.fillRect(i * 32, j * 32, 32, 32); }
    const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 8;
    const line = new THREE.Mesh(new THREE.PlaneGeometry(ROAD_HALF * 2, 3), new THREE.MeshStandardMaterial({ map: tex, roughness: 0.5, polygonOffset: true, polygonOffsetFactor: -2 }));
    line.position.copy(s.pos); line.position.y += 0.04; line.lookAt(s.pos.clone().add(s.tangent)); line.rotateX(-Math.PI / 2);
    this.group.add(line);
    const gantry = new THREE.Group();
    const chrome = clay(0xfffaf3);
    const postG = new THREE.CylinderGeometry(0.4, 0.5, 7.5, 14);
    for (const side of [-1, 1]) { const p = new THREE.Mesh(postG, chrome); p.position.set(side * (ROAD_HALF + 1.2), 3.75, 0); p.castShadow = true; gantry.add(p); }
    const beam = new THREE.Mesh(new RoundedBoxGeometry(ROAD_HALF * 2 + 3.6, 1.8, 1.4, 4, 0.5), clay(0xff8fa3)); beam.position.y = 7.5; beam.castShadow = true; gantry.add(beam);
    const sign = makeTextPlane('FINISH', { w: 14, h: 1.5, bg: '#ff8fa3', fg: '#fff', font: 'bold 90px "Fredoka", "Nunito", sans-serif' });
    sign.position.set(0, 7.5, 0.75); gantry.add(sign);
    const sign2 = sign.clone(); sign2.rotation.y = Math.PI; sign2.position.z = -0.75; gantry.add(sign2);
    // Bunting flags along the beam
    const flagG = new THREE.ConeGeometry(0.35, 0.9, 3); const cols = [0xffe08a, 0x9cc4ff, 0x9fe3a8, 0xd2b3ff, 0xffbf8f];
    for (let i = 0; i < 14; i++) { const f = new THREE.Mesh(flagG, toon(cols[i % cols.length], { roughness: 0.6 })); f.position.set(-ROAD_HALF + i * (ROAD_HALF * 2 / 13), 6.2, 0.9); f.rotation.x = Math.PI; gantry.add(f); }
    gantry.position.copy(s.pos); gantry.lookAt(s.pos.clone().add(s.tangent));
    this.group.add(gantry);
    this.startPos = s.pos.clone(); this.startTangent = s.tangent.clone();
  }

  isNearRoad(p, margin) {
    let best = Infinity;
    for (let i = 0; i < this.samples.length; i += 2) { const d = this.samples[i].pos.distanceToSquared(p); if (d < best) best = d; }
    return best < margin * margin;
  }

  buildDecor() {
    const d = this.def, tx = this.textures;
    // Ground: textured, slightly undulating far from the track
    const size = 1600, seg = 96;
    const groundG = new THREE.PlaneGeometry(size, size, seg, seg);
    const pa = groundG.attributes.position;
    for (let i = 0; i < pa.count; i++) {
      const x = pa.getX(i), y = pa.getY(i); const p = new THREE.Vector3(x, 0, -y);
      const dist = Math.sqrt(Math.min(...this.samples.filter((_, k) => k % 12 === 0).map((s) => s.pos.distanceToSquared(p))));
      const far = Math.max(0, Math.min(1, (dist - 40) / 120));
      pa.setZ(i, far * (Math.sin(x * 0.02) * Math.cos(y * 0.017) * 6 + Math.sin(x * 0.07 + y * 0.05) * 2));
    }
    groundG.computeVertexNormals();
    tx.ground.map.repeat.set(size / 14, size / 14); tx.ground.normalMap.repeat.set(size / 14, size / 14);
    const ground = new THREE.Mesh(groundG, new THREE.MeshStandardMaterial({ map: tx.ground.map, normalMap: tx.ground.normalMap, normalScale: new THREE.Vector2(0.3, 0.3), roughness: 1, envMapIntensity: 0.2 }));
    ground.rotation.x = -Math.PI / 2; ground.position.y = -0.35; ground.receiveShadow = true; this.group.add(ground);

    // Hills on the horizon
    const hillG = new THREE.SphereGeometry(1, 24, 16);
    const hillM = clay(d.hill, { roughness: 0.95 });
    for (let i = 0; i < 22; i++) {
      const a = (i / 22) * Math.PI * 2 + Math.sin(i * 3) * 0.2; const r = 440 + Math.sin(i * 1.3) * 70;
      const h = new THREE.Mesh(hillG, hillM); h.scale.set(100 + Math.sin(i * 2.1) * 45, 45 + Math.cos(i * 1.7) * 22, 100);
      h.position.set(Math.cos(a) * r + 30, -10, Math.sin(a) * r + 70); this.group.add(h);
    }

    // Trees / lollipops / crystals
    const rng = mulberry(42); const n = this.samples.length; const placed = [];
    const trunkG = d.decor === 'crystals' ? new THREE.ConeGeometry(1.6, 7, 6) : new THREE.CylinderGeometry(0.32, 0.55, 3.2, 10);
    const puff = () => { const parts = [[0, 0, 0, 2.1], [1.3, -0.4, 0.4, 1.4], [-1.2, -0.3, -0.3, 1.5], [0.2, 0.9, -0.6, 1.3], [-0.3, -0.6, 1.2, 1.2]].map(([x, y, z, r]) => new THREE.SphereGeometry(r, 22, 16).translate(x, y, z)); return mergeGeometries(parts); };
    const crownG = d.decor === 'lollipops' ? new THREE.SphereGeometry(2.4, 32, 24) : d.decor === 'crystals' ? new THREE.OctahedronGeometry(1.4, 1) : puff();
    const trunkM = clay(d.trunk);
    const crownM = d.decor === 'lollipops' ? clay(0xffffff, { map: tx.candy, roughness: 0.75 })
      : d.decor === 'crystals' ? clay(0xffffff, { roughness: 0.55, emissive: 0x5a62b0, emissiveIntensity: 0.35 })
      : clay(0xffffff);
    const trunks = new THREE.InstancedMesh(trunkG, trunkM, 240), crowns = new THREE.InstancedMesh(crownG, crownM, 240);
    trunks.castShadow = crowns.castShadow = true; trunks.receiveShadow = crowns.receiveShadow = true;
    const m = new THREE.Matrix4(); let k = 0; const treeCols = d.tree.map((c) => new THREE.Color(c));
    for (let tries = 0; tries < 2500 && k < 240; tries++) {
      const s = this.samples[Math.floor(rng() * n)]; const side = rng() < 0.5 ? -1 : 1;
      const dist = ROAD_HALF + 13 + rng() * 42;
      const p = s.pos.clone().addScaledVector(s.right, side * dist); p.y = -0.3;
      if (this.isNearRoad(p, ROAD_HALF + 12)) continue;
      if (placed.some((q) => q.distanceToSquared(p) < 40)) continue;
      if (d.lake && p.distanceTo(this.lakeCentre()) < 34) continue;
      placed.push(p);
      const sc = 0.8 + rng() * 0.8;
      if (d.decor === 'crystals') {
        m.compose(p.clone().setY(3 * sc - 0.3), new THREE.Quaternion().setFromEuler(new THREE.Euler(0, rng() * 3, (rng() - 0.5) * 0.3)), new THREE.Vector3(sc, sc, sc)); trunks.setMatrixAt(k, m);
        m.compose(p.clone().setY(7.6 * sc), new THREE.Quaternion(), new THREE.Vector3(sc, sc * 1.4, sc)); crowns.setMatrixAt(k, m);
      } else {
        m.compose(p.clone().setY(1.6 * sc - 0.3), new THREE.Quaternion().setFromEuler(new THREE.Euler(0, rng() * 6, 0)), new THREE.Vector3(sc, sc, sc)); trunks.setMatrixAt(k, m);
        m.compose(p.clone().setY(4.1 * sc), new THREE.Quaternion().setFromEuler(new THREE.Euler(rng() * 0.3, rng() * 6, 0)), new THREE.Vector3(sc, sc * (d.decor === 'trees' ? 1.1 : 1), sc)); crowns.setMatrixAt(k, m);
      }
      crowns.setColorAt(k, d.decor === 'trees' ? treeCols[Math.floor(rng() * treeCols.length)].clone() : d.decor === 'lollipops' ? new THREE.Color(0xffffff) : treeCols[Math.floor(rng() * treeCols.length)]); k++;
    }
    trunks.count = crowns.count = k; this.group.add(trunks, crowns);
    this.decorPositions = placed;

    // Lake with a reflective surface
    if (d.lake) {
      const c = this.lakeCentre();
      const water = new THREE.Mesh(new THREE.CircleGeometry(30, 48), new THREE.MeshPhysicalMaterial({ color: 0x9fdcff, roughness: 0.25, metalness: 0, clearcoat: 0.6, clearcoatRoughness: 0.3, transparent: true, opacity: 0.95 }));
      water.rotation.x = -Math.PI / 2; water.position.set(c.x, -0.2, c.z); this.group.add(water); this.water = water;
      const sand = new THREE.Mesh(new THREE.RingGeometry(29, 36, 48), clay(0xfff0c9, { roughness: 1 })); sand.rotation.x = -Math.PI / 2; sand.position.set(c.x, -0.3, c.z); this.group.add(sand);
    }

    // Clouds: soft sprites drifting slowly
    this.clouds = [];
    const cm = new THREE.SpriteMaterial({ map: tx.cloud, color: d.cloud, transparent: true, opacity: d.stars ? 0.5 : 0.95, depthWrite: false, fog: false });
    for (let i = 0; i < 26; i++) {
      const sp = new THREE.Sprite(cm); const sc = 60 + rng() * 80; sp.scale.set(sc, sc * 0.55, 1);
      sp.position.set((rng() - 0.5) * 1100, 90 + rng() * 90, (rng() - 0.5) * 1100); sp.userData.speed = 1 + rng() * 2.5;
      this.group.add(sp); this.clouds.push(sp);
    }
    if (d.stars) {
      const sp = [], cols = []; for (let i = 0; i < 1500; i++) { const a = rng() * Math.PI * 2, e = rng() * Math.PI * 0.48 + 0.02; sp.push(Math.cos(a) * Math.cos(e) * 700, Math.sin(e) * 700 + 10, Math.sin(a) * Math.cos(e) * 700); const w = 0.6 + rng() * 0.4; cols.push(w, w, 1); }
      const sg = new THREE.BufferGeometry(); sg.setAttribute('position', new THREE.Float32BufferAttribute(sp, 3)); sg.setAttribute('color', new THREE.Float32BufferAttribute(cols, 3));
      this.group.add(new THREE.Points(sg, new THREE.PointsMaterial({ vertexColors: true, size: 2.6, sizeAttenuation: true, fog: false, map: TEX.softSprite(), transparent: true, depthWrite: false })));
      const moon = new THREE.Mesh(new THREE.SphereGeometry(34, 32, 24), new THREE.MeshStandardMaterial({ color: 0xfff6d8, emissive: 0xfff2d0, emissiveIntensity: 0.7, roughness: 1, fog: false })); moon.position.set(-320, 240, -420); this.group.add(moon);
      const glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: TEX.softSprite(), color: 0xfff2c0, transparent: true, opacity: 0.5, depthWrite: false, fog: false })); glow.scale.set(160, 160, 1); glow.position.copy(moon.position); this.group.add(glow);
    }
  }
  lakeCentre() {
    if (this._lake) return this._lake;
    // Find the infield point furthest from the track
    let best = null, bestD = 0; const n = this.samples.length;
    for (let i = 0; i < n; i += 6) { const s = this.samples[i]; for (const dist of [40, 60, 80]) { const p = s.pos.clone().addScaledVector(s.right, dist); let m = Infinity; for (let j = 0; j < n; j += 6) m = Math.min(m, this.samples[j].pos.distanceToSquared(p)); if (m > bestD) { bestD = m; best = p; } } }
    this._lake = best || new THREE.Vector3(0, 0, 60); return this._lake;
  }

  layoutFeatures() {
    const n = this.samples.length;
    this.gateIndices = [1, 3, 5, 7].map((k) => Math.round((n * k) / 8));
    this.itemIndices = [2, 4, 6].map((k) => Math.round((n * k) / 8));
    const straightness = (i) => this.sampleAt(i).tangent.dot(this.sampleAt(i + 12).tangent);
    const cands = [];
    for (let i = 10; i < n - 10; i += 5) if (!this.gateIndices.some((g) => Math.abs(g - i) < 25) && !this.itemIndices.some((g) => Math.abs(g - i) < 15)) cands.push([straightness(i), i]);
    cands.sort((a, b) => b[0] - a[0]);
    this.boostIndices = []; for (const [, i] of cands) { if (this.boostIndices.every((b) => Math.abs(b - i) > 60)) this.boostIndices.push(i); if (this.boostIndices.length >= 2) break; }
  }

  update(dt, time) {
    for (const c of this.clouds) { c.position.x += c.userData.speed * dt; if (c.position.x > 560) c.position.x = -560; }
    if (this.water) this.water.material.clearcoatRoughness = 0.02 + Math.sin(time * 1.3) * 0.015;
  }
}

function mulberry(a) { return function () { a |= 0; a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }

export function makeTextPlane(text, { w = 6, h = 2, bg = '#ffffff', fg = '#222', font = 'bold 120px "Fredoka", "Nunito", sans-serif', radius = 40, border = null, emissive = false } = {}) {
  const c = document.createElement('canvas'); c.width = 1024; c.height = Math.round(1024 * h / w); const x = c.getContext('2d');
  const tex = new THREE.CanvasTexture(c); tex.anisotropy = 8; tex.colorSpace = THREE.SRGBColorSpace;
  const draw = (t) => {
    x.clearRect(0, 0, c.width, c.height);
    x.fillStyle = bg; roundRect(x, 8, 8, c.width - 16, c.height - 16, radius * 2); x.fill();
    if (border) { x.lineWidth = 28; x.strokeStyle = border; x.stroke(); }
    x.fillStyle = fg; x.font = font.replace(/(\d+)px/, (m, n) => (n * 2) + 'px'); x.textAlign = 'center'; x.textBaseline = 'middle';
    let size = parseInt(x.font.match(/(\d+)px/)[1], 10);
    while (x.measureText(t).width > c.width * 0.86 && size > 20) { size -= 8; x.font = x.font.replace(/\d+px/, size + 'px'); }
    x.fillText(t, c.width / 2, c.height / 2 + 6); tex.needsUpdate = true;
  };
  draw(text);
  const mat = emissive ? new THREE.MeshStandardMaterial({ map: tex, emissive: 0xffffff, emissiveMap: tex, emissiveIntensity: 0.45, transparent: true, roughness: 0.9 }) : new THREE.MeshStandardMaterial({ map: tex, transparent: true, roughness: 0.9 });
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(w, h), mat);
  mesh.setText = draw; mesh.setStyle = (o) => { if (o.bg) bg = o.bg; if (o.fg) fg = o.fg; if ('border' in o) border = o.border; };
  return mesh;
}
function roundRect(x, px, py, w, h, r) { x.beginPath(); x.moveTo(px + r, py); x.arcTo(px + w, py, px + w, py + h, r); x.arcTo(px + w, py + h, px, py + h, r); x.arcTo(px, py + h, px, py, r); x.arcTo(px, py, px + w, py, r); x.closePath(); }
