// Quality only affects rendering. Frame samples never change race rules or timing.
export const GRAPHICS = {
  high: { pixelRatio: 1.75, shadows: 2048, particles: 400, decor: 1 },
  medium: { pixelRatio: 1, shadows: 1024, particles: 180, decor: 0.65 },
  low: { pixelRatio: 0.75, shadows: 0, particles: 60, decor: 0.3 },
};
const LEVELS = ['low', 'medium', 'high'];
const KEY = 'turbo-tables-graphics-v1';
const WEEK = 7 * 24 * 60 * 60 * 1000;

export class AdaptiveGraphics {
  constructor({ touch = false, cores, memory, storage, now = Date.now() } = {}) {
    this.storage = storage;
    this.quality = (cores > 0 && cores <= 2) || (memory > 0 && memory <= 2) ? 'low'
      : touch || (cores > 0 && cores <= 4) || (memory > 0 && memory <= 4) ? 'medium' : 'high';
    try {
      const saved = JSON.parse(storage?.getItem(KEY) || 'null');
      if (saved && LEVELS.includes(saved.quality) && Number.isFinite(saved.at) && now >= saved.at && now - saved.at < WEEK) this.quality = saved.quality;
    } catch { /* Storage may be unavailable in private browsing. */ }
    this.reset();
  }
  reset(preserveUpgrade = false) {
    this.warmup = 3; this.seconds = 0; this.frames = 0;
    this.slow = 0;
    if (!preserveUpgrade) { this.fast = 0; this.nextQuality = null; }
  }
  beginRace() {
    // Raise quality only between races, after a long, smooth run.
    if (this.nextQuality) { this.quality = this.nextQuality; this.save(); }
    this.reset();
    return this.quality;
  }
  save() {
    try { this.storage?.setItem(KEY, JSON.stringify({ quality: this.quality, at: Date.now() })); } catch { /* Optional. */ }
  }
  sample(dt, active = true) {
    // Ignore menus, questions, pauses and background tabs, including their return frame.
    if (!active || !Number.isFinite(dt) || dt <= 0 || dt > 1) { this.reset(true); return null; }
    if (this.warmup > 0) { this.warmup -= dt; return null; }
    this.seconds += dt; this.frames++;
    if (this.seconds < 2) return null;
    const fps = this.frames / this.seconds, elapsed = this.seconds;
    this.seconds = 0; this.frames = 0;
    this.slow = fps < 45 ? this.slow + elapsed : 0;
    this.fast = fps >= 55 ? this.fast + elapsed : 0;
    if (this.fast >= 8 && !this.savedStable) { this.save(); this.savedStable = true; }
    const index = LEVELS.indexOf(this.quality);
    if (this.fast >= 40 && index < 2) this.nextQuality = LEVELS[index + 1];
    if (this.slow >= 6 && index > 0) {
      this.quality = LEVELS[index - 1]; this.savedStable = false;
      this.save(); this.reset(); return this.quality;
    }
    return null;
  }
  recover() {
    this.quality = 'low'; this.save(); this.reset();
    return this.quality;
  }
}
