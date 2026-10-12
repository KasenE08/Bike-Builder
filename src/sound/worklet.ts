// AudioWorklet source (loaded from a Blob URL). Generates exhaust pulses at each cylinder's firing angle.
export const WORKLET_SRC = `
const TAU = Math.PI * 2;
class EngineProc extends AudioWorkletProcessor {
  static get parameterDescriptors() {
    return [
      { name: 'rpm', defaultValue: 1200, minValue: 0, maxValue: 25000, automationRate: 'k-rate' },
      { name: 'load', defaultValue: 0, minValue: 0, maxValue: 1, automationRate: 'k-rate' },
      { name: 'crackle', defaultValue: 0, minValue: 0, maxValue: 1, automationRate: 'k-rate' },
    ];
  }
  constructor(o) {
    super();
    const p = o.processorOptions;
    this.f = p.firingDeg; this.hz = p.pulseHz; this.decay = p.decayS; this.red = p.redlineRpm;
    this.ang = 0; this.pulses = []; this.seed = 987654321;
  }
  rand() { this.seed = (Math.imul(this.seed, 1664525) + 1013904223) >>> 0; return this.seed / 4294967296; }
  process(_in, outs, params) {
    const ch = outs[0], out = ch[0], n = out.length, dt = 1 / sampleRate;
    const rpm = params.rpm[0], load = params.load[0], crackle = params.crackle[0];
    const dDeg = (rpm * 6) / sampleRate;
    const atLimit = rpm >= this.red * 0.99;
    const norm = 0.5 / Math.sqrt(this.f.length);
    for (let i = 0; i < n; i++) {
      const prev = this.ang; let a = prev + dDeg; let wrapped = false;
      if (a >= 720) { a -= 720; wrapped = true; }
      this.ang = a;
      for (let k = 0; k < this.f.length; k++) {
        const fd = this.f[k];
        const crossed = wrapped ? (fd > prev || fd <= a) : (fd > prev && fd <= a);
        if (!crossed) continue;
        if (atLimit && this.rand() < 0.55) continue; // rev-limiter cut
        if (this.pulses.length < 24) this.pulses.push({ t: 0, d: this.decay, amp: (0.45 + 0.55 * load) * (0.9 + 0.2 * this.rand()), f: this.hz * (0.96 + 0.08 * this.rand()), ph: this.rand() * TAU, noise: 0.12 });
      }
      if (crackle > 0 && this.rand() < 26 * dt * crackle && this.pulses.length < 24) {
        this.pulses.push({ t: 0, d: 0.006 + 0.01 * this.rand(), amp: 1.1 * crackle, f: 700 + 1600 * this.rand(), ph: 0, noise: 1.2 });
      }
      let s = 0;
      for (let k = this.pulses.length - 1; k >= 0; k--) {
        const p = this.pulses[k];
        const env = Math.exp(-p.t / p.d);
        if (env < 0.002) { this.pulses.splice(k, 1); continue; }
        s += p.amp * env * (Math.sin(TAU * p.f * p.t) + 0.5 * Math.sin(TAU * p.f * 2 * p.t + p.ph) + 0.25 * Math.sin(TAU * p.f * 3.1 * p.t));
        s += p.amp * p.noise * Math.exp(-p.t / (p.d * 0.4)) * (this.rand() * 2 - 1);
        p.t += dt;
      }
      out[i] = s * norm;
    }
    for (let c = 1; c < ch.length; c++) ch[c].set(out);
    return true;
  }
}
registerProcessor('engine-proc', EngineProc);
`;
