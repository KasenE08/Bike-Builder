// Glue between saved builds, catalog data and the engine.
import { bikeById } from '../data/bikes';
import { gaps, parts } from '../data/parts';
import type { Bike, Category, Part } from '../data/types';
import { evaluate, type BuildResult } from '../engine/build';
import type { SavedBuild } from '../store/db';

export const CATEGORIES: { key: Category; label: string }[] = [
  { key: 'exhaust', label: 'Exhaust' },
  { key: 'intake', label: 'Intake' },
  { key: 'tune', label: 'ECU tune' },
  { key: 'quickshifter', label: 'Quickshifter' },
  { key: 'gearing', label: 'Gearing' },
  { key: 'chain', label: 'Chain' },
  { key: 'brakes', label: 'Brakes' },
  { key: 'suspension', label: 'Suspension' },
  { key: 'wheels', label: 'Wheels' },
  { key: 'carbon', label: 'Carbon' },
  { key: 'tailTidy', label: 'Tail tidy' },
  { key: 'frameSliders', label: 'Frame sliders' },
  { key: 'winglets', label: 'Winglets' },
  { key: 'forcedInduction', label: 'Turbo / supercharger' },
];

export const TIERS = ['budget', 'mid', 'premium'] as const;

export const partById = (id: string) => parts.find((p) => p.id === id);
export const partsFor = (bikeId: string, cat: Category) => parts.filter((p) => p.category === cat && p.fits.includes(bikeId));
export const gapFor = (bikeId: string, cat: Category) => gaps.find((g) => g.bike === bikeId && g.category === cat);
export const bikeName = (b: Bike) => `${b.year} ${b.make} ${b.model}`;

export function pickedParts(build: Pick<SavedBuild, 'picks'>): Part[] {
  return Object.values(build.picks).map((id) => (id ? partById(id) : undefined)).filter((p): p is Part => !!p);
}

export function evalSaved(build: SavedBuild, riderLb: number): BuildResult {
  const bike = bikeById(build.bikeId)!;
  const ps = pickedParts(build);
  const kit = build.picks.gearing ? partById(build.picks.gearing) : undefined;
  return evaluate(bike, {
    bikeId: bike.id,
    parts: ps,
    sprockets: kit ? build.sprockets : undefined, // teeth only change with a sprocket kit fitted
    removeLimiter: build.removeLimiter,
    riderLb,
  });
}

export const evalStock = (bikeId: string, riderLb: number) => evaluate(bikeById(bikeId)!, { bikeId, parts: [], riderLb });
