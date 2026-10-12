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

describe('every bike sounds different', () => {
  const rhythm = (f: number[]) => f.map((d, i) => (i + 1 < f.length ? f[i + 1] : f[0] + 720) - d).join(',');
  it('each pair differs in firing rhythm, redline pitch (>= 1 semitone), exhaust plumbing (layout or pipe length >= 10%) or hardware', () => {
    const ps = bikes.map((b) => ({ id: b.id, p: soundProfile(b, []) }));
    for (let i = 0; i < ps.length; i++) for (let j = i + 1; j < ps.length; j++) {
      const A = ps[i].p, B = ps[j].p;
      const pitch = Math.abs(12 * Math.log2((A.redlineRpm * A.firingDeg.length) / (B.redlineRpm * B.firingDeg.length)));
      const distinct = rhythm(A.firingDeg) !== rhythm(B.firingDeg) || pitch >= 1 || A.pipes.layout !== B.pipes.layout
        || Math.abs(A.pipes.headerS / B.pipes.headerS - 1) >= 0.1 || Math.abs(A.pipes.linkS / B.pipes.linkS - 1) >= 0.1
        || A.fi !== B.fi || A.exhaust !== B.exhaust || A.ramAir !== B.ramAir;
      expect(distinct, `${ps[i].id} vs ${ps[j].id}`).toBe(true);
    }
  });

  it('H2R uses its track-only race silencer voice and supercharger; ram-air bikes howl', () => {
    const h2r = soundProfile(bikeById('kawasaki-ninja-h2r')!, []);
    expect(h2r.exhaust).toBe('race');
    expect(h2r.fi).toBe('supercharger');
    expect(soundProfile(bikeById('kawasaki-zx-6r')!, []).ramAir).toBe(true);
    expect(soundProfile(bikeById('honda-cbr650r')!, []).ramAir).toBe(false);
  });
});
