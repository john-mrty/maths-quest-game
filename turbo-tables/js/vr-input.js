// XR-standard controllers are separate from ordinary browser gamepads.
export function readVRControllers(sources = []) {
  const input = { steer: 0, brake: 0, confirm: false, pause: false, exit: false };
  for (const source of sources) {
    const pad = source.gamepad;
    if (!pad || pad.mapping !== 'xr-standard') continue;
    const primary = !!pad.buttons[4]?.pressed;
    const secondary = !!pad.buttons[5]?.pressed;
    if (source.handedness === 'left') {
      const x = pad.axes[2] || 0;
      input.steer = Math.abs(x) > 0.15 ? -Math.sign(x) * (Math.abs(x) - 0.15) / 0.85 : 0;
      input.brake = pad.buttons[1]?.pressed ? 1 : 0;
      input.pause ||= primary;
      input.exit ||= secondary;
    } else if (source.handedness === 'right') {
      input.confirm ||= primary;
      input.pause ||= secondary;
      input.answerAxis = pad.axes[2] || 0;
    }
  }
  return input;
}

export class VRInput {
  constructor() { this.reset(); }
  reset() { this.previous = {}; this.question = null; this.choice = 1; this.armed = false; }
  update(sources, question) {
    const held = readVRControllers(sources);
    // A held driving/item button must be released before it can answer a new question.
    if (question !== this.question) { this.question = question; this.choice = 1; this.armed = false; }
    if (!held.confirm && Math.abs(held.answerAxis || 0) < 0.4) this.armed = true;
    const axis = held.answerAxis || 0;
    if (this.armed && Math.abs(axis) > 0.6 && Math.abs(this.previous.answerAxis || 0) <= 0.6) {
      this.choice = Math.max(0, Math.min(2, this.choice + Math.sign(axis)));
    }
    const result = { ...held, choice: this.choice, confirmPressed: this.armed && held.confirm && !this.previous.confirm,
      pausePressed: held.pause && !this.previous.pause, exitPressed: held.exit && !this.previous.exit };
    this.previous = held;
    return result;
  }
}
