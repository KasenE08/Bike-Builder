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
  if (s.rpm >= p.redlineRpm) s.rpm = p.redlineRpm * 0.965; // limiter cuts ignition: rpm drops, climbs back (the 'brap-brap')
  if (s.rpm < p.idleRpm * 0.97) s.rpm = p.idleRpm;
  s.load += ((on ? 1 : 0) - s.load) * Math.min(1, dt * (on ? 18 : 10));
  // Turbo: needs exhaust flow (rpm) and load; boost builds with lag and dumps fast when the throttle shuts.
  const spool = Math.max(0, Math.min(1, (s.rpm - 0.35 * p.redlineRpm) / (0.45 * p.redlineRpm)));
  const target = p.fi === 'turbo' ? (on ? spool * s.load : 0) : 0;
  s.boost += (target - s.boost) * Math.min(1, dt * (target > s.boost ? 1.3 : 7));
  const released = s.wasOn && !on;
  s.wasOn = on;
  return { crackleStart: released && s.rpm > 0.55 * p.redlineRpm, blowOff: released ? (p.fi === 'supercharger' ? s.rpm / p.redlineRpm : s.boost) : 0 };
}

function noiseBuffer(ctx: BaseAudioContext, seconds: number) {
  const b = ctx.createBuffer(1, Math.floor(ctx.sampleRate * seconds), ctx.sampleRate);
  const d = b.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  return b;
}

