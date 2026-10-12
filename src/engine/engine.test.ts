import { describe, it, expect } from 'vitest';
import { bikes, bikeById } from '../data/bikes';
import { parts } from '../data/parts';
import type { Part } from '../data/types';
import { stackGains } from './gains';
import { simulate } from './sim';
import { stockInput } from './stock';
import { TEST_RIDER_LB } from './calibrate';
import { evaluate } from './build';

const near = (a: number, b: number, pct: number) => expect(Math.abs(a - b) / b * 100).toBeLessThanOrEqual(pct);
const part = (id: string) => parts.find((p) => p.id === id)!;

describe('gains', () => {
  it('stacks largest first with 0.85^n diminishing', () => {
    expect(stackGains([5, 10])).toBeCloseTo(1.1 * (1 + 0.05 * 0.85), 10);
    expect(stackGains([])).toBe(1);
  });
});

describe('calibration', () => {
  for (const b of bikes) {
    it(`${b.id}: calibrated; stock sim matches published (non-est.) 0-60 and top within 3%`, () => {
      expect(b.calibration).toBeTruthy();
      const r = simulate(stockInput(b, b.calibration!, TEST_RIDER_LB));
      if (!b.zeroTo60S.est) near(r.zeroTo60S, b.zeroTo60S.value!, 3);
      if (!b.topSpeedMph.est) near(r.topSpeedMph, b.topSpeedMph.value!, 3);
    });
  }

  it("can't-reach-150 bikes get null 0-150 and 60-150", () => {
    for (const b of bikes.filter((x) => x.topSpeedMph.value! < 150)) {
      const r = simulate(stockInput(b, b.calibration!));
      expect(r.zeroTo150S, b.id).toBeNull();
      expect(r.sixtyTo150S, b.id).toBeNull();
    }
  });
});

describe('builds', () => {
  const n5 = bikeById('kawasaki-ninja-500')!;
  const stock = evaluate(n5, { bikeId: n5.id, parts: [] });

  it('stock build: price is MSRP, weight is wet weight', () => {
    expect(stock.totalUsd).toBe(n5.msrp.value);
    expect(stock.weightLb).toBe(n5.wetWeightLb.value);
  });

  it('exhaust without a tune gets half its gain; with a tune, full gain stacked', () => {
    const ex = part('yoshimura-at2-ss-ninja500');
    const tune = part('tst-worx-stage1-ninja500');
    const noTune = evaluate(n5, { bikeId: n5.id, parts: [ex] });
    expect(noTune.hp).toBeCloseTo(n5.hp.value! * (1 + 0.016), 1);
    const both = evaluate(n5, { bikeId: n5.id, parts: [ex, tune] });
    expect(both.hp).toBeCloseTo(n5.hp.value! * stackGains([3.2, 11.1]), 1);
    expect(both.zeroTo60S).toBeLessThan(stock.zeroTo60S);
    expect(both.topSpeedMph).toBeGreaterThanOrEqual(stock.topSpeedMph);
    expect(both.totalUsd).toBeCloseTo(n5.msrp.value! + ex.price.usd! + tune.price.usd! + ex.labor!.usd + tune.labor!.usd, 2);
  });

  it('gearing changes are applied: shorter does not raise top speed, taller does not lower it', () => {
    // Note: -1 front on the Ninja 500 makes 1st gear top out below 60 mph, adding a shift (0-60 gets slower).
    const short = evaluate(n5, { bikeId: n5.id, parts: [], sprockets: { front: 13, rear: 43 } });
    const tall = evaluate(n5, { bikeId: n5.id, parts: [], sprockets: { front: 15, rear: 43 } });
    expect(short.zeroTo60S).not.toBe(stock.zeroTo60S);
    expect(short.topSpeedMph).toBeLessThanOrEqual(stock.topSpeedMph);
    expect(tall.topSpeedMph).toBeGreaterThanOrEqual(stock.topSpeedMph - 0.1);
  });

  it('quickshifter cuts shift time and improves acceleration', () => {
    const qs = evaluate(n5, { bikeId: n5.id, parts: [part('flashtune-qs-kawasaki')] });
    expect(qs.zeroTo60S).toBeLessThan(stock.zeroTo60S);
  });

  it('limiter caps top speed unless a limiter-removing tune is fitted', () => {
    const zx10 = bikeById('kawasaki-zx-10r')!;
    const fakeTune = { ...part('tst-worx-zx4r'), id: 'test-tune', fits: [zx10.id], limiterRemovable: true } as Part;
    const capped = evaluate(zx10, { bikeId: zx10.id, parts: [], removeLimiter: true });
    expect(capped.topSpeedMph).toBeLessThanOrEqual(zx10.topSpeedMph.limitMph!);
    expect(capped.limiterRemoved).toBe(false);
    const freed = evaluate(zx10, { bikeId: zx10.id, parts: [fakeTune], removeLimiter: true });
    expect(freed.limiterRemoved).toBe(true);
    expect(freed.topSpeedMph).toBeGreaterThan(zx10.topSpeedMph.limitMph!);
  });

  it('heavier rider is slower', () => {
    const heavy = evaluate(n5, { bikeId: n5.id, parts: [], riderLb: 260 });
    expect(heavy.zeroTo60S).toBeGreaterThan(stock.zeroTo60S);
  });
});
