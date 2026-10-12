import { describe, it, expect } from 'vitest';
import { bikes } from '../data/bikes';
import { soundProfile, EXHAUST_VOICE } from './profile';
import { WORKLET_SRC } from './worklet';

// Runs the AudioWorklet code in Node with minimal stubs, so the generator itself can be tested.
const SR = 48000;
function makeProc(opts: object) {
  let Ctor: any;
  class AudioWorkletProcessor {}
  const registerProcessor = (_: string, c: any) => { Ctor = c; };
  new Function('AudioWorkletProcessor', 'registerProcessor', 'sampleRate', WORKLET_SRC)(AudioWorkletProcessor, registerProcessor, SR);
  return new Ctor({ processorOptions: opts });
}
function optsFor(p: ReturnType<typeof soundProfile>) {
  const v = EXHAUST_VOICE[p.exhaust];
  return { ...p, voice: { ...v, lowpassHz: v.lowpassHz * p.mufflerScale, bodyHz: 1 / (4 * p.pipes.linkS) }, intakeLvl: 0.18, outGain: 1 };
}
function run(proc: any, seconds: number, rpm: number, load: number, crackle = 0) {
  const out = new Float32Array(Math.round(seconds * SR));
  const block = [new Float32Array(128)];
  for (let i = 0; i + 128 <= out.length; i += 128) {
    proc.process([], [block], { rpm: [rpm], load: [load], crackle: [crackle] });
    out.set(block[0], i);
  }
  return out;
}

describe('engine sound generator', () => {
  it('fires each cylinder at its real crank angle (exact firing order, every bike)', () => {
    for (const b of bikes) {
      const p = soundProfile(b, []);
      const proc = makeProc(optsFor(p));
      const rpm = 6000, events: number[] = [];
      // Log the crank angle whenever a new exhaust event starts (amp gets set).
      const amp = new Proxy(proc.amp, { set(t, k, v) { t[k as any] = v; events.push(proc.ang); return true; } });
      proc.amp = amp;
      run(proc, 0.2, rpm, 1);
      const gaps = events.slice(1).map((a, i) => ((a - events[i]) + 720) % 720);
      const f = b.engine.firingDeg;
      const expected = f.map((d, i) => (i + 1 < f.length ? f[i + 1] : f[0] + 720) - d);
      const step = (rpm * 6) / SR; // one sample of crank rotation
      expect(gaps.length, b.id).toBeGreaterThan(3 * f.length);
      for (let i = f.length; i < gaps.length; i++) {
        const want = expected[(i + offset(gaps, expected)) % expected.length];
        expect(Math.abs(gaps[i] - want), `${b.id} gap ${i}`).toBeLessThanOrEqual(step + 1e-9);
      }
    }
  }, 20000);

  it('stays finite and bounded for every bike at idle, full load and on the limiter, with crackle', () => {
    for (const b of bikes) {
      const p = soundProfile(b, []);
      const proc = makeProc({ ...optsFor(p), outGain: 1 });
      for (const [rpm, load, cr] of [[p.idleRpm, 0.1, 0], [p.redlineRpm * 0.9, 1, 0], [p.redlineRpm, 1, 0], [p.redlineRpm * 0.6, 0, 1]]) {
        const x = run(proc, 0.2, rpm, load, cr);
        let peak = 0, sum = 0, finite = true;
        for (const v of x) { if (!Number.isFinite(v)) finite = false; peak = Math.max(peak, Math.abs(v)); sum += v * v; }
        expect(finite, b.id).toBe(true);
        expect(peak, b.id).toBeLessThanOrEqual(0.7 + 1e-6);
        const rms = Math.sqrt(sum / x.length);
        expect(rms, `${b.id} silent at ${rpm} rpm`).toBeGreaterThan(1e-4);
      }
    }
  }, 20000); // renders ~10 s of audio in total; CI runners are slower
});

/** Rotation of the expected gap list that best matches the measured sequence. */
function offset(gaps: number[], expected: number[]) {
  let best = 0, bestErr = Infinity;
  for (let k = 0; k < expected.length; k++) {
    const err = gaps.reduce((s, g, i) => s + Math.abs(g - expected[(i + k) % expected.length]), 0);
    if (err < bestErr) { bestErr = err; best = k; }
  }
  return best;
}
