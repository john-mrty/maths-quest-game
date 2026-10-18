import * as THREE from 'three';

// Procedural high-resolution textures, generated at load so no image files are needed.
// Each generator returns tileable canvas textures (albedo, and where useful normal/roughness maps).

// ---- Noise ----
function hash(x, y, seed) { let h = (x * 374761393 + y * 668265263 + seed * 1442695041) | 0; h = Math.imul(h ^ (h >>> 13), 1274126177); return ((h ^ (h >>> 16)) >>> 0) / 4294967296; }
function valueNoise(x, y, period, seed) {
  const xi = Math.floor(x), yi = Math.floor(y); const xf = x - xi, yf = y - yi;
  const u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf);
  const w = (i, j) => hash(((i % period) + period) % period, ((j % period) + period) % period, seed);
  const a = w(xi, yi), b = w(xi + 1, yi), c = w(xi, yi + 1), d = w(xi + 1, yi + 1);
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
}
// Tileable fractal noise in [0,1]
function fbm(x, y, { octaves = 5, period = 8, seed = 1, gain = 0.5 } = {}) {
  let sum = 0, amp = 1, norm = 0, p = period;
  for (let o = 0; o < octaves; o++) { sum += valueNoise(x * p, y * p, p, seed + o * 17) * amp; norm += amp; amp *= gain; p *= 2; }
  return sum / norm;
}

function canvasTexture(c, { repeat = [1, 1], srgb = true, aniso = 8 } = {}) {
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(repeat[0], repeat[1]); t.anisotropy = aniso;
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  t.generateMipmaps = true; t.minFilter = THREE.LinearMipmapLinearFilter;
  return t;
}
function makeCanvas(size) { const c = document.createElement('canvas'); c.width = c.height = size; return c; }

// Height field -> tangent-space normal map
function normalFromHeight(height, size, strength = 2) {
  const c = makeCanvas(size), x = c.getContext('2d'), img = x.createImageData(size, size), d = img.data;
  for (let j = 0; j < size; j++) for (let i = 0; i < size; i++) {
    const l = height[j * size + ((i - 1 + size) % size)], r = height[j * size + ((i + 1) % size)];
    const u = height[((j - 1 + size) % size) * size + i], dn = height[((j + 1) % size) * size + i];
    let nx = (l - r) * strength, ny = (u - dn) * strength, nz = 1; const len = Math.hypot(nx, ny, nz); nx /= len; ny /= len; nz /= len;
    const k = (j * size + i) * 4; d[k] = (nx * 0.5 + 0.5) * 255; d[k + 1] = (ny * 0.5 + 0.5) * 255; d[k + 2] = (nz * 0.5 + 0.5) * 255; d[k + 3] = 255;
  }
  x.putImageData(img, 0, 0); return c;
}
function grayCanvas(values, size) {
  const c = makeCanvas(size), x = c.getContext('2d'), img = x.createImageData(size, size), d = img.data;
  for (let i = 0; i < size * size; i++) { const v = Math.max(0, Math.min(255, values[i] * 255)); d[i * 4] = d[i * 4 + 1] = d[i * 4 + 2] = v; d[i * 4 + 3] = 255; }
  x.putImageData(img, 0, 0); return c;
}
const mix = (a, b, t) => a + (b - a) * t;
const hexRGB = (h) => [(h >> 16) & 255, (h >> 8) & 255, h & 255];

// ---- Asphalt: grainy surface with aggregate, subtle cracks and wear ----
export function asphalt(baseHex = 0x55586e, size = 1024) {
  const c = makeCanvas(size), x = c.getContext('2d'), img = x.createImageData(size, size), d = img.data;
  const h = new Float32Array(size * size), rough = new Float32Array(size * size);
  const [br, bg, bb] = hexRGB(baseHex);
  for (let j = 0; j < size; j++) for (let i = 0; i < size; i++) {
    const u = i / size, v = j / size;
    const grain = fbm(u, v, { octaves: 6, period: 64, seed: 3, gain: 0.55 });
    const blotch = fbm(u, v, { octaves: 3, period: 4, seed: 9 });
    const speck = hash(i, j, 77) > 0.985 ? 0.35 : 0;
    const wear = Math.pow(fbm(u, v, { octaves: 4, period: 6, seed: 21 }), 2);
    const shade = 0.88 + grain * 0.18 + (blotch - 0.5) * 0.12 + speck * 0.35 - wear * 0.07;
    const k = (j * size + i) * 4;
    d[k] = br * shade; d[k + 1] = bg * shade; d[k + 2] = bb * shade * 1.02; d[k + 3] = 255;
    h[j * size + i] = grain * 0.7 + speck + wear * 0.3; rough[j * size + i] = 0.75 + grain * 0.2 - speck * 0.5;
  }
  x.putImageData(img, 0, 0);
  return { map: canvasTexture(c), normalMap: canvasTexture(normalFromHeight(h, size, 2.5), { srgb: false }), roughnessMap: canvasTexture(grayCanvas(rough, size), { srgb: false }) };
}

