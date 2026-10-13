// KE1000: the owner's own bike. Every number is the owner's; the app turns them into a full Bike.
import type { Bike, Calibration } from './types';

export const KE_ID = 'ke1000';

export interface KeSpec {
  msrpUsd: number | null; // owner's price (null = not set)
  displacementCc: number;
  hp: number;
  peakHpRpm: number;
  torqueLbFt: number;
  peakTorqueRpm: number;
  redlineRpm: number;
  idleRpm: number;
  wetWeightLb: number;
  topSpeedMph: number;
  zeroTo60S: number;
  zeroTo150S: number | null; // null when it can't reach 150
  primaryRatio: number;
  gearRatios: number[]; // 1st..6th
  frontSprocket: number;
  rearSprocket: number;
  rearTireDiameterIn: number;
  shiftTimeS: number;
  calibration?: Calibration; // fitted when the specs are saved
}

/** Starting point: a 1000 cc inline-6 hyperbike. Every value is editable. */
export const DEFAULT_KE: KeSpec = {
  msrpUsd: null,
  displacementCc: 1000,
  hp: 260,
  peakHpRpm: 16000,
  torqueLbFt: 92,
  peakTorqueRpm: 12500,
  redlineRpm: 17500,
  idleRpm: 1400,
  wetWeightLb: 395,
  topSpeedMph: 220,
  zeroTo60S: 2.5,
  zeroTo150S: 7.2,
  primaryRatio: 1.6,
  gearRatios: [2.6, 2.176, 1.842, 1.579, 1.381, 1.25],
  frontSprocket: 16,
  rearSprocket: 43,
  rearTireDiameterIn: 25.23,
  shiftTimeS: 0.06,
  // Pre-fitted for these defaults (ke1000.test.ts checks it is current), so first launch needs no fitting.
  calibration: { cdA: 3.187, launchG: 1.18, shiftTimeS: 0.06, est: false, fit: 'fitted to your numbers' },
};

/** Problems that stop a save (empty = OK). */
export function keErrors(s: KeSpec): string[] {
  const e: string[] = [];
  const range = (v: number | null, lo: number, hi: number, name: string) => {
    if (v == null || !Number.isFinite(v) || v < lo || v > hi) e.push(`${name}: ${lo}–${hi}`);
  };
  range(s.displacementCc, 50, 3000, 'Displacement (cc)');
  range(s.hp, 5, 1500, 'Horsepower');
  range(s.torqueLbFt, 3, 1000, 'Torque (lb-ft)');
  range(s.redlineRpm, 3000, 30000, 'Redline (rpm)');
  range(s.idleRpm, 500, 4000, 'Idle (rpm)');
  range(s.peakHpRpm, 2000, 30000, 'Peak hp rpm');
  range(s.peakTorqueRpm, 1500, 30000, 'Peak torque rpm');
  range(s.wetWeightLb, 100, 2000, 'Weight (lb)');
  range(s.topSpeedMph, 20, 400, 'Top speed (mph)');
  range(s.zeroTo60S, 0.8, 30, '0–60 (s)');
  range(s.primaryRatio, 0.5, 5, 'Primary ratio');
  range(s.frontSprocket, 8, 40, 'Front sprocket');
  range(s.rearSprocket, 20, 90, 'Rear sprocket');
  range(s.rearTireDiameterIn, 15, 40, 'Rear tire diameter (in)');
  range(s.shiftTimeS, 0, 1, 'Shift time (s)');
  s.gearRatios.forEach((g, i) => range(g, 0.3, 6, `Gear ${i + 1} ratio`));
  if (s.gearRatios.some((g, i) => i > 0 && g >= s.gearRatios[i - 1])) e.push('Gear ratios must get smaller from 1st to 6th');
  if (s.peakHpRpm > s.redlineRpm) e.push('Peak hp rpm must be at or below redline');
  if (s.peakTorqueRpm >= s.peakHpRpm) e.push('Peak torque rpm must be below peak hp rpm');
  if (s.idleRpm >= s.redlineRpm / 2) e.push('Idle must be under half of redline');
  if (s.topSpeedMph >= 150) {
    if (s.zeroTo150S == null) e.push('0–150 (s): needed when top speed is 150+');
    else if (!(s.zeroTo150S > s.zeroTo60S && s.zeroTo150S <= 120)) e.push('0–150 must be slower than 0–60');
  }
  if (s.msrpUsd != null) range(s.msrpUsd, 0, 10_000_000, 'Price ($)');
  return e;
}

