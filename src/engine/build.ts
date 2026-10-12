// Evaluates a build: bike + chosen parts -> price, hp, torque, weight and sim times.
import type { Bike, Part } from '../data/types.ts';
import { NO_TUNE_SHARE, stackGains } from './gains.ts';
import { simulate, type SimResult } from './sim.ts';
import { DEFAULT_RIDER_LB, stockInput } from './stock.ts';

export interface Build {
  bikeId: string;
  parts: Part[];
  sprockets?: { front: number; rear: number }; // default stock
  removeLimiter?: boolean; // only works with a tune that can remove it
  riderLb?: number;
}

export interface BuildResult extends SimResult {
  partsUsd: number;
  laborUsd: number;
  totalUsd: number; // bike MSRP + parts + labor
  priceMissing: string[]; // part ids with usd: null
  hp: number;
  torqueLbFt: number;
  weightLb: number; // wet + part deltas (no rider)
  limiterRemoved: boolean;
  est: boolean; // any input estimated
}

export function evaluate(bike: Bike, build: Build): BuildResult {
  if (!bike.calibration) throw new Error(`${bike.id} is not calibrated`);
  const parts = build.parts;
  const hasTune = parts.some((p) => p.category === 'tune');
  const share = (p: Part) => (p.effect.needsTuneForFullGain && !hasTune ? NO_TUNE_SHARE : 1);
  const hpFactor = stackGains(parts.map((p) => p.effect.hpPct * share(p)));
  const tqFactor = stackGains(parts.map((p) => p.effect.torquePct * share(p)));
  const weightLb = bike.wetWeightLb.value! + parts.reduce((s, p) => s + p.weightDeltaLb.value!, 0);
  const qs = parts.map((p) => p.effect.shiftTimeS).filter((x): x is number => x != null);
  const limiterRemoved = !!build.removeLimiter && parts.some((p) => p.category === 'tune' && p.limiterRemovable);

  const input = stockInput(bike, bike.calibration, build.riderLb ?? DEFAULT_RIDER_LB);
  input.massLb = weightLb + (build.riderLb ?? DEFAULT_RIDER_LB);
  input.gains = { hpFactor, tqFactor };
  input.shiftTimeS = Math.min(bike.calibration.shiftTimeS, ...qs);
  if (build.sprockets) {
    input.frontSprocket = build.sprockets.front;
    input.rearSprocket = build.sprockets.rear;
  }
  if (limiterRemoved) input.speedLimitMph = null;

  const partsUsd = parts.reduce((s, p) => s + (p.price.usd ?? 0), 0);
  const laborUsd = parts.reduce((s, p) => s + (p.labor?.usd ?? 0), 0);
  const est =
    bike.calibration.est ||
    parts.some((p) => p.effect.est || p.weightDeltaLb.est || p.labor?.est || p.effect.roughGuess) ||
    (parts.some((p) => p.effect.needsTuneForFullGain && p.effect.hpPct > 0) && !hasTune);

  return {
    ...simulate(input),
    partsUsd: +partsUsd.toFixed(2),
    laborUsd: +laborUsd.toFixed(2),
    totalUsd: +((bike.msrp.value ?? 0) + partsUsd + laborUsd).toFixed(2),
    priceMissing: parts.filter((p) => p.price.usd == null).map((p) => p.id),
    hp: +(bike.hp.value! * hpFactor).toFixed(1),
    torqueLbFt: +(bike.torqueLbFt.value! * tqFactor).toFixed(1),
    weightLb: +weightLb.toFixed(1),
    limiterRemoved,
    est,
  };
}
