// AudioWorklet source (loaded from a Blob URL). Physically informed exhaust model:
// each cylinder's blowdown pulse (shaped in crank degrees, so it shortens as rpm rises) travels down its own
// header pipe (waveguide with reflections), merges in the bike's real collector layout (2-1, 3-1, 4-1, 4-2-1),
// runs through the link pipe into the muffler, and radiates from the outlet. Intake pulses ring the airbox.
// No fixed-pitch ringing anywhere: every resonance is a short pipe or a low-Q filter, so nothing "dings".
export const WORKLET_SRC = `
const EVO = 130, DUR = 200;      // exhaust valve opens ~50 deg before BDC; blowdown + displacement over ~200 deg (est.)
const IVO = 340, IDUR = 260;     // intake opens ~20 deg before overlap TDC
const CRACK = 2.5;              // sharp blowdown front (time-based, ~0.5 ms), excites the pipe resonances
const A_SH = 0.8, B_SH = 4;      // blowdown shape: fast rise, slow fall
const SH_MAX = Math.pow(A_SH / (A_SH + B_SH), A_SH) * Math.pow(B_SH / (A_SH + B_SH), B_SH);
const shape = (x) => Math.pow(x, A_SH) * Math.pow(1 - x, B_SH) / SH_MAX;

class Delay {
  constructor(n) { this.n = Math.max(2, n + 1); this.b = new Float32Array(this.n); this.i = 0; }
  push(x) { this.b[this.i] = x; this.i = (this.i + 1) % this.n; }
  read(d) { let j = this.i - 1 - d; if (j < 0) j += this.n; return this.b[j]; } // d=0: last pushed
}
// Pipe as two delay lines (forward/backward waves). Reflections at both ends; loss lowpass on the far-end reflection.
class Pipe {
  constructor(sec, rStart, rEnd, loss) {
    this.D = Math.max(1, Math.round(sec * sampleRate));
    this.fwd = new Delay(this.D); this.back = new Delay(this.D);
    this.rs = rStart; this.re = rEnd; this.la = loss; this.lp = 0;
  }
  step(x) {
    const atStart = this.back.read(this.D - 1), atEnd = this.fwd.read(this.D - 1);
    this.lp += this.la * (atEnd - this.lp);
    this.back.push(this.re * this.lp);
    this.fwd.push(x + this.rs * atStart);
    return (1 + this.re) * atEnd;
  }
}
class Biquad {
  constructor(type, f, q, gainDb) {
    const w = 2 * Math.PI * Math.min(f, sampleRate * 0.45) / sampleRate, cs = Math.cos(w), al = Math.sin(w) / (2 * q);
    let b0, b1, b2, a0, a1, a2;
    if (type === 'lp') { b0 = (1 - cs) / 2; b1 = 1 - cs; b2 = b0; a0 = 1 + al; a1 = -2 * cs; a2 = 1 - al; }
    else if (type === 'bp') { b0 = al; b1 = 0; b2 = -al; a0 = 1 + al; a1 = -2 * cs; a2 = 1 - al; }
    else { const A = Math.pow(10, gainDb / 40); b0 = 1 + al * A; b1 = -2 * cs; b2 = 1 - al * A; a0 = 1 + al / A; a1 = -2 * cs; a2 = 1 - al / A; }
    this.b0 = b0 / a0; this.b1 = b1 / a0; this.b2 = b2 / a0; this.a1 = a1 / a0; this.a2 = a2 / a0;
    this.x1 = this.x2 = this.y1 = this.y2 = 0;
  }
  step(x) {
    const y = this.b0 * x + this.b1 * this.x1 + this.b2 * this.x2 - this.a1 * this.y1 - this.a2 * this.y2;
    this.x2 = this.x1; this.x1 = x; this.y2 = this.y1; this.y1 = y; return y;
  }
}
class DcBlock { constructor() { this.x1 = 0; this.y1 = 0; } step(x) { const y = x - this.x1 + 0.995 * this.y1; this.x1 = x; this.y1 = y; return y; } }

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
    const p = o.processorOptions, v = p.voice, P = p.pipes;
    this.f = p.firingDeg; this.red = p.redlineRpm; this.n = this.f.length;
    this.size = Math.sqrt(p.ccPerCyl / 250);
    this.ang = 0; this.seed = 987654321;
    this.prev = this.f.map(() => 719); this.amp = this.f.map(() => 0); this.off = this.f.map(() => 0); this.crack = this.f.map(() => 0); this.crackR = this.f.map(() => 0);
    // Blowdown front: gas at several bar escaping past the opening valve. Rises over ~0.1 ms and falls over ~0.4 ms
    // (difference of two exponentials: starts at zero, so no one-sample click).
    this.crackDecay = Math.exp(-1 / (0.0004 * sampleRate)); this.crackRise = Math.exp(-1 / (0.0001 * sampleRate));
    this.iprev = this.f.map(() => 719); this.iamp = this.f.map(() => 0);
    this.headers = this.f.map(() => new Pipe(P.headerS, 0.7, -0.5, 0.55));
    this.groups = P.groups && P.groups.length ? P.groups : null;
    this.secondaries = this.groups ? this.groups.map(() => new Pipe(P.secondaryS, -0.3, -0.45, 0.6)) : [];
    this.groupOf = this.f.map((_, k) => (this.groups ? this.groups.findIndex((g) => g.indexOf(k) >= 0) : -1));
    this.sec = new Float64Array(this.groups ? this.groups.length : 0); // preallocated: no garbage in the audio thread
    this.link = new Pipe(P.linkS, -0.3, v.reflect, v.loss);
    this.dc1 = new DcBlock(); this.dc2 = new DcBlock();
    this.body = new Biquad('peak', v.bodyHz, 1.0, v.bodyDb);
    this.muff = new Biquad('lp', v.lowpassHz, 0.7);
    this.drive = v.drive; this.driveNorm = Math.tanh(v.drive);
    this.runner = new Pipe(p.runnerS, 0.7, -0.7, 0.5);
    this.airbox = new Biquad('bp', p.airboxHz, 1.2); this.airLp = new Biquad('lp', 2600, 0.7);
    this.intakeLvl = p.intakeLvl; this.ramAir = p.ramAir;
    this.pop = 0; this.popEnv = 0; this.popDecay = 0;
    this.radPrev = 0;
    this.outGain = p.outGain;
  }
  rand() { this.seed = (Math.imul(this.seed, 1664525) + 1013904223) >>> 0; return this.seed / 4294967296; }
  process(_in, outs, params) {
    const ch = outs[0], out = ch[0], len = out.length;
    const rpm = params.rpm[0], load = params.load[0], crackle = params.crackle[0];
    const dDeg = (rpm * 6) / sampleRate;
    const cut = rpm >= this.red * 0.995; // rev limiter: ignition cut
    const r = Math.min(1, rpm / this.red);
    const evRate = (rpm / 120) * this.n; // exhaust events per second
    const popP = crackle > 0 ? Math.min(0.9, (24 * crackle) / Math.max(1, evRate)) : 0;
    const flow = 0.4 * (0.2 + 0.8 * load) * (0.3 + 0.7 * r); // turbulent flow noise grows with gas speed (throttle x rpm)
    const jit = 0.12 - 0.08 * load, tJit = 3 - 2.5 * load; // cycle-to-cycle variation, larger when lightly loaded
    // Keep idle clearly audible on a phone speaker: lift low rpm (real bikes span ~25 dB idle to redline; this keeps ~15).
    const lift = 1 / Math.sqrt(Math.max(0.12, r));
    const intakeGain = this.intakeLvl * (0.25 + 0.75 * load) * (this.ramAir ? 1 + 1.5 * r * r : 1);
    for (let i = 0; i < len; i++) {
      let a = this.ang + dDeg; if (a >= 720) a -= 720; this.ang = a;
      let coll = 0, intake = 0;
      const sec = this.sec; sec.fill(0);
      for (let k = 0; k < this.n; k++) {
        // Exhaust blowdown for cylinder k.
        let psi = a - this.f[k] - EVO; psi -= 720 * Math.floor(psi / 720);
        if (psi < this.prev[k]) { // new exhaust event
          const fire = !cut;
          this.amp[k] = this.size * (fire ? (0.3 + 0.7 * load) * (1 + jit * (this.rand() * 2 - 1)) : 0.06);
          this.off[k] = this.rand() * tJit;
          if ((popP > 0 && this.rand() < popP) || (cut && crackle === 0 && this.rand() < 0.04)) {
            this.pop = (0.6 + this.rand()) * (crackle > 0 ? crackle : 0.3) * this.size * 1.6;
            this.popEnv = 1; this.popDecay = Math.exp(-1 / ((0.0015 + 0.0035 * this.rand()) * sampleRate));
          }
        }
        this.prev[k] = psi;
        let src = 0;
        const x = (psi - this.off[k]) / DUR;
        if (x > 0 && x < 1) {
          if (this.crack[k] === 0 && x * DUR < dDeg * 1.5) { this.crack[k] = this.amp[k] * CRACK; this.crackR[k] = this.crack[k]; }
          src = this.amp[k] * shape(x) * (1 + flow * (this.rand() * 2 - 1));
        }
        if (this.crack[k] !== 0) {
          src += this.crack[k] - this.crackR[k];
          this.crack[k] *= this.crackDecay; this.crackR[k] *= this.crackRise;
          if (Math.abs(this.crack[k]) < 1e-4) this.crack[k] = this.crackR[k] = 0;
        }
        const h = this.headers[k].step(src);
        if (this.groupOf[k] >= 0) sec[this.groupOf[k]] += h; else coll += h;
        // Intake suction pulse.
        let ipsi = a - this.f[k] - IVO; ipsi -= 720 * Math.floor(ipsi / 720);
        if (ipsi < this.iprev[k]) this.iamp[k] = this.size * (0.3 + 0.7 * load);
        this.iprev[k] = ipsi;
        if (ipsi < IDUR) intake -= this.iamp[k] * shape(ipsi / IDUR);
      }
      for (let g = 0; g < sec.length; g++) coll += this.secondaries[g].step(sec[g]);
      // Afterfire pops: broadband bursts in the collector, shaped by the pipes and muffler (no tones).
      if (this.popEnv > 0.001) { coll += this.pop * this.popEnv * (this.rand() * 2 - 1); this.popEnv *= this.popDecay; }
      let y = this.link.step(this.dc1.step(coll));
      y = this.body.step(y);
      y = this.muff.step(y);
      y = Math.tanh(y * this.drive) / this.driveNorm;
      const ia = this.airLp.step(this.airbox.step(this.runner.step(intake)) + 0.15 * intake);
      const mouth = y + intakeGain * ia; // exhaust outlet + intake mouth
      const rad = mouth - 0.97 * this.radPrev; this.radPrev = mouth; // both radiate as monopoles: pressure ~ d/dt of the flow
      const o = this.dc2.step(rad) * this.outGain * lift;
      out[i] = 0.7 * Math.tanh(o / 0.7); // round off the sharpest blowdown spikes so the output stage doesn't pump
    }
    for (let c = 1; c < ch.length; c++) ch[c].set(out);
    return true;
  }
}
registerProcessor('engine-proc', EngineProc);
`;
