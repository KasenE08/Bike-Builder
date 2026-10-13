// Turns a bike + its parts into parameters for the generated engine sound. Pure (testable).
import type { Bike, Part } from '../data/types';

export type ExhaustKind = 'stock' | 'slipOn' | 'fullSystem' | 'race';
export type FiKind = 'none' | 'turbo' | 'supercharger';

export interface SoundProfile {
  firingDeg: number[];
  idleRpm: number;
  redlineRpm: number;
  ccPerCyl: number;      // bigger cylinders = bigger pulses
  pipes: { layout: string; headerS: number; secondaryS: number; linkS: number; groups: number[][] }; // one-way wave travel times
  runnerS: number;       // intake runner travel time
  airboxHz: number;      // airbox resonance
  mufflerScale: number;  // smaller engines carry smaller cans: brighter, thinner
  trimDb: number;        // loudness trim per engine layout
  aggression: number;    // pipe drive multiplier (custom bike: grows with hp per liter)
  exhaust: ExhaustKind;
  tuned: boolean;        // ECU tune: sharper revs, decel crackle
  intakeMod: boolean;    // louder induction noise
  ramAir: boolean;       // ram-air howl at high rpm
  fi: FiKind;
  scRatio: number;       // supercharger impeller : crank ratio (whine pitch)
  revUpS: number;        // free-rev time idle -> redline
  label: string;
}

// Per-layout rev character (heavier cranks rev slower).
const LAYOUT = {
// trimDb evens out loudness: uneven-firing engines bunch their pulses, which reads quieter at the same peak level.
  parallelTwin: { revUpS: 1.05, trimDb: 1, name: 'parallel twin' },
  triple: { revUpS: 0.92, trimDb: -0.5, name: 'inline triple' },
  inline4: { revUpS: 0.8, trimDb: 3.5, name: 'inline-4' },
  crossplaneI4: { revUpS: 0.85, trimDb: 3, name: 'crossplane inline-4' },
  v4: { revUpS: 0.75, trimDb: 4.5, name: 'V4' },
  inline6: { revUpS: 0.62, trimDb: 0, name: 'inline-6' },
} as const;

export const C_EXHAUST = 520; // m/s, speed of sound in hot exhaust gas (est., ~400 C)
const C_AIR = 343;

/** Guess slip-on vs full system from the product name unless the part says otherwise. */
export function exhaustKind(p: Part): ExhaustKind {
  if (p.exhaustKind) return p.exhaustKind;
  const n = `${p.name} ${p.price.note ?? ''}`.toLowerCase();
  const homologated = /homologated/.test(n) && !/non-homologated/.test(n);
  const race = !homologated && /no cat|non-homologated|pista|competition|racing line|(^|[^-])race slip-on|racing full|racing slip-on|racing exhaust/.test(n);
  const slip = /slip-on|slip on|silencer|muffler/.test(n) && !/full system|full exhaust/.test(n);
  if (race) return 'race';
  return slip ? 'slipOn' : 'fullSystem';
}

export function soundProfile(bike: Bike, parts: Part[]): SoundProfile {
  const L = LAYOUT[bike.engine.layout];
  const cc = bike.displacementCc / bike.engine.firingDeg.length; // per cylinder
  const size = cc / 250;
  const X = bike.engine.exhaust;
  const ex = parts.find((p) => p.category === 'exhaust');
  const fiPart = parts.find((p) => p.category === 'forcedInduction');
  const fi: FiKind = fiPart ? fiPart.fiType ?? 'turbo' : /supercharg/i.test(bike.stock.forcedInduction ?? '') ? 'supercharger' : /turbo/i.test(bike.stock.forcedInduction ?? '') ? 'turbo' : 'none';
  // The H2R's stock silencer is a track-only race can, so its stock voice is the race voice.
  // The KE1000 always runs its open race pipe (an exhaust part changes power, never quiets it).
  const exhaust = bike.custom ? 'race' : ex ? exhaustKind(ex) : bike.streetLegal ? 'stock' : 'race';
  const tuned = parts.some((p) => p.category === 'tune');
  const gain = parts.reduce((s, p) => s + Math.max(0, p.effect.hpPct), 0);
  // KE1000: the owner's numbers shape the voice. More torque per liter revs harder; more hp per liter = rawer.
  const liters = bike.displacementCc / 1000;
  const clamp = (x: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, x));
  const revK = bike.custom ? clamp(Math.sqrt(100 / (bike.torqueLbFt.value! / liters)), 0.55, 1.8) : 1;
  const aggression = bike.custom ? clamp(bike.hp.value! / liters / 220, 0.7, 1.6) : 1;
  return {
    firingDeg: bike.engine.firingDeg,
    idleRpm: bike.engine.idleRpm,
    redlineRpm: bike.gearing.redlineRpm,
    ccPerCyl: Math.round(cc),
    pipes: {
      layout: X.layout,
      headerS: X.headerM / C_EXHAUST,
      secondaryS: (X.secondaryM ?? 0) / C_EXHAUST,
      linkS: X.linkM / C_EXHAUST,
      groups: X.layout === '4-2-1' || X.layout === '6-2-1' ? X.groups ?? [] : [],
    },
    // Intake runner ~ bore-scaled (est.); airbox resonance lower on bigger engines (est.).
    runnerS: (0.09 + 0.03 * Math.cbrt(size)) / C_AIR,
    mufflerScale: +Math.pow(1 / size, 0.35).toFixed(3),
    trimDb: L.trimDb,
    aggression: +aggression.toFixed(3),
    airboxHz: Math.round(520 / Math.sqrt(size * bike.engine.firingDeg.length / 2)),
    exhaust,
    tuned,
    intakeMod: parts.some((p) => p.category === 'intake'),
    ramAir: !!bike.engine.ramAir,
    fi,
    scRatio: 9.2, // Kawasaki H2/H2R impeller ~9.2x crank speed
    revUpS: +(L.revUpS * revK * Math.pow(size, 0.25) / (1 + Math.min(gain, 60) / 100) / (tuned ? 1.1 : 1)).toFixed(3),
    label: [`${bike.displacementCc} cc ${L.name}`, `${X.layout} pipes`, { stock: 'stock exhaust', slipOn: 'slip-on', fullSystem: 'full system', race: 'race exhaust' }[exhaust], tuned && 'tuned', fi !== 'none' && fi]
      .filter(Boolean).join(' · '),
  };
}

/** Muffler/voice settings per exhaust (used by the audio graph). */
// reflect = wave reflection where the link pipe meets the muffler (more open = stronger pipe resonance);
// loss = how much high end survives each reflection; level = loudness after the master compressor.
export const EXHAUST_VOICE: Record<ExhaustKind, { lowpassHz: number; drive: number; bodyDb: number; reflect: number; loss: number; gain: number; crackle: number; level: number }> = {
  stock: { lowpassHz: 1600, drive: 1.3, bodyDb: 3, reflect: -0.5, loss: 0.45, gain: 0.5, crackle: 0, level: 0.72 },
  slipOn: { lowpassHz: 2800, drive: 2, bodyDb: 4, reflect: -0.6, loss: 0.55, gain: 0.72, crackle: 0.35, level: 0.86 },
  fullSystem: { lowpassHz: 4000, drive: 2.6, bodyDb: 5, reflect: -0.7, loss: 0.65, gain: 0.88, crackle: 0.6, level: 0.94 },
  race: { lowpassHz: 6500, drive: 3.2, bodyDb: 5, reflect: -0.8, loss: 0.75, gain: 0.85, crackle: 1, level: 1 },
};