/** Warnings that still allow a save. */
export function keWarnings(s: KeSpec): string[] {
  const w: string[] = [];
  const tqAtPeakHp = (s.hp * 5252) / s.peakHpRpm;
  if (tqAtPeakHp > s.torqueLbFt * 1.02) w.push(`${s.hp} hp at ${s.peakHpRpm} rpm needs ${tqAtPeakHp.toFixed(0)} lb-ft there, more than your peak torque. The power curve will rise to peak hp.`);
  return w;
}

const today = () => new Date().toISOString().slice(0, 10);
const mine = (value: number | null) => ({ value, est: false, source: 'Your number', checked: today() });

/** Full Bike object for the sim, build editor and engine sound. */
export function keBike(s: KeSpec): Bike {
  const reach150 = s.topSpeedMph >= 150 && s.zeroTo150S != null;
  return {
    id: KE_ID,
    make: 'KE',
    model: 'KE1000',
    year: 2026,
    msrp: mine(s.msrpUsd),
    hp: mine(s.hp),
    torqueLbFt: mine(s.torqueLbFt),
    peakHpRpm: s.peakHpRpm,
    peakTorqueRpm: s.peakTorqueRpm,
    wetWeightLb: mine(s.wetWeightLb),
    dryWeightLb: mine(s.wetWeightLb),
    topSpeedMph: { ...mine(s.topSpeedMph), limited: false, limitMph: null },
    zeroTo60S: mine(s.zeroTo60S),
    sixtyTo150S: mine(reach150 ? +(s.zeroTo150S! - s.zeroTo60S).toFixed(2) : null),
    zeroTo150S: mine(reach150 ? s.zeroTo150S : null),
    displacementCc: s.displacementCc,
    gearing: {
      frontSprocket: s.frontSprocket,
      rearSprocket: s.rearSprocket,
      primaryRatio: s.primaryRatio,
      gearRatios: s.gearRatios,
      rearTire: `${s.rearTireDiameterIn} in`,
      rearTireDiameterIn: s.rearTireDiameterIn,
      redlineRpm: s.redlineRpm,
      est: false,
      source: 'Your numbers',
    },
    calibration: s.calibration ? { ...s.calibration, est: false } : undefined,
    // Inline-6 screamer (owner's choice): even 120-degree firing, 1-5-3-6-2-4. Front three and rear three
    // cylinders each feed a 3-into-1, then 2-into-1 (each group sees even 240-degree pulses).
    engine: {
      layout: 'inline6',
      firingDeg: [0, 120, 240, 360, 480, 600],
      idleRpm: s.idleRpm,
      ramAir: true,
      est: false,
      source: 'KE1000 (owner-made): inline-6, firing 1-5-3-6-2-4, ram-air',
      exhaust: {
        layout: '6-2-1',
        headerM: 0.42,
        secondaryM: 0.28,
        linkM: 0.22,
        groups: [[0, 2, 4], [1, 3, 5]],
        est: true,
        source: 'Short titanium race headers into a megaphone (design choice)',
      },
    },
    streetLegal: false,
    streetLegalReason: 'Owner-made bike',
    stock: s.shiftTimeS <= 0.1 ? { quickshifter: 'Quickshifter (your shift time)' } : {},
    stockShiftS: s.shiftTimeS,
    custom: true,
  };
}
