// Builds a sim input for a bike in stock form (shared by calibration and builds).
import type { Bike, Calibration } from '../data/types.ts';
import type { SimInput } from './sim.ts';

export const DEFAULT_RIDER_LB = 210;

/** Stock per-shift time (est.): factory quickshifter vs full-throttle clutch shift by a test rider. */
export const shiftTimeFor = (b: Bike) => (b.stock.quickshifter ? 0.06 : 0.25);

export function stockInput(b: Bike, cal: Pick<Calibration, 'cdA' | 'launchG' | 'shiftTimeS'>, riderLb = DEFAULT_RIDER_LB): SimInput {
  const g = b.gearing;
  return {
    engine: {
      hp: b.hp.value!,
      torqueLbFt: b.torqueLbFt.value!,
      peakHpRpm: b.peakHpRpm,
      peakTorqueRpm: b.peakTorqueRpm,
      redlineRpm: g.redlineRpm,
    },
    massLb: b.wetWeightLb.value! + riderLb,
    primaryRatio: g.primaryRatio,
    gearRatios: g.gearRatios,
    frontSprocket: g.frontSprocket,
    rearSprocket: g.rearSprocket,
    rearTireDiameterIn: g.rearTireDiameterIn,
    cdA: cal.cdA,
    launchG: cal.launchG,
    shiftTimeS: cal.shiftTimeS,
    speedLimitMph: b.topSpeedMph.limited ? b.topSpeedMph.limitMph : null,
  };
}
