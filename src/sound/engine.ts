// Web Audio graph for the generated engine sound. Works with a live AudioContext or an OfflineAudioContext.
import { EXHAUST_VOICE, type SoundProfile } from './profile';
import { WORKLET_SRC } from './worklet';

let moduleUrl: string | null = null;
const workletUrl = () => (moduleUrl ??= URL.createObjectURL(new Blob([WORKLET_SRC], { type: 'text/javascript' })));

/** Free-revving rpm model: approach redline when on throttle, fall back to idle when off. */
export interface RevState { rpm: number; load: number; boost: number; wasOn: boolean; }
export function stepRev(s: RevState, on: boolean, dt: number, p: SoundProfile): { crackleStart: boolean; blowOff: number } {
  const span = p.redlineRpm - p.idleRpm;
  if (on) s.rpm += Math.max(span * 0.35, (p.redlineRpm * 1.03 - s.rpm) * 2.6) * dt / p.revUpS;
  else s.rpm += (p.idleRpm - s.rpm) * dt * 1.9;
  if (s.rpm > p.redlineRpm) s.rpm = p.redlineRpm - Math.random() * 120; // bounce on the limiter
  if (s.rpm < p.idleRpm * 0.97) s.rpm = p.idleRpm;
  s.load += ((on ? 1 : 0) - s.load) * Math.min(1, dt * (on ? 18 : 10));
  const spool = Math.max(0, Math.min(1, (s.rpm - 0.4 * p.redlineRpm) / (0.4 * p.redlineRpm)));
  const target = p.fi === 'turbo' ? (on ? spool : 0) : 0;
  s.boost += (target - s.boost) * Math.min(1, dt * (target > s.boost ? 1.8 : 6));
  const released = s.wasOn && !on;
  s.wasOn = on;
  return { crackleStart: released && s.rpm > 0.55 * p.redlineRpm, blowOff: released ? s.boost : 0 };
}

function noiseBuffer(ctx: BaseAudioContext, seconds: number) {
  const b = ctx.createBuffer(1, Math.floor(ctx.sampleRate * seconds), ctx.sampleRate);
  const d = b.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  return b;
}

export interface Voice {
  apply(t: number, s: RevState, events: { crackleStart: boolean; blowOff: number }): void;
  stop(t: number): void;
}

