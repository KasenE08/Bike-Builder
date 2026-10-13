// Fits cdA and launchG per bike so the stock sim matches published numbers.
import type { Bike, Calibration } from '../data/types.ts';
import { simulate, topSpeedMph } from './sim.ts';
import { stockInput, shiftTimeFor } from './stock.ts';

/** Published tests use magazine riders; calibrate with one, builds use the owner's weight (est.). */
export const TEST_RIDER_LB = 180;
const DEFAULT_CDA = 5.0; // ft^2, supersport + tucked rider (est.) when no target constrains it

function bisect(lo: number, hi: number, f: (x: number) => number, target: number, increasing: boolean, steps = 40) {
  for (let i = 0; i < steps; i++) {
    const mid = (lo + hi) / 2;
    const above = f(mid) > target;
    if (above === increasing) hi = mid; else lo = mid;
  }
  return (lo + hi) / 2;
}

const pct = (sim: number | null, pub: number) => (sim == null ? Infinity : (100 * (sim - pub)) / pub);

/** `fast`: fewer steps (~0.1% precision), for the on-phone KE1000 fit, whose shown numbers are pinned anyway. */
export function calibrate(b: Bike, fast = false): Calibration {
  const steps = fast ? 14 : 40;
  const shiftTimeS = shiftTimeFor(b);
  let cdA = DEFAULT_CDA, launchG = 1.0;
  const top = b.topSpeedMph, t60 = b.zeroTo60S.value!, t150 = b.zeroTo150S.value;
  const limitBinds = top.limited && top.limitMph != null && top.limitMph <= top.value!;
  const cdaTarget = !limitBinds ? 'top' : t150 != null ? '0-150' : null;

  for (let round = 0; round < (fast ? 3 : 4); round++) {
    if (cdaTarget === 'top') {
      cdA = bisect(1, 20, (x) => topSpeedMph({ ...stockInput(b, { cdA: x, launchG, shiftTimeS }, TEST_RIDER_LB), speedLimitMph: null }), top.value!, false, steps);
    } else if (cdaTarget === '0-150') {
      cdA = bisect(1, 20, (x) => simulate(stockInput(b, { cdA: x, launchG, shiftTimeS }, TEST_RIDER_LB)).zeroTo150S ?? 99, t150!, true, steps);
    }
    launchG = bisect(0.3, 2.5, (x) => simulate(stockInput(b, { cdA, launchG: x, shiftTimeS }, TEST_RIDER_LB)).zeroTo60S, t60, false, steps);
  }

  const r = simulate(stockInput(b, { cdA, launchG, shiftTimeS }, TEST_RIDER_LB));
  const checks: [string, number | null, number | null, boolean][] = [
    ['0-60', r.zeroTo60S, t60, b.zeroTo60S.est],
    ['top', r.topSpeedMph, top.value, top.est],
    ['0-150', r.zeroTo150S, t150, b.zeroTo150S.est],
    ['60-150', r.sixtyTo150S, b.sixtyTo150S.value, b.sixtyTo150S.est],
  ];
  const parts: string[] = [];
  let est = cdaTarget == null || b.zeroTo60S.est || (cdaTarget === 'top' && top.est) || (cdaTarget === '0-150' && b.zeroTo150S.est);
  for (const [name, sim, pub, pubEst] of checks) {
    if (pub == null) continue;
    const d = pct(sim, pub);
    parts.push(`${name} ${d >= 0 ? '+' : ''}${d.toFixed(1)}%${pubEst ? ' (target est.)' : ''}`);
    if (Math.abs(d) > 3 && (name === '0-60' || name === 'top')) est = true;
  }
  if (cdaTarget == null) parts.push(`cdA default ${DEFAULT_CDA} ft^2 (limiter binds, no 0-150 figure)`);
  return {
    cdA: +cdA.toFixed(3),
    launchG: +launchG.toFixed(3),
    shiftTimeS,
    est,
    fit: `sim (${TEST_RIDER_LB} lb test rider) vs published: ${parts.join(', ')}; shift ${shiftTimeS}s est.`,
  };
}
