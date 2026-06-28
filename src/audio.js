// Procedural audio — no external files. WebAudio synthesis.
class AudioEngine {
  constructor() {
    this.ctx = null;
    this.master = null;
    this.muted = false;
    this.musicGain = null;
    this._musicTimer = null;
  }

  init() {
    if (this.ctx) return;
    const AC = window.AudioContext || window.webkitAudioContext;
    this.ctx = new AC();
    this.master = this.ctx.createGain();
    this.master.gain.value = 0.6;
    this.master.connect(this.ctx.destination);

    this.musicGain = this.ctx.createGain();
    this.musicGain.gain.value = 0.18;
    this.musicGain.connect(this.master);
  }

  resume() {
    if (this.ctx && this.ctx.state === "suspended") this.ctx.resume();
  }

  _env(node, gain, attack, decay, peak = 1) {
    const t = this.ctx.currentTime;
    node.gain.cancelScheduledValues(t);
    node.gain.setValueAtTime(0.0001, t);
    node.gain.exponentialRampToValueAtTime(peak * gain, t + attack);
    node.gain.exponentialRampToValueAtTime(0.0001, t + attack + decay);
  }

  tone(freq, { type = "sine", gain = 0.3, attack = 0.005, decay = 0.15, dest = null, detune = 0 } = {}) {
    if (!this.ctx || this.muted) return;
    const osc = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    osc.type = type;
    osc.frequency.value = freq;
    osc.detune.value = detune;
    osc.connect(g);
    g.connect(dest || this.master);
    this._env(g, gain, attack, decay);
    osc.start();
    osc.stop(this.ctx.currentTime + attack + decay + 0.05);
  }

  noise({ gain = 0.3, decay = 0.2, type = "highpass", freq = 800 } = {}) {
    if (!this.ctx || this.muted) return;
    const len = Math.floor(this.ctx.sampleRate * (decay + 0.05));
    const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
    const src = this.ctx.createBufferSource();
    src.buffer = buf;
    const filt = this.ctx.createBiquadFilter();
    filt.type = type;
    filt.frequency.value = freq;
    const g = this.ctx.createGain();
    src.connect(filt); filt.connect(g); g.connect(this.master);
    this._env(g, gain, 0.005, decay);
    src.start();
    src.stop(this.ctx.currentTime + decay + 0.1);
  }

  // ---- SFX ----
  smite() {
    this.tone(420, { type: "triangle", gain: 0.25, decay: 0.12 });
    this.noise({ gain: 0.18, decay: 0.12, type: "highpass", freq: 1200 });
  }
  hit(crit = false) {
    this.tone(crit ? 880 : 660, { type: "square", gain: 0.18, decay: 0.08 });
    this.noise({ gain: 0.12, decay: 0.06, type: "bandpass", freq: 2000 });
  }
  nova() {
    if (!this.ctx || this.muted) return;
    const base = 300;
    [0, 0.05, 0.1].forEach((d, i) => {
      setTimeout(() => {
        this.tone(base + i * 180, { type: "sine", gain: 0.3, attack: 0.01, decay: 0.5 });
        this.tone((base + i * 180) * 1.5, { type: "triangle", gain: 0.15, decay: 0.45 });
      }, d * 1000);
    });
    this.noise({ gain: 0.2, decay: 0.4, type: "highpass", freq: 600 });
  }
  consecrate() {
    this.tone(220, { type: "sine", gain: 0.25, decay: 0.6 });
    this.tone(330, { type: "sine", gain: 0.18, decay: 0.6, detune: 4 });
  }
  dash() {
    this.tone(520, { type: "sawtooth", gain: 0.15, attack: 0.01, decay: 0.18 });
    this.noise({ gain: 0.14, decay: 0.18, type: "highpass", freq: 1800 });
  }
  enemyDie() {
    this.tone(180, { type: "sawtooth", gain: 0.2, decay: 0.25 });
    this.noise({ gain: 0.16, decay: 0.22, type: "lowpass", freq: 700 });
  }
  playerHurt() {
    this.tone(140, { type: "square", gain: 0.3, decay: 0.25 });
    this.noise({ gain: 0.2, decay: 0.2, type: "lowpass", freq: 400 });
  }
  levelUp() {
    [523, 659, 784, 1047].forEach((f, i) =>
      setTimeout(() => this.tone(f, { type: "triangle", gain: 0.3, decay: 0.3 }), i * 90)
    );
  }
  waveStart() {
    [392, 523, 659].forEach((f, i) =>
      setTimeout(() => this.tone(f, { type: "sawtooth", gain: 0.22, decay: 0.25 }), i * 110)
    );
  }
  gameOver() {
    [440, 392, 330, 262].forEach((f, i) =>
      setTimeout(() => this.tone(f, { type: "triangle", gain: 0.3, decay: 0.5 }), i * 200)
    );
  }
  pickup() {
    this.tone(880, { type: "sine", gain: 0.15, decay: 0.1 });
    this.tone(1320, { type: "sine", gain: 0.1, decay: 0.1 });
  }

  // ---- Ambient music: slow ominous drone with arpeggio ----
  startMusic() {
    if (!this.ctx || this.muted || this._musicTimer) return;
    const root = 110; // A2
    const scale = [0, 3, 5, 7, 10]; // minor pentatonic
    let step = 0;
    const drone = this.ctx.createOscillator();
    const dg = this.ctx.createGain();
    drone.type = "sawtooth";
    drone.frequency.value = root / 2;
    dg.gain.value = 0.05;
    const filt = this.ctx.createBiquadFilter();
    filt.type = "lowpass";
    filt.frequency.value = 400;
    drone.connect(filt); filt.connect(dg); dg.connect(this.musicGain);
    drone.start();
    this._drone = drone;

    this._musicTimer = setInterval(() => {
      if (this.muted) return;
      const note = scale[step % scale.length];
      const oct = step % 8 < 4 ? 1 : 2;
      const f = root * oct * Math.pow(2, note / 12);
      this.tone(f, { type: "triangle", gain: 0.06, attack: 0.02, decay: 0.7, dest: this.musicGain });
      if (step % 4 === 0) this.tone(f * 1.5, { type: "sine", gain: 0.04, decay: 0.9, dest: this.musicGain });
      step++;
    }, 420);
  }

  stopMusic() {
    if (this._musicTimer) { clearInterval(this._musicTimer); this._musicTimer = null; }
    if (this._drone) { try { this._drone.stop(); } catch (e) {} this._drone = null; }
  }

  toggleMute() {
    this.muted = !this.muted;
    if (this.master) this.master.gain.value = this.muted ? 0 : 0.6;
    return this.muted;
  }
}

export const audio = new AudioEngine();
