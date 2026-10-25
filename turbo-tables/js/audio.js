// All sound is synthesised with WebAudio: no audio files needed.
export class Sound {
  constructor() { this.ctx = null; this.muted = false; this.music = null; this.engine = null; }
  ensure() {
    if (this.ctx) return;
    const AC = window.AudioContext || window.webkitAudioContext; if (!AC) return;
    this.ctx = new AC();
    this.master = this.ctx.createGain(); this.master.gain.value = this.muted ? 0 : 0.5; this.master.connect(this.ctx.destination);
    this.sfx = this.ctx.createGain(); this.sfx.gain.value = 0.7; this.sfx.connect(this.master);
    this.musicGain = this.ctx.createGain(); this.musicGain.gain.value = 0.35; this.musicGain.connect(this.master);
  }
  resume() { this.ensure(); if (this.ctx && this.ctx.state === 'suspended') this.ctx.resume(); }
  setMuted(m) { this.muted = m; if (this.master) this.master.gain.value = m ? 0 : 0.5; }
  tone(freq, dur, type = 'square', vol = 0.3, slide = 0, when = 0) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime + when;
    const o = this.ctx.createOscillator(); const g = this.ctx.createGain();
    o.type = type; o.frequency.setValueAtTime(freq, t);
    if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(30, freq + slide), t + dur);
    g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    o.connect(g); g.connect(this.sfx); o.start(t); o.stop(t + dur + 0.02);
  }
  noise(dur, vol = 0.3, when = 0) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime + when;
    const buf = this.ctx.createBuffer(1, this.ctx.sampleRate * dur, this.ctx.sampleRate);
    const d = buf.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / d.length);
    const s = this.ctx.createBufferSource(); s.buffer = buf; const g = this.ctx.createGain(); g.gain.value = vol;
    const f = this.ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 1200;
    s.connect(f); f.connect(g); g.connect(this.sfx); s.start(t);
  }
  // Named effects
  countdown(n) { this.tone(n === 0 ? 880 : 440, n === 0 ? 0.6 : 0.2, 'square', 0.25); }
  correct() { [523, 659, 784, 1047].forEach((f, i) => this.tone(f, 0.18, 'triangle', 0.3, 0, i * 0.08)); }
  wrong() { this.tone(200, 0.35, 'sawtooth', 0.25, -120); this.tone(150, 0.4, 'square', 0.15, -80, 0.1); }
  boost() { this.tone(300, 0.5, 'sawtooth', 0.25, 700); this.noise(0.4, 0.15); }
  item() { this.tone(660, 0.08, 'square', 0.2); this.tone(880, 0.08, 'square', 0.2, 0, 0.08); this.tone(1320, 0.14, 'square', 0.2, 0, 0.16); }
  bump() { this.noise(0.15, 0.3); this.tone(90, 0.15, 'square', 0.2, -40); }
  spin() { this.tone(500, 0.6, 'sawtooth', 0.2, -400); }
  hop() { this.tone(300, 0.12, 'square', 0.15, 200); }
  miniTurbo() { this.tone(500, 0.25, 'square', 0.2, 500); }
  fire() { this.noise(0.2, 0.3); this.tone(400, 0.2, 'square', 0.2, -200); }
  shield() { this.tone(400, 0.3, 'sine', 0.25, 300); }
  lapBell() { [784, 988].forEach((f, i) => this.tone(f, 0.3, 'triangle', 0.3, 0, i * 0.15)); }
  finish() { [523, 659, 784, 659, 784, 1047].forEach((f, i) => this.tone(f, 0.25, 'triangle', 0.3, 0, i * 0.13)); }
  quizOpen() { this.tone(900, 0.35, 'sine', 0.18, -600); [659, 880].forEach((f, i) => this.tone(f, 0.16, 'triangle', 0.22, 0, 0.25 + i * 0.09)); }
  superTurbo() { [523, 659, 784, 1047, 1319].forEach((f, i) => this.tone(f, 0.16, 'square', 0.18, 0, i * 0.06)); }
  wall() { this.noise(0.08, 0.2); this.tone(140, 0.1, 'triangle', 0.18, 80); }
  click() { this.tone(700, 0.05, 'square', 0.15); }

  // Engine: a looping oscillator whose pitch follows speed.
  startEngine() {
    if (!this.ctx || this.engine) return;
    const o = this.ctx.createOscillator(); o.type = 'sawtooth'; o.frequency.value = 60;
    const o2 = this.ctx.createOscillator(); o2.type = 'square'; o2.frequency.value = 61;
    const f = this.ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 500;
    const g = this.ctx.createGain(); g.gain.value = 0.0;
    o.connect(f); o2.connect(f); f.connect(g); g.connect(this.sfx); o.start(); o2.start();
    this.engine = { o, o2, g, f };
  }
  setTyreScrub(amount) {
    if (!this.ctx) return;
    if (!this.scrub) {
      const buffer=this.ctx.createBuffer(1,this.ctx.sampleRate,this.ctx.sampleRate),data=buffer.getChannelData(0);
      for(let i=0;i<data.length;i++)data[i]=Math.random()*2-1;
      const source=this.ctx.createBufferSource(),filter=this.ctx.createBiquadFilter(),gain=this.ctx.createGain();
      source.buffer=buffer;source.loop=true;filter.type='bandpass';filter.frequency.value=950;filter.Q.value=0.6;gain.gain.value=0;
      source.connect(filter);filter.connect(gain);gain.connect(this.sfx);source.start();this.scrub={gain};
    }
    this.scrub.gain.gain.setTargetAtTime(Math.max(0,amount-0.25)*0.075,this.ctx.currentTime,0.12);
  }
  setEngine(speedRatio, on = true) {
    if (!this.engine) return;
    const t = this.ctx.currentTime;
    const freq = 55 + speedRatio * 140;
    this.engine.o.frequency.setTargetAtTime(freq, t, 0.08);
    this.engine.o2.frequency.setTargetAtTime(freq * 1.01 + 1, t, 0.08);
    this.engine.f.frequency.setTargetAtTime(300 + speedRatio * 900, t, 0.1);
    this.engine.g.gain.setTargetAtTime(on ? 0.05 + speedRatio * 0.06 : 0, t, 0.1);
  }
  stopEngine() { if (this.engine) { this.engine.g.gain.setTargetAtTime(0, this.ctx.currentTime, 0.1); } }

  // Music: a cheerful chiptune loop scheduled ahead of time.
  startMusic(theme = 0) {
    if (!this.ctx) return;
    this.stopMusic();
    const bpm = 150; const beat = 60 / bpm;
    const themes = [
      { lead: [0, 4, 7, 12, 7, 4, 0, 4, 2, 5, 9, 14, 9, 5, 2, 5, 4, 7, 11, 16, 11, 7, 4, 7, 5, 9, 12, 17, 12, 9, 5, 9], bass: [0, 0, 2, 2, 4, 4, 5, 5], root: 261.63 },
      { lead: [0, 3, 7, 10, 7, 3, 0, 3, -2, 2, 5, 10, 5, 2, -2, 2, 0, 3, 7, 12, 7, 3, 0, 3, 5, 8, 12, 15, 12, 8, 5, 8], bass: [0, 0, -2, -2, 0, 0, 5, 5], root: 220 },
      { lead: [0, 2, 4, 7, 9, 7, 4, 2, 0, 2, 4, 7, 12, 9, 7, 4, -3, 0, 2, 4, 7, 4, 2, 0, -3, 0, 4, 7, 9, 7, 4, 0], bass: [0, 0, -3, -3, -5, -5, -3, -3], root: 293.66 },
    ];
    const th = themes[theme % themes.length];
    const n2f = (root, n) => root * Math.pow(2, n / 12);
    let step = 0; let nextTime = this.ctx.currentTime + 0.1;
    const schedule = () => {
      if (!this.music) return;
      while (nextTime < this.ctx.currentTime + 0.4) {
        const i = step % th.lead.length; const t = nextTime;
        // lead
        const o = this.ctx.createOscillator(); o.type = 'square'; o.frequency.value = n2f(th.root, th.lead[i]);
        const g = this.ctx.createGain(); g.gain.setValueAtTime(0.08, t); g.gain.exponentialRampToValueAtTime(0.001, t + beat * 0.45);
        o.connect(g); g.connect(this.musicGain); o.start(t); o.stop(t + beat * 0.5);
        // bass every other step
        if (i % 2 === 0) {
          const b = this.ctx.createOscillator(); b.type = 'triangle'; b.frequency.value = n2f(th.root / 2, th.bass[Math.floor(i / 4) % th.bass.length]);
          const bg = this.ctx.createGain(); bg.gain.setValueAtTime(0.16, t); bg.gain.exponentialRampToValueAtTime(0.001, t + beat * 0.9);
          b.connect(bg); bg.connect(this.musicGain); b.start(t); b.stop(t + beat);
        }
        // kick on beats, hat on offbeats
        if (i % 2 === 0) { const k = this.ctx.createOscillator(); k.frequency.setValueAtTime(150, t); k.frequency.exponentialRampToValueAtTime(40, t + 0.12); const kg = this.ctx.createGain(); kg.gain.setValueAtTime(0.3, t); kg.gain.exponentialRampToValueAtTime(0.001, t + 0.15); k.connect(kg); kg.connect(this.musicGain); k.start(t); k.stop(t + 0.16); }
        else { const buf = this.ctx.createBuffer(1, 2000, this.ctx.sampleRate); const d = buf.getChannelData(0); for (let j = 0; j < d.length; j++) d[j] = (Math.random() * 2 - 1) * (1 - j / d.length); const s = this.ctx.createBufferSource(); s.buffer = buf; const hg = this.ctx.createGain(); hg.gain.value = 0.06; const hf = this.ctx.createBiquadFilter(); hf.type = 'highpass'; hf.frequency.value = 6000; s.connect(hf); hf.connect(hg); hg.connect(this.musicGain); s.start(t); }
        nextTime += beat / 2; step++;
      }
    };
    this.music = { timer: setInterval(schedule, 100) };
    schedule();
  }
  stopMusic() { if (this.music) { clearInterval(this.music.timer); this.music = null; } }
}