// ---- Grass: layered blades with colour variation ----
export function grass(aHex = 0x5fc24d, bHex = 0x3e9c3a, size = 1024) {
  const c = makeCanvas(size), x = c.getContext('2d'), img = x.createImageData(size, size), d = img.data;
  const [ar, ag, ab] = hexRGB(aHex), [br, bg, bb] = hexRGB(bHex);
  const h = new Float32Array(size * size);
  for (let j = 0; j < size; j++) for (let i = 0; i < size; i++) {
    const u = i / size, v = j / size;
    const patch = fbm(u, v, { octaves: 4, period: 5, seed: 31 });
    const blades = fbm(u * 1, v * 1, { octaves: 5, period: 90, seed: 5, gain: 0.6 });
    const streak = fbm(u, v * 3, { octaves: 3, period: 40, seed: 12 });
    const t = Math.min(1, Math.max(0, patch * 0.7 + blades * 0.6 - 0.25));
    const light = 0.94 + (blades - 0.5) * 0.2 + (streak - 0.5) * 0.08;
    const k = (j * size + i) * 4;
    d[k] = mix(ar, br, t) * light; d[k + 1] = mix(ag, bg, t) * light; d[k + 2] = mix(ab, bb, t) * light; d[k + 3] = 255;
    h[j * size + i] = blades;
  }
  x.putImageData(img, 0, 0);
  return { map: canvasTexture(c, { aniso: 16 }), normalMap: canvasTexture(normalFromHeight(h, size, 1.5), { srgb: false }) };
}

// ---- Kerb stripes with painted wear ----
export function kerb(aHex, bHex, size = 512) {
  const c = makeCanvas(size), x = c.getContext('2d');
  x.fillStyle = '#' + aHex.toString(16).padStart(6, '0'); x.fillRect(0, 0, size, size);
  x.fillStyle = '#' + bHex.toString(16).padStart(6, '0'); x.fillRect(0, 0, size, size / 2);
  const img = x.getImageData(0, 0, size, size), d = img.data;
  for (let j = 0; j < size; j++) for (let i = 0; i < size; i++) {
    const n = fbm(i / size, j / size, { octaves: 5, period: 32, seed: 8 });
    const k = (j * size + i) * 4; const f = 0.85 + n * 0.3;
    d[k] *= f; d[k + 1] *= f; d[k + 2] *= f;
  }
  x.putImageData(img, 0, 0);
  return canvasTexture(c);
}

// ---- Bark ----
export function bark(hex = 0x7a4b2e, size = 512) {
  const c = makeCanvas(size), x = c.getContext('2d'), img = x.createImageData(size, size), d = img.data;
  const [r, g, b] = hexRGB(hex); const h = new Float32Array(size * size);
  for (let j = 0; j < size; j++) for (let i = 0; i < size; i++) {
    const u = i / size, v = j / size;
    const ridges = fbm(u * 6, v, { octaves: 5, period: 12, seed: 44, gain: 0.55 });
    const shade = 0.6 + ridges * 0.7;
    const k = (j * size + i) * 4; d[k] = r * shade; d[k + 1] = g * shade; d[k + 2] = b * shade; d[k + 3] = 255; h[j * size + i] = ridges;
  }
  x.putImageData(img, 0, 0);
  return { map: canvasTexture(c), normalMap: canvasTexture(normalFromHeight(h, size, 3), { srgb: false }) };
}

// ---- Foliage: leafy clusters ----
export function foliage(hex, size = 512) {
  const c = makeCanvas(size), x = c.getContext('2d'), img = x.createImageData(size, size), d = img.data;
  const [r, g, b] = hexRGB(hex); const h = new Float32Array(size * size);
  for (let j = 0; j < size; j++) for (let i = 0; i < size; i++) {
    const u = i / size, v = j / size;
    const leaf = fbm(u, v, { octaves: 5, period: 24, seed: 61, gain: 0.6 });
    const big = fbm(u, v, { octaves: 2, period: 4, seed: 62 });
    const shade = 0.88 + leaf * 0.2 + (big - 0.5) * 0.1;
    const k = (j * size + i) * 4; d[k] = r * shade; d[k + 1] = g * shade; d[k + 2] = b * shade; d[k + 3] = 255; h[j * size + i] = leaf;
  }
  x.putImageData(img, 0, 0);
  return { map: canvasTexture(c), normalMap: canvasTexture(normalFromHeight(h, size, 2), { srgb: false }) };
}