/** Shared output stage: gentle compressor (keeps exhaust differences) -> makeup gain -> limiter -> soft clipper (never hard-clips). */
export function buildOutput(ctx: BaseAudioContext, level = 1): { input: GainNode; master: GainNode } {
  const input = ctx.createGain(); input.gain.value = 1.4;
  const comp = ctx.createDynamicsCompressor();
  comp.threshold.value = -12; comp.knee.value = 10; comp.ratio.value = 2.5; comp.attack.value = 0.006; comp.release.value = 0.15;
  const makeup = ctx.createGain(); makeup.gain.value = 2.5;
  const limiter = ctx.createDynamicsCompressor();
  limiter.threshold.value = -3; limiter.knee.value = 0; limiter.ratio.value = 20; limiter.attack.value = 0.001; limiter.release.value = 0.06;
  const soft = ctx.createWaveShaper(); // smooth ceiling just under full scale
  const c = new Float32Array(2048);
  for (let i = 0; i < c.length; i++) { const x = (i / 1023.5) - 1; c[i] = 0.97 * Math.tanh(1.5 * x) / Math.tanh(1.5); }
  soft.curve = c; soft.oversample = '2x';
  const post = ctx.createGain(); post.gain.value = level; // exhaust loudness after compression
  const master = ctx.createGain(); master.gain.value = 1; // fade in/out lives here
  input.connect(comp).connect(makeup).connect(limiter).connect(soft).connect(post).connect(master).connect(ctx.destination);
  return { input, master };
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
  // A turbine in the exhaust takes energy out of the pulses: duller, quieter exhaust note.
  const turbo = p.fi === 'turbo';
  const muffler = ctx.createBiquadFilter(); muffler.type = 'lowpass'; muffler.frequency.value = v.lowpassHz * (turbo ? 0.6 : 1); muffler.Q.value = 0.7;
  const exGain = ctx.createGain(); exGain.gain.value = v.gain * (turbo ? 0.75 : 1);
  node.connect(shaper).connect(body).connect(muffler).connect(exGain).connect(out);

  // Induction noise (louder with an intake mod).
  const intake = ctx.createBufferSource(); intake.buffer = noiseBuffer(ctx, 2); intake.loop = true;
  const intakeBp = ctx.createBiquadFilter(); intakeBp.type = 'bandpass'; intakeBp.Q.value = 0.9;
  const intakeGain = ctx.createGain(); intakeGain.gain.value = 0;
  intake.connect(intakeBp).connect(intakeGain).connect(out); intake.start();
  const howl = ctx.createOscillator(); howl.type = 'sawtooth';
  const howlLp = ctx.createBiquadFilter(); howlLp.type = 'lowpass'; howlLp.frequency.value = 2500;
  const howlGain = ctx.createGain(); howlGain.gain.value = 0;
  howl.connect(howlLp).connect(howlGain).connect(out);
  if (p.ramAir) howl.start();

  // Forced induction. Turbo: compressor whistle + intake hiss that build with boost, blow-off on lift.
  // Supercharger (centrifugal, gear-driven): whine locked to crank speed x impeller ratio, always present.
  const fiOut = ctx.createGain(); fiOut.gain.value = 1; fiOut.connect(out);
  const tone1 = ctx.createOscillator(); tone1.type = 'sine';
  const tone2 = ctx.createOscillator(); tone2.type = 'sine';
  const toneGain1 = ctx.createGain(); toneGain1.gain.value = 0;
  const toneGain2 = ctx.createGain(); toneGain2.gain.value = 0;
  tone1.connect(toneGain1).connect(fiOut); tone2.connect(toneGain2).connect(fiOut);
  const hiss = ctx.createBufferSource(); hiss.buffer = noiseBuffer(ctx, 2); hiss.loop = true;
  const hissBp = ctx.createBiquadFilter(); hissBp.type = 'bandpass'; hissBp.Q.value = 1.4;
  const hissGain = ctx.createGain(); hissGain.gain.value = 0;
  hiss.connect(hissBp).connect(hissGain).connect(fiOut);
  if (p.fi !== 'none') { tone1.start(); tone2.start(); hiss.start(); }
  const burst = noiseBuffer(ctx, 0.8);
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
      if (p.ramAir) { // airbox resonance tracks the firing frequency: the ZX howl
        const fire = (s.rpm / 120) * p.firingDeg.length;
        howl.frequency.setValueAtTime(fire * 2, t);
        howlGain.gain.setValueAtTime(0.09 * s.load * r * r, t);
      }
      if (p.fi === 'supercharger') {
        const impHz = (s.rpm / 60) * p.scRatio; // impeller shaft frequency
        tone1.frequency.setValueAtTime(impHz, t);
        tone2.frequency.setValueAtTime(impHz * 2, t);
        // Scale with exhaust loudness so the whine stays on top of a loud pipe (the H2R's race can).
        const lvl = (0.35 + 0.65 * r) * (0.55 + 0.45 * s.load) * Math.max(1, v.gain * 2.2);
        toneGain1.gain.setValueAtTime(0.24 * lvl, t);
        toneGain2.gain.setValueAtTime(0.1 * lvl, t);
        hissBp.frequency.setValueAtTime(1500 + 3000 * r, t);
        hissGain.gain.setValueAtTime(0.05 * lvl * s.load, t);
        if (ev.blowOff > 0.45) { // H2's chirp from the boost relief when you lift
          const o = ctx.createOscillator(); const g = ctx.createGain();
          o.frequency.setValueAtTime(2600, t); o.frequency.exponentialRampToValueAtTime(900, t + 0.22);
          g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.18 * ev.blowOff, t + 0.02); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.25);
          o.connect(g).connect(fiOut); o.start(t); o.stop(t + 0.3);
        }
      } else if (p.fi === 'turbo') {
        const b = s.boost;
        tone1.frequency.setValueAtTime(2200 + 8500 * b, t); // compressor whistle rises with shaft speed
        tone2.frequency.setValueAtTime((2200 + 8500 * b) * 1.52, t);
        toneGain1.gain.setValueAtTime(0.15 * Math.pow(b, 1.4), t);
        toneGain2.gain.setValueAtTime(0.035 * Math.pow(b, 1.4), t);
        hissBp.frequency.setValueAtTime(2500 + 3500 * b, t); // air rushing through the compressor
        hissGain.gain.setValueAtTime(0.2 * Math.pow(b, 1.5), t);
        if (ev.blowOff > 0.2) { // blow-off valve: sharp "pssh" that fades
          const src = ctx.createBufferSource(); src.buffer = burst;
          const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.setValueAtTime(3200, t); bp.frequency.exponentialRampToValueAtTime(1800, t + 0.5); bp.Q.value = 0.7;
          const g = ctx.createGain();
          g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.55 * ev.blowOff, t + 0.012); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.6);
          src.connect(bp).connect(g).connect(fiOut); src.start(t); src.stop(t + 0.65);
        }
      }
    },
    stop(t) { intake.stop(t); if (p.ramAir) howl.stop(t); if (p.fi !== 'none') { tone1.stop(t); tone2.stop(t); hiss.stop(t); } node.disconnect(); },
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
    const { input, master } = buildOutput(ctx, EXHAUST_VOICE[this.p.exhaust].level);
    master.gain.value = 0;
    master.gain.setTargetAtTime(0.98, ctx.currentTime, 0.15);
    this.voice = await buildVoice(ctx, this.p, input);
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
