// Turns a bike + its parts into parameters for the generated engine sound. Pure (testable).
import type { Bike, Part } from '../data/types';

export type ExhaustKind = 'stock' | 'slipOn' | 'fullSystem' | 'race';
export type FiKind = 'none' | 'turbo' | 'supercharger';

export interface SoundProfile {
  firingDeg: number[];
  idleRpm: number;
  redlineRpm: number;
  pulseHz: number;       // exhaust pulse resonance: lower = deeper
  decayS: number;        // how long each firing pulse rings
  exhaust: ExhaustKind;
  tuned: boolean;        // ECU tune: sharper revs, decel crackle
  intakeMod: boolean;    // louder induction noise
  fi: FiKind;
  scRatio: number;       // supercharger impeller : crank ratio (whine pitch)
  revUpS: number;        // free-rev time idle -> redline
  label: string;
}

const LAYOUT = {
  parallelTwin: { pulseHz: 85, decayS: 0.022, revUpS: 1.1, name: 'parallel twin' },
  triple: { pulseHz: 115, decayS: 0.016, revUpS: 0.95, name: 'inline triple' },
  inline4: { pulseHz: 165, decayS: 0.010, revUpS: 0.8, name: 'inline-4' },
  crossplaneI4: { pulseHz: 125, decayS: 0.013, revUpS: 0.85, name: 'crossplane inline-4' },
  v4: { pulseHz: 105, decayS: 0.015, revUpS: 0.75, name: 'V4' },
} as const;

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
  const ex = parts.find((p) => p.category === 'exhaust');
  const fiPart = parts.find((p) => p.category === 'forcedInduction');
  const fi: FiKind = fiPart ? fiPart.fiType ?? 'turbo' : /supercharg/i.test(bike.stock.forcedInduction ?? '') ? 'supercharger' : /turbo/i.test(bike.stock.forcedInduction ?? '') ? 'turbo' : 'none';
  const exhaust = ex ? exhaustKind(ex) : 'stock';
  const tuned = parts.some((p) => p.category === 'tune');
  const gain = parts.reduce((s, p) => s + Math.max(0, p.effect.hpPct), 0);
  return {
    firingDeg: bike.engine.firingDeg,
    idleRpm: bike.engine.idleRpm,
    redlineRpm: bike.gearing.redlineRpm,
    pulseHz: L.pulseHz,
    decayS: L.decayS,
    exhaust,
    tuned,
    intakeMod: parts.some((p) => p.category === 'intake'),
    fi,
    scRatio: 9.2, // Kawasaki H2/H2R impeller ~9.2x crank speed
    revUpS: L.revUpS / (1 + Math.min(gain, 60) / 100) / (tuned ? 1.1 : 1),
    label: [L.name, { stock: 'stock exhaust', slipOn: 'slip-on', fullSystem: 'full system', race: 'race exhaust' }[exhaust], tuned && 'tuned', fi !== 'none' && fi]
      .filter(Boolean).join(' · '),
  };
}

/** Muffler/voice settings per exhaust (used by the audio graph). */
export const EXHAUST_VOICE: Record<ExhaustKind, { lowpassHz: number; drive: number; bodyDb: number; gain: number; crackle: number }> = {
  stock: { lowpassHz: 1100, drive: 1.6, bodyDb: 4, gain: 0.5, crackle: 0 },
  slipOn: { lowpassHz: 2300, drive: 2.6, bodyDb: 6, gain: 0.72, crackle: 0.35 },
  fullSystem: { lowpassHz: 3600, drive: 3.6, bodyDb: 7, gain: 0.88, crackle: 0.6 },
  race: { lowpassHz: 5200, drive: 5, bodyDb: 8, gain: 1, crackle: 1 },
};
