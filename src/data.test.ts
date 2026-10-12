import { describe, expect, it } from 'vitest';
import { bikes, parts } from './data';
import { validateBike, validatePart } from './validate';

describe('data files', () => {
  it('loads at least one bike', () => {
    expect(bikes.length).toBeGreaterThan(0);
  });

  it('every bike is valid', () => {
    expect(bikes.flatMap(validateBike)).toEqual([]);
  });

  it('every part is valid', () => {
    const ids = new Set(bikes.map((b) => b.id));
    expect(parts.flatMap((p) => validatePart(p, ids))).toEqual([]);
  });

  it('ids are unique', () => {
    const all = [...bikes.map((b) => b.id), ...parts.map((p) => p.id)];
    expect(new Set(all).size).toBe(all.length);
  });
});
