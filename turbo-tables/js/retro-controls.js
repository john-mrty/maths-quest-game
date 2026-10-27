// Captured pointers allow simultaneous steering/action without stuck buttons.
export function createRetroControls(surface, { enabled, direction, action, brake }) {
  const held = new Map();
  function update() {
    const dirs = [...held.values()].filter(v => v.kind === 'left' || v.kind === 'right');
    direction(dirs.at(-1)?.kind === 'left' ? 1 : dirs.at(-1)?.kind === 'right' ? -1 : 0, false);
    brake([...held.values()].some(v => v.kind === 'brake'));
  }
  function reset() { for (const v of held.values()) v.button.classList.remove('active'); held.clear(); direction(0, false); brake(false); }
  function down(e) {
    const button = e.target.closest('[data-retro]');
    if (!button || !surface.contains(button) || !enabled() || (e.pointerType === 'mouse' && e.button !== 0)) return;
    e.preventDefault(); button.setPointerCapture(e.pointerId);
    held.set(e.pointerId, { kind: button.dataset.retro, button }); button.classList.add('active');
    const kind = button.dataset.retro;
    update();
    if (kind === 'left' || kind === 'right') direction(kind === 'left' ? 1 : -1, true);
    if (kind === 'action') action();
  }
  function up(e) {
    const press = held.get(e.pointerId); if (!press) return;
    held.delete(e.pointerId);
    if (![...held.values()].some(v => v.button === press.button)) press.button.classList.remove('active');
    update();
  }
  const events = { pointerdown: down, pointerup: up, pointercancel: up, lostpointercapture: up };
  for (const [name, handler] of Object.entries(events)) surface.addEventListener(name, handler);
  return { reset, dispose() { reset(); for (const [name, handler] of Object.entries(events)) surface.removeEventListener(name, handler); } };
}