// ---- Tyre tread ----
export function tread(size = 256) {
  const c = makeCanvas(size), x = c.getContext('2d');
  x.fillStyle = '#1b1b22'; x.fillRect(0, 0, size, size);
  x.fillStyle = '#2a2a33';
  for (let i = 0; i < 8; i++) { x.fillRect(0, i * 32 + 6, size, 14); }
  x.fillStyle = '#121218'; for (let i = 0; i < 8; i++) for (let j = 0; j < 4; j++) x.fillRect(j * 64 + (i % 2) * 32, i * 32 + 8, 20, 10);
  return canvasTexture(c, { repeat: [3, 1] });
}

// ---- Metal brushed ----
export function brushedMetal(size = 512) {
  const c = makeCanvas(size), x = c.getContext('2d'), img = x.createImageData(size, size), d = img.data;
  for (let j = 0; j < size; j++) for (let i = 0; i < size; i++) {
    const n = fbm(i / size, j / size * 40, { octaves: 3, period: 8, seed: 90 });
    const v = 150 + n * 90; const k = (j * size + i) * 4; d[k] = d[k + 1] = v; d[k + 2] = v + 6; d[k + 3] = 255;
  }
  x.putImageData(img, 0, 0); return canvasTexture(c);
}

// ---- Candy stripes & moon regolith for themed tracks ----
export function candy(size = 512) {
  const c = makeCanvas(size), x = c.getContext('2d');
  const cols = ['#ff5fa2', '#fff3fa', '#7bdcff', '#fff3fa', '#fff176', '#fff3fa'];
  for (let i = 0; i < 12; i++) { x.fillStyle = cols[i % cols.length]; x.beginPath(); x.moveTo(i * size / 6 - size, size); x.lineTo(i * size / 6, 0); x.lineTo((i + 1) * size / 6, 0); x.lineTo((i + 1) * size / 6 - size, size); x.fill(); }
  return canvasTexture(c);
}
export function regolith(size = 1024) {
  const c = makeCanvas(size), x = c.getContext('2d'), img = x.createImageData(size, size), d = img.data; const h = new Float32Array(size * size);
  for (let j = 0; j < size; j++) for (let i = 0; i < size; i++) {
    const u = i / size, v = j / size;
    const dust = fbm(u, v, { octaves: 6, period: 16, seed: 71, gain: 0.55 });
    let crater = 0; for (let k = 0; k < 10; k++) { const cx = hash(k, 1, 5), cy = hash(k, 2, 5), cr = 0.03 + hash(k, 3, 5) * 0.08; let dx = Math.abs(u - cx), dy = Math.abs(v - cy); dx = Math.min(dx, 1 - dx); dy = Math.min(dy, 1 - dy); const dist = Math.hypot(dx, dy) / cr; if (dist < 1) crater += (dist > 0.8 ? 0.5 : -0.4 * (1 - dist)); }
    const shade = 0.55 + dust * 0.6 + crater * 0.5;
    const k = (j * size + i) * 4; d[k] = 150 * shade; d[k + 1] = 152 * shade; d[k + 2] = 175 * shade; d[k + 3] = 255; h[j * size + i] = dust + crater;
  }
  x.putImageData(img, 0, 0); return { map: canvasTexture(c, { aniso: 16 }), normalMap: canvasTexture(normalFromHeight(h, size, 2.5), { srgb: false }) };
}

// ---- Clay: soft hand-pressed lumps and tiny pores, used as a subtle normal map on everything ----
export function clayNormal(size = 256) {
  const h = new Float32Array(size * size);
  for (let j = 0; j < size; j++) for (let i = 0; i < size; i++) {
    const u = i / size, v = j / size;
    h[j * size + i] = fbm(u, v, { octaves: 3, period: 4, seed: 131 }) * 0.8 + fbm(u, v, { octaves: 2, period: 48, seed: 133 }) * 0.2;
  }
  const t = canvasTexture(normalFromHeight(h, size, 6), { srgb: false, repeat: [2, 2] });
  return t;
}

// ---- Soft round sprite for particles / glow ----
export function softSprite(size = 128) {
  const c = makeCanvas(size), x = c.getContext('2d'); const g = x.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(0.4, 'rgba(255,255,255,0.6)'); g.addColorStop(1, 'rgba(255,255,255,0)');
  x.fillStyle = g; x.fillRect(0, 0, size, size); const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}
export function cloudSprite(size = 256) {
  const c = makeCanvas(size), x = c.getContext('2d'), img = x.createImageData(size, size), d = img.data;
  for (let j = 0; j < size; j++) for (let i = 0; i < size; i++) {
    const u = i / size - 0.5, v = j / size - 0.5; const r = Math.hypot(u, v * 1.6) * 2;
    const n = fbm(i / size, j / size, { octaves: 5, period: 6, seed: 99, gain: 0.55 });
    const a = Math.max(0, Math.min(1, (1 - r) * 1.8 + (n - 0.5) * 1.2));
    const k = (j * size + i) * 4; const l = 230 + n * 25; d[k] = l; d[k + 1] = l; d[k + 2] = 255; d[k + 3] = a * a * 255;
  }
  x.putImageData(img, 0, 0); const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}
