import { describe, it, expect } from 'vitest';
import { bikes, bikeById } from '../data/bikes';
import { parts } from '../data/parts';
import { makeCustomPart } from '../store/db';
import { exhaustKind, soundProfile } from './profile';

describe('engine sound profile', () => {
  it('every bike has a valid firing pattern within the 720-degree cycle', () => {
    for (const b of bikes) {
      const f = b.engine.firingDeg;
      expect(f.length, b.id).toBeGreaterThanOrEqual(2);
      expect([...f].sort((x, y) => x - y), b.id).toEqual(f);
      for (const d of f) expect(d >= 0 && d < 720, b.id).toBe(true);
    }
  });

  it('classifies exhausts from their names', () => {
    const k = (id: string) => exhaustKind(parts.find((p) => p.id === id)!);
    expect(k('yoshimura-at2-ss-ninja500')).toBe('slipOn');
    expect(k('arrow-pro-race-cbr650r-2024')).toBe('fullSystem');
    expect(k('akrapovic-racing-ti-r9')).toBe('race');
    expect(k('dominator-gps-rs457')).toBe('fullSystem');
    expect(k('arrow-pro-race-ninja500')).toBe('slipOn');
    expect(k('akrapovic-racing-homologated-r9')).toBe('fullSystem');
    expect(k('arrow-pista-ti-rs457')).toBe('race');
  });

  it('H2R whines (stock supercharger); a custom turbo part makes any bike spool', () => {
    expect(soundProfile(bikeById('kawasaki-ninja-h2r')!, []).fi).toBe('supercharger');
    const r7 = bikeById('yamaha-r7')!;
    expect(soundProfile(r7, []).fi).toBe('none');
    const t = { ...makeCustomPart({ bikeId: r7.id, category: 'forcedInduction', name: 'CP2 turbo', brand: 'X', usd: 4000, laborUsd: 0, hpPct: 40, torquePct: 40, weightDeltaLb: 20, needsTune: false }), fiType: 'turbo' as const };
    expect(soundProfile(r7, [t]).fi).toBe('turbo');
  });

  it('mods change the voice: exhaust opens it up, tune sharpens revs', () => {
    const n5 = bikeById('kawasaki-ninja-500')!;
    const ex = parts.find((p) => p.id === 'yoshimura-at2-ss-ninja500')!;
    const tune = parts.find((p) => p.id === 'tst-worx-stage1-ninja500')!;
    const stock = soundProfile(n5, []);
    const built = soundProfile(n5, [ex, tune]);
    expect(stock.exhaust).toBe('stock');
    expect(built.exhaust).toBe('slipOn');
    expect(built.tuned).toBe(true);
    expect(built.revUpS).toBeLessThan(stock.revUpS);
  });
});
