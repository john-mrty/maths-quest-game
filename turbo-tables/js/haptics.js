// Short, bounded patterns. Higher priority events may interrupt a kerb pulse.
export function createHaptics({ device = globalThis.navigator, enabled, active, now = () => performance.now() }) {
  const supported = typeof device?.vibrate === 'function';
  let busyUntil = 0, priority = 0;
  const last = new Map();
  function stop() {
    if (supported) { try { device.vibrate(0); } catch {} }
    busyUntil = 0; priority = 0; last.clear();
  }
  function pulse(kind, strength = 0) {
    if (!supported || !enabled() || !active() || device.userActivation?.hasBeenActive === false) return;
    const t = now();
    const spec = kind === 'wall' ? { pattern: strength > 10 ? 32 : 18, gap: 450, priority: 3, duration: strength > 10 ? 32 : 18 }
      : kind === 'boost' ? { pattern: [14, 35, 24], gap: 650, priority: 2, duration: 73 }
      : kind === 'rumble' ? { pattern: 7, gap: 180, priority: 1, duration: 7 } : null;
    if (!spec || t - (last.get(kind) ?? -Infinity) < spec.gap || (t < busyUntil && priority >= spec.priority)) return;
    try {
      if (device.vibrate(spec.pattern) === false) return;
      last.set(kind, t); priority = spec.priority; busyUntil = t + spec.duration;
    } catch { /* Unsupported or blocked feedback must never interrupt racing. */ }
  }
  return { supported, pulse, stop };
}