export async function buildVoice(ctx: BaseAudioContext, p: SoundProfile, out: AudioNode): Promise<Voice> {
  await ctx.audioWorklet.addModule(workletUrl());
  const v = EXHAUST_VOICE[p.exhaust];
  const crackleAmt = p.exhaust === 'stock' ? (p.tuned ? 0.15 : 0) : Math.min(1, v.crackle + (p.tuned ? 0.25 : 0));
  const node = new AudioWorkletNode(ctx, 'engine-proc', { numberOfInputs: 0, outputChannelCount: [1], processorOptions: p });
  const shaper = ctx.createWaveShaper();
  const curve = new Float32Array(1024);
  for (let i = 0; i < curve.length; i++) { const x = (i / 511.5) - 1; curve[i] = Math.tanh(x * v.drive) / Math.tanh(v.drive); }
  shaper.curve = curve;
  const body = ctx.createBiquadFilter(); body.type = 'peaking'; body.frequency.value = p.pulseHz * 1.6; body.Q.value = 1.1; body.gain.value = v.bodyDb;
  const muffler = ctx.createBiquadFilter(); muffler.type = 'lowpass'; muffler.frequency.value = v.lowpassHz; muffler.Q.value = 0.7;
  const exGain = ctx.createGain(); exGain.gain.value = v.gain;
  node.connect(shaper).connect(body).connect(muffler).connect(exGain).connect(out);

  // Induction noise (louder with an intake mod).
  const intake = ctx.createBufferSource(); intake.buffer = noiseBuffer(ctx, 2); intake.loop = true;
  const intakeBp = ctx.createBiquadFilter(); intakeBp.type = 'bandpass'; intakeBp.Q.value = 0.9;
  const intakeGain = ctx.createGain(); intakeGain.gain.value = 0;
  intake.connect(intakeBp).connect(intakeGain).connect(out); intake.start();

  // Supercharger whine / turbo whistle.
  const whine = ctx.createOscillator(); whine.type = 'triangle';
  const whineGain = ctx.createGain(); whineGain.gain.value = 0;
  whine.connect(whineGain).connect(out); whine.start();
  const bov = noiseBuffer(ctx, 0.6);

  const rpm = node.parameters.get('rpm')!, load = node.parameters.get('load')!, crackle = node.parameters.get('crackle')!;
  let crackleUntil = -1;
  return {
    apply(t, s, ev) {
      const r = s.rpm / p.redlineRpm;
      rpm.setValueAtTime(s.rpm, t);
      load.setValueAtTime(s.load, t);
      if (ev.crackleStart && crackleAmt > 0) crackleUntil = t + 0.9;
      crackle.setValueAtTime(t < crackleUntil ? crackleAmt * (crackleUntil - t) / 0.9 : 0, t);
      intakeBp.frequency.setValueAtTime(300 + 2200 * r, t);
      intakeGain.gain.setValueAtTime((p.intakeMod ? 0.05 : 0.02) * s.load * (0.3 + r), t);
      if (p.fi === 'supercharger') {
        whine.frequency.setValueAtTime((s.rpm / 60) * p.scRatio * 0.25, t);
        whineGain.gain.setValueAtTime(0.05 * r * r * (0.4 + 0.6 * s.load), t);
      } else if (p.fi === 'turbo') {
        whine.frequency.setValueAtTime(1800 + 5200 * s.boost, t);
        whineGain.gain.setValueAtTime(0.035 * s.boost, t);
        if (ev.blowOff > 0.3) {
          const src = ctx.createBufferSource(); src.buffer = bov;
          const hp = ctx.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 1400;
          const g = ctx.createGain();
          g.gain.setValueAtTime(0.32 * ev.blowOff, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.45);
          src.connect(hp).connect(g).connect(out); src.start(t); src.stop(t + 0.5);
        }
      }
    },
    stop(t) { intake.stop(t); whine.stop(t); node.disconnect(); },
  };
}

/** Live engine for the phone: idles until stopped; rev with setThrottle(). */
export class EngineSound {
  private ctx: AudioContext | null = null;
  private voice: Voice | null = null;
  private state: RevState = { rpm: 0, load: 0, boost: 0, wasOn: false };
  private on = false;
  private raf = 0;
  private last = 0;
  constructor(private p: SoundProfile, private onRpm: (rpm: number) => void) {}

  async start() {
    if (this.ctx) return;
    const nav = navigator as Navigator & { audioSession?: { type: string } };
    if (nav.audioSession) nav.audioSession.type = 'playback'; // play even with the iPhone silent switch on
    const ctx = new AudioContext({ latencyHint: 'interactive' });
    this.ctx = ctx;
    await ctx.resume();
    const master = ctx.createGain(); master.gain.value = 0;
    const comp = ctx.createDynamicsCompressor(); comp.threshold.value = -14; comp.ratio.value = 4;
    master.connect(comp).connect(ctx.destination);
    master.gain.setTargetAtTime(0.9, ctx.currentTime, 0.15);
    this.voice = await buildVoice(ctx, this.p, master);
    this.state = { rpm: this.p.idleRpm, load: 0, boost: 0, wasOn: false };
    this.last = performance.now();
    const tick = (now: number) => {
      const dt = Math.min(0.05, (now - this.last) / 1000); this.last = now;
      const ev = stepRev(this.state, this.on, dt, this.p);
      this.state.rpm += this.on ? 0 : (Math.random() - 0.5) * 6; // idle wobble
      this.voice?.apply(ctx.currentTime + 0.01, this.state, ev);
      this.onRpm(this.state.rpm);
      this.raf = requestAnimationFrame(tick);
    };
    this.raf = requestAnimationFrame(tick);
  }

  setThrottle(on: boolean) { this.on = on; }

  async stop() {
    cancelAnimationFrame(this.raf);
    const ctx = this.ctx; this.ctx = null;
    if (!ctx) return;
    this.voice?.stop(ctx.currentTime + 0.05);
    this.voice = null;
    await ctx.close();
    this.onRpm(0);
  }
}
