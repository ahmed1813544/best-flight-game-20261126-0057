// Kestrel Run — audio.js: every sound is synthesised with WebAudio, no audio files.
// Engine hum, wind, ring chime, parcel thump, landing bump and the finish fanfare.
export class SoundBank {
  constructor() {
    this.ctx = null;
    this.muted = false;
    this.engineOsc = null;
    this.engineGain = null;
    this.windGain = null;
  }
  ensure() {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') this.ctx.resume();
      return;
    }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    this.ctx = new AC();
    // Engine: two detuned saws through a low-pass, pitch follows throttle.
    this.engineOsc = this.ctx.createOscillator();
    this.engineOsc.type = 'sawtooth';
    this.engineOsc.frequency.value = 55;
    const engineOsc2 = this.ctx.createOscillator();
    engineOsc2.type = 'sawtooth';
    engineOsc2.frequency.value = 55.7;
    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 420;
    this.engineGain = this.ctx.createGain();
    this.engineGain.gain.value = 0;
    this.engineOsc.connect(filter);
    engineOsc2.connect(filter);
    filter.connect(this.engineGain);
    this.engineGain.connect(this.ctx.destination);
    this.engineOsc.start();
    engineOsc2.start();
    // Wind: looped noise buffer through a band-pass.
    const len = this.ctx.sampleRate * 2;
    const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
    const noise = this.ctx.createBufferSource();
    noise.buffer = buf;
    noise.loop = true;
    const band = this.ctx.createBiquadFilter();
    band.type = 'bandpass';
    band.frequency.value = 600;
    band.Q.value = 0.6;
    this.windGain = this.ctx.createGain();
    this.windGain.gain.value = 0;
    noise.connect(band);
    band.connect(this.windGain);
    this.windGain.connect(this.ctx.destination);
    noise.start();
  }
  setMuted(m) {
    this.muted = m;
    if (this.ctx) this.ctx.destination.gain.value = m ? 0 : 1;
  }
  engine(throttle, speed, airborne) {
    if (!this.ctx || !this.engineOsc) return;
    const t = this.ctx.currentTime;
    const freq = 42 + throttle * 70 + speed * 0.4;
    this.engineOsc.frequency.setTargetAtTime(freq, t, 0.1);
    const vol = airborne ? 0.05 + throttle * 0.06 : 0.04 + throttle * 0.05;
    this.engineGain.gain.setTargetAtTime(this.muted ? 0 : vol, t, 0.15);
    this.windGain.gain.setTargetAtTime(this.muted ? 0 : Math.min(0.09, speed * 0.0016), t, 0.2);
  }
  blip(freq, dur, type = 'sine', vol = 0.16, when = 0) {
    if (!this.ctx || this.muted) return;
    const t = this.ctx.currentTime + when;
    const o = this.ctx.createOscillator();
    o.type = type;
    o.frequency.value = freq;
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    o.connect(g);
    g.connect(this.ctx.destination);
    o.start(t);
    o.stop(t + dur + 0.02);
  }
  chime() { this.blip(880, 0.35); this.blip(1318, 0.5, 'sine', 0.14, 0.09); }
  thump() { this.blip(70, 0.3, 'sine', 0.3); this.blip(140, 0.15, 'triangle', 0.12); }
  fanfare() {
    [523, 659, 784, 1046].forEach((f, i) => this.blip(f, 0.4, 'triangle', 0.16, i * 0.13));
  }
  fail() {
    [330, 262, 196].forEach((f, i) => this.blip(f, 0.4, 'sawtooth', 0.1, i * 0.18));
  }
}
