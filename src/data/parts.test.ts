import { describe, it, expect } from 'vitest';
import { parts, gaps } from './parts';
import { bikes } from './bikes';

const ids = new Set(bikes.map((b) => b.id));
const date = /^\d{4}-\d{2}-\d{2}$/;

describe('parts data', () => {
  it('ids are unique', () => expect(new Set(parts.map((p) => p.id)).size).toBe(parts.length));

  for (const p of parts) {
    it(`${p.id}: real listing, valid fits, labor`, () => {
      expect(p.price.source).toMatch(/^https:\/\//);
      expect(p.price.source).not.toMatch(/amazon\.|ebay\./); // owner rule: no Amazon/eBay
      expect(p.price.checked).toMatch(date);
      if (p.price.usd !== null) expect(p.price.usd).toBeGreaterThan(0);
      expect(p.fits.length).toBeGreaterThan(0);
      for (const f of p.fits) expect(ids.has(f), f).toBe(true);
      expect(p.category).not.toBe('wrap'); // wraps are cosmetic, not priced
      expect(p.labor!.usd).toBeCloseTo(p.labor!.hours * 147, 2);
    });
  }

  it('at most one part per tier per category per bike', () => {
    const seen = new Set<string>();
    for (const p of parts) for (const b of p.fits) {
      const k = `${b}/${p.category}/${p.tier}`;
      expect(seen.has(k), k).toBe(false);
      seen.add(k);
    }
  });

  it('a gap is recorded wherever a bike has fewer than 3 parts in a category', () => {
    const count = new Map<string, number>();
    for (const p of parts) for (const b of p.fits) count.set(`${b}/${p.category}`, (count.get(`${b}/${p.category}`) ?? 0) + 1);
    const gapKeys = new Set(gaps.map((g) => `${g.bike}/${g.category}`));
    const priced = new Set(parts.flatMap((p) => p.fits));
    for (const b of priced) for (const c of ['exhaust', 'intake', 'tune', 'quickshifter', 'carbon', 'wheels', 'brakes', 'suspension', 'gearing', 'chain', 'tailTidy', 'frameSliders', 'winglets', 'forcedInduction']) {
      const stock = bikes.find((x) => x.id === b)!.stock[c as keyof (typeof bikes)[0]['stock']];
      if ((count.get(`${b}/${c}`) ?? 0) < 3 && !stock) expect(gapKeys.has(`${b}/${c}`), `${b}/${c}`).toBe(true);
    }
  });
});
