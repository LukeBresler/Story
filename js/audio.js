// Synthesised soundscape: wind, birds by day, crickets by night, rain, and elephant voices.

export class Audio {
  constructor() {
    this.ctx = null;
    this.enabled = true;
    this.nextChirp = 0;
  }

  unlock() {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') this.ctx.resume();
      return;
    }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    this.ctx = new AC();
    this.master = this.ctx.createGain();
    this.master.gain.value = this.enabled ? 0.8 : 0;
    this.master.connect(this.ctx.destination);

    // Looping noise buffer for wind and rain.
    const len = this.ctx.sampleRate * 2;
    const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const data = buf.getChannelData(0);
    let last = 0;
    for (let i = 0; i < len; i++) {
      last = (last + 0.02 * (Math.random() * 2 - 1)) / 1.02;
      data[i] = last * 3.5;
    }
    this.noiseBuf = buf;
    this.wind = this.loop(buf, 400, 0.05);
    const white = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const wd = white.getChannelData(0);
    for (let i = 0; i < len; i++) wd[i] = Math.random() * 2 - 1;
    this.rainNode = this.loop(white, 2500, 0);
  }

  loop(buf, freq, gain) {
    const src = this.ctx.createBufferSource();
    src.buffer = buf;
    src.loop = true;
    const f = this.ctx.createBiquadFilter();
    f.type = 'lowpass';
    f.frequency.value = freq;
    const g = this.ctx.createGain();
    g.gain.value = gain;
    src.connect(f).connect(g).connect(this.master);
    src.start();
    return g;
  }

  suspend() {
    if (this.ctx && this.ctx.state === 'running') this.ctx.suspend();
  }

  setEnabled(on) {
    this.enabled = on;
    if (this.master) this.master.gain.setTargetAtTime(on ? 0.8 : 0, this.ctx.currentTime, 0.2);
  }

  // Called ~once a second with the current conditions.
  ambience({ night, raining }) {
    if (!this.ctx || !this.enabled) return;
    const t = this.ctx.currentTime;
    this.wind.gain.setTargetAtTime(raining ? 0.04 : 0.06, t, 1);
    this.rainNode.gain.setTargetAtTime(raining ? 0.05 : 0, t, 1.5);
    if (t < this.nextChirp) return;
    if (night) {
      this.crickets();
      this.nextChirp = t + 1.5 + Math.random() * 2;
    } else {
      this.bird();
      this.nextChirp = t + 3 + Math.random() * 7;
    }
  }

  bird() {
    const t = this.ctx.currentTime;
    const n = 2 + Math.floor(Math.random() * 4);
    const base = 1800 + Math.random() * 1600;
    for (let i = 0; i < n; i++) {
      const o = this.ctx.createOscillator();
      const g = this.ctx.createGain();
      const st = t + i * 0.14;
      o.type = 'sine';
      o.frequency.setValueAtTime(base, st);
      o.frequency.exponentialRampToValueAtTime(base * (1.3 + Math.random() * 0.4), st + 0.08);
      g.gain.setValueAtTime(0, st);
      g.gain.linearRampToValueAtTime(0.025, st + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, st + 0.12);
      o.connect(g).connect(this.master);
      o.start(st);
      o.stop(st + 0.14);
    }
  }

  crickets() {
    const t = this.ctx.currentTime;
    for (let i = 0; i < 6; i++) {
      const o = this.ctx.createOscillator();
      const g = this.ctx.createGain();
      const st = t + i * 0.07;
      o.frequency.value = 4200 + Math.random() * 300;
      g.gain.setValueAtTime(0, st);
      g.gain.linearRampToValueAtTime(0.01, st + 0.01);
      g.gain.linearRampToValueAtTime(0, st + 0.04);
      o.connect(g).connect(this.master);
      o.start(st);
      o.stop(st + 0.05);
    }
  }

  // A soft, low contact rumble.
  rumble(pitch = 1) {
    if (!this.ctx || !this.enabled) return;
    const t = this.ctx.currentTime;
    const g = this.ctx.createGain();
    const f = this.ctx.createBiquadFilter();
    f.type = 'lowpass';
    f.frequency.value = 380;
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(0.35, t + 0.15);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 1.1);
    [70, 140, 210].forEach((fr, i) => {
      const o = this.ctx.createOscillator();
      o.type = i ? 'triangle' : 'sine';
      o.frequency.setValueAtTime(fr * pitch, t);
      o.frequency.linearRampToValueAtTime(fr * pitch * 0.85, t + 1);
      o.connect(f);
      o.start(t);
      o.stop(t + 1.2);
    });
    f.connect(g).connect(this.master);
  }

  // A trumpet call: brassy sawtooth with a pitch swoop and vibrato.
  trumpet(pitch = 1) {
    if (!this.ctx || !this.enabled) return;
    const t = this.ctx.currentTime;
    const o = this.ctx.createOscillator();
    const o2 = this.ctx.createOscillator();
    const lfo = this.ctx.createOscillator();
    const lfoG = this.ctx.createGain();
    const bp = this.ctx.createBiquadFilter();
    const g = this.ctx.createGain();
    o.type = 'sawtooth';
    o2.type = 'square';
    const f0 = 420 * pitch;
    [o, o2].forEach((x, i) => {
      x.frequency.setValueAtTime(f0 * (i ? 1.005 : 1), t);
      x.frequency.linearRampToValueAtTime(f0 * 1.55, t + 0.18);
      x.frequency.linearRampToValueAtTime(f0 * 1.35, t + 0.7);
      x.frequency.linearRampToValueAtTime(f0 * 1.1, t + 0.95);
    });
    lfo.frequency.value = 22;
    lfoG.gain.value = 18;
    lfo.connect(lfoG);
    lfoG.connect(o.frequency);
    lfoG.connect(o2.frequency);
    bp.type = 'bandpass';
    bp.frequency.value = 1100;
    bp.Q.value = 1.4;
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(0.12, t + 0.06);
    g.gain.setValueAtTime(0.12, t + 0.7);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 1.0);
    o.connect(bp);
    o2.connect(bp);
    bp.connect(g).connect(this.master);
    [o, o2, lfo].forEach((x) => {
      x.start(t);
      x.stop(t + 1.05);
    });
  }

  alarm() {
    if (!this.ctx || !this.enabled) return;
    const t = this.ctx.currentTime;
    [0, 0.22].forEach((d) => {
      const o = this.ctx.createOscillator();
      const g = this.ctx.createGain();
      o.type = 'triangle';
      o.frequency.setValueAtTime(660, t + d);
      o.frequency.linearRampToValueAtTime(520, t + d + 0.18);
      g.gain.setValueAtTime(0.0001, t + d);
      g.gain.linearRampToValueAtTime(0.08, t + d + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, t + d + 0.2);
      o.connect(g).connect(this.master);
      o.start(t + d);
      o.stop(t + d + 0.22);
    });
  }

  chime() {
    if (!this.ctx || !this.enabled) return;
    const t = this.ctx.currentTime;
    [523, 659, 784, 1046].forEach((fr, i) => {
      const o = this.ctx.createOscillator();
      const g = this.ctx.createGain();
      o.type = 'sine';
      o.frequency.value = fr;
      const st = t + i * 0.09;
      g.gain.setValueAtTime(0.0001, st);
      g.gain.linearRampToValueAtTime(0.06, st + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, st + 0.9);
      o.connect(g).connect(this.master);
      o.start(st);
      o.stop(st + 1);
    });
  }

  tap() {
    if (!this.ctx || !this.enabled) return;
    const t = this.ctx.currentTime;
    const o = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    o.frequency.setValueAtTime(880, t);
    o.frequency.exponentialRampToValueAtTime(440, t + 0.06);
    g.gain.setValueAtTime(0.04, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.08);
    o.connect(g).connect(this.master);
    o.start(t);
    o.stop(t + 0.1);
  }
}
