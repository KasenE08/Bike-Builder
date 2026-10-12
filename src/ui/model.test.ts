import { describe, it, expect, afterEach } from 'vitest';
import { makeCustomPart, newBuild } from '../store/db';
import { customFor, evalSaved, partById, setUserData } from './model';

const n5 = 'kawasaki-ninja-500';
afterEach(() => setUserData([], []));

describe('owner prices and custom parts', () => {
  it('a price edit replaces the listed price in build totals', () => {
    const b = { ...newBuild(n5, 't'), picks: { exhaust: 'akrapovic-slipon-ti-ninja400-500' } };
    const listed = evalSaved(b, 155).partsUsd;
    setUserData([], [{ partId: 'akrapovic-slipon-ti-ninja400-500', usd: 650, updatedAt: 0 }]);
    expect(evalSaved(b, 155).partsUsd).toBe(650);
    expect(listed).toBe(partById('akrapovic-slipon-ti-ninja400-500')!.price.usd);
  });

  it('a custom part is offered for its bike/category and feeds the sim as est.', () => {
    const c = makeCustomPart({ bikeId: n5, category: 'exhaust', name: 'My pipe', brand: 'Local', usd: 300, laborUsd: 50, hpPct: 5, torquePct: 3, weightDeltaLb: -4, needsTune: false });
    setUserData([c], []);
    expect(customFor(n5, 'exhaust').map((p) => p.id)).toEqual([c.id]);
    expect(customFor('yamaha-r7', 'exhaust')).toEqual([]);
    const stock = evalSaved(newBuild(n5, 's'), 155);
    const r = evalSaved({ ...newBuild(n5, 'c'), picks: { exhaust: c.id } }, 155);
    expect(r.hp).toBeCloseTo(stock.hp * 1.05, 1);
    expect(r.weightLb).toBeCloseTo(stock.weightLb - 4, 1);
    expect(r.partsUsd).toBe(300);
    expect(r.laborUsd).toBe(50);
    expect(r.estBy.power).toBe(true);
    expect(r.zeroTo60S).toBeLessThan(stock.zeroTo60S);
  });

  it('a deleted custom part is ignored by builds that picked it', () => {
    const r = evalSaved({ ...newBuild(n5, 'x'), picks: { exhaust: 'c-gone' } }, 155);
    expect(r.partsUsd).toBe(0);
  });
});
