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
  for (let i = 0; i < c.length; i++) { const x = (i / 1023.5) - 1; c[i] = 0.9 * Math.tanh(1.5 * x) / Math.tanh(1.5); }
  soft.curve = c; soft.oversample = 'none'; // oversampling's filter overshoots the ceiling on dense high-rpm sound
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
  // A turbine in the exhaust takes energy out of the pulses: duller, quieter exhaust note.
  const turbo = p.fi === 'turbo';
  // Grumble: darker can, fatter low body (and cylinder imbalance in the worklet).
  const g = p.grumble;
  const voice = { ...v, drive: v.drive * p.aggression, bodyDb: v.bodyDb + 5 * g, lowpassHz: v.lowpassHz * p.mufflerScale * (1 - 0.5 * g) * (turbo ? 0.6 : 1), bodyHz: 1 / (4 * p.pipes.linkS) };
  const node = new AudioWorkletNode(ctx, 'engine-proc', {
    numberOfInputs: 0, outputChannelCount: [1],
    processorOptions: { ...p, voice, rough: 0.45 * p.grumble, intakeLvl: p.intakeMod ? 0.32 : 0.18, outGain: (12 / Math.sqrt(p.firingDeg.length)) * Math.pow(10, p.trimDb / 20) },
  });
  const exGain = ctx.createGain(); exGain.gain.value = v.gain * (turbo ? 0.75 : 1);
  node.connect(exGain).connect(out);

  // Induction hiss (louder with an intake mod).
  const intake = ctx.createBufferSource(); intake.buffer = noiseBuffer(ctx, 2); intake.loop = true;
  const intakeBp = ctx.createBiquadFilter(); intakeBp.type = 'bandpass'; intakeBp.Q.value = 0.9;
  const intakeGain = ctx.createGain(); intakeGain.gain.value = 0;
  intake.connect(intakeBp).connect(intakeGain).connect(out); intake.start();

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
  // Glide every control instead of stepping it each frame (steps make faint zipper clicks).
  const glide = (a: AudioParam, val: number, t: number, tc = 0.012) => a.setTargetAtTime(val, t, tc);
  // Air release: filtered noise with a falling band (breathy, never a pure tone).
  const release = (t: number, peak: number, f0: number, f1: number, q: number, dur: number) => {
    const src = ctx.createBufferSource(); src.buffer = burst;
    const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.Q.value = q;
    bp.frequency.setValueAtTime(f0, t); bp.frequency.exponentialRampToValueAtTime(f1, t + dur * 0.8);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(peak, t + 0.012); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(bp).connect(g).connect(fiOut); src.start(t); src.stop(t + dur + 0.05);
  };
  let crackleUntil = -1;
  return {
    apply(t, s, ev) {
      const r = s.rpm / p.redlineRpm;
      rpm.setValueAtTime(s.rpm, t);
      load.setValueAtTime(s.load, t);
      if (ev.crackleStart && crackleAmt > 0) crackleUntil = t + 0.9;
      crackle.setValueAtTime(t < crackleUntil ? crackleAmt * (crackleUntil - t) / 0.9 : 0, t);
      glide(intakeBp.frequency, 300 + 2200 * r, t);
      glide(intakeGain.gain, (p.intakeMod ? 0.05 : 0.02) * s.load * (0.3 + r), t);
      if (p.fi === 'supercharger') {
        const impHz = (s.rpm / 60) * p.scRatio; // impeller shaft frequency
        glide(tone1.frequency, impHz, t);
        glide(tone2.frequency, impHz * 2, t);
        // Scale with exhaust loudness so the whine stays on top of a loud pipe (the H2R's race can).
        // Impeller noise grows steeply with tip speed: faint at idle, a scream at redline.
        const lvl = (0.06 + 0.94 * Math.pow(r, 1.5)) * (0.55 + 0.45 * s.load) * Math.max(1, v.gain * 2.2);
        glide(toneGain1.gain, 0.1 * lvl, t);
        glide(toneGain2.gain, 0.04 * lvl, t);
        glide(hissBp.frequency, 1500 + 3000 * r, t);
        glide(hissGain.gain, 0.025 * lvl * s.load, t);
        if (ev.blowOff > 0.45) release(t, 0.2 * ev.blowOff, 3000, 1100, 2.5, 0.3); // H2's chirp from the boost relief when you lift
      } else if (p.fi === 'turbo') {
        const b = s.boost;
        glide(tone1.frequency, 2200 + 8500 * b, t); // compressor whistle rises with shaft speed
        glide(tone2.frequency, (2200 + 8500 * b) * 1.52, t);
        glide(toneGain1.gain, 0.07 * Math.pow(b, 1.4), t);
        glide(toneGain2.gain, 0.016 * Math.pow(b, 1.4), t);
        glide(hissBp.frequency, 2500 + 3500 * b, t); // air rushing through the compressor
        glide(hissGain.gain, 0.09 * Math.pow(b, 1.5), t);
        if (ev.blowOff > 0.2) release(t, 0.55 * ev.blowOff, 3200, 1800, 0.7, 0.6); // blow-off valve: sharp "pssh" that fades
      }
    },
    stop(t) { intake.stop(t); if (p.fi !== 'none') { tone1.stop(t); tone2.stop(t); hiss.stop(t); } node.disconnect(); },
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
