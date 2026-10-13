import { describe, it, expect } from 'vitest';
import { DEFAULT_KE, keBike, keErrors, type KeSpec } from './ke1000';
import { calibrate } from '../engine/calibrate';
import { evaluate } from '../engine/build';
import { makeCustomPart } from '../store/db';
import { soundProfile } from '../sound/profile';

const withCal = (s: KeSpec): KeSpec => ({ ...s, calibration: calibrate(keBike({ ...s, calibration: undefined }), true) });
const SLOW = 30000; // fits the physics a few times; CI runners are slower
const part = (hpPct: number, weightDeltaLb = 0, category: 'tune' | 'exhaust' = 'tune') =>
  makeCustomPart({ bikeId: 'ke1000', category, name: 'x', brand: 'x', usd: 100, laborUsd: 0, hpPct, torquePct: hpPct, weightDeltaLb, needsTune: false });

describe('KE1000 (owner-made bike)', () => {
  it('ships a calibration that is current for the defaults', () => {
    const fresh = calibrate(keBike({ ...DEFAULT_KE, calibration: undefined }));
    expect(Math.abs(fresh.cdA / DEFAULT_KE.calibration!.cdA - 1)).toBeLessThan(0.005);
    expect(Math.abs(fresh.launchG / DEFAULT_KE.calibration!.launchG - 1)).toBeLessThan(0.005);
  }, SLOW);

  it('validates the owner input', () => {
    expect(keErrors(DEFAULT_KE)).toEqual([]);
    expect(keErrors({ ...DEFAULT_KE, gearRatios: [2, 2.2, 1.8, 1.5, 1.3, 1.2] }).join()).toMatch(/smaller/);
    expect(keErrors({ ...DEFAULT_KE, zeroTo150S: null }).join()).toMatch(/0–150/);
    expect(keErrors({ ...DEFAULT_KE, topSpeedMph: 140, zeroTo150S: null })).toEqual([]);
    expect(keErrors({ ...DEFAULT_KE, peakTorqueRpm: 17000 }).join()).toMatch(/torque rpm/);
  });

  it('stock shows exactly the owner numbers, for any rider weight, even when they fight physics', () => {
    const odd: KeSpec = { ...DEFAULT_KE, hp: 90, torqueLbFt: 60, zeroTo60S: 1.4, zeroTo150S: 5.0, topSpeedMph: 260 };
    for (const spec of [DEFAULT_KE, withCal(odd)]) {
      const bike = keBike(spec);
      for (const riderLb of [120, 155, 250]) {
        const r = evaluate(bike, { bikeId: bike.id, parts: [], riderLb });
        expect(r.zeroTo60S).toBeCloseTo(spec.zeroTo60S, 6);
        expect(r.zeroTo150S!).toBeCloseTo(spec.zeroTo150S!, 6);
        expect(r.sixtyTo150S!).toBeCloseTo(spec.zeroTo150S! - spec.zeroTo60S, 6);
        expect(r.topSpeedMph).toBeCloseTo(spec.topSpeedMph, 1);
        expect(r.hp).toBe(spec.hp);
        expect(r.weightLb).toBe(spec.wetWeightLb);
      }
    }
  }, SLOW);

  it('a top speed under 150 shows N/A for 0-150 and 60-150', () => {
    const spec = withCal({ ...DEFAULT_KE, hp: 60, torqueLbFt: 40, topSpeedMph: 130, zeroTo60S: 5, zeroTo150S: null });
    const r = evaluate(keBike(spec), { bikeId: 'ke1000', parts: [] });
    expect(r.zeroTo150S).toBeNull();
    expect(r.sixtyTo150S).toBeNull();
    expect(r.topSpeedMph).toBeCloseTo(130, 1);
  }, SLOW);

  it('mods change the numbers from the owner baseline: more power is quicker, more weight is slower', () => {
    const bike = keBike(DEFAULT_KE);
    const stock = evaluate(bike, { bikeId: bike.id, parts: [] });
    const power = evaluate(bike, { bikeId: bike.id, parts: [part(20)] });
    const heavy = evaluate(bike, { bikeId: bike.id, parts: [part(0, 80)] });
    expect(power.hp).toBeCloseTo(DEFAULT_KE.hp * 1.2, 1);
    expect(power.zeroTo150S!).toBeLessThan(stock.zeroTo150S!);
    expect(power.topSpeedMph).toBeGreaterThan(stock.topSpeedMph);
    expect(heavy.zeroTo150S!).toBeGreaterThan(stock.zeroTo150S!);
  });

  it('sounds like an inline-6 on an open race pipe, shaped by the owner numbers', () => {
    const base = soundProfile(keBike(DEFAULT_KE), []);
    expect(base.firingDeg).toEqual([0, 120, 240, 360, 480, 600]);
    expect(base.exhaust).toBe('race');
    expect(base.grumble).toBe(1);
    expect(soundProfile(keBike(DEFAULT_KE), [part(5, 0, 'exhaust')]).exhaust).toBe('race'); // never quieter
    expect(soundProfile(keBike({ ...DEFAULT_KE, redlineRpm: 20000 }), []).redlineRpm).toBe(20000);
    expect(soundProfile(keBike({ ...DEFAULT_KE, idleRpm: 900 }), []).idleRpm).toBe(900);
    expect(soundProfile(keBike({ ...DEFAULT_KE, torqueLbFt: 140 }), []).revUpS).toBeLessThan(base.revUpS);
    expect(soundProfile(keBike({ ...DEFAULT_KE, hp: 350 }), []).aggression).toBeGreaterThan(base.aggression);
    expect(soundProfile(keBike({ ...DEFAULT_KE, displacementCc: 1600 }), []).mufflerScale).toBeLessThan(base.mufflerScale);
  });
});
