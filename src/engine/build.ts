// Evaluates a build: bike + chosen parts -> price, hp, torque, weight and sim times.
import type { Bike, Part } from '../data/types.ts';
import { NO_TUNE_SHARE, stackGains } from './gains.ts';
import { simulate, type SimInput, type SimResult } from './sim.ts';
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
  estBy: { power: boolean; weight: boolean; times: boolean }; // per-metric est. flags for the UI
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
  const power =
    !!bike.hp.est || !!bike.torqueLbFt.est ||
    parts.some((p) => p.effect.est || p.effect.roughGuess) ||
    (parts.some((p) => p.effect.needsTuneForFullGain && p.effect.hpPct > 0) && !hasTune);
  const weight = !!bike.wetWeightLb.est || parts.some((p) => p.weightDeltaLb.est);
  const times = bike.calibration.est || power || weight;
  const est = times || parts.some((p) => p.labor?.est);

  let sim = simulate(input);
  if (bike.custom) sim = pinToOwner(bike, sim, stockInput(bike, bike.calibration, build.riderLb ?? DEFAULT_RIDER_LB));

  return {
    ...sim,
    partsUsd: +partsUsd.toFixed(2),
    laborUsd: +laborUsd.toFixed(2),
    totalUsd: +((bike.msrp.value ?? 0) + partsUsd + laborUsd).toFixed(2),
    priceMissing: parts.filter((p) => p.price.usd == null).map((p) => p.id),
    hp: +(bike.hp.value! * hpFactor).toFixed(1),
    torqueLbFt: +(bike.torqueLbFt.value! * tqFactor).toFixed(1),
    weightLb: +weightLb.toFixed(1),
    limiterRemoved,
    est,
    estBy: { power, weight, times },
  };
}

/**
 * Custom bike: the owner's stock numbers are shown exactly. The sim supplies only the change a build makes
 * (modded sim / stock sim, same rider), applied to the owner's figures.
 */
function pinToOwner(bike: Bike, r: SimResult, stock: SimInput): SimResult {
  const s0 = simulate(stock);
  const own60 = bike.zeroTo60S.value!, ownTop = bike.topSpeedMph.value!, own150 = bike.zeroTo150S.value;
  const k60 = own60 / s0.zeroTo60S;
  const k150 = own150 != null && s0.zeroTo150S != null ? own150 / s0.zeroTo150S : k60;
  const top = +(r.topSpeedMph * (ownTop / s0.topSpeedMph)).toFixed(1);
  const t60 = r.zeroTo60S * k60;
  const t150 = top >= 150 && r.zeroTo150S != null ? r.zeroTo150S * k150 : null;
  return { zeroTo60S: t60, zeroTo150S: t150, sixtyTo150S: t150 == null ? null : t150 - t60, topSpeedMph: top };
}
