// Estimated crank torque curve built from published peak figures (no full dyno curves in the data).
// Points: 60% of peak torque at 1,500 rpm -> 88% at half peak-torque rpm -> peak torque -> torque at peak hp
// -> ~90% of peak hp at redline.

export interface EngineSpec {
  hp: number;
  torqueLbFt: number;
  peakHpRpm: number;
  peakTorqueRpm: number;
  redlineRpm: number;
}

/** Mod gains: torque factor applies at/below peak-torque rpm, hp factor at/above peak-hp rpm, blended between. */
export interface Gains {
  hpFactor: number;
  tqFactor: number;
}

const NONE: Gains = { hpFactor: 1, tqFactor: 1 };

export function torqueAt(e: EngineSpec, rpm: number, g: Gains = NONE): number {
  const rP = e.peakHpRpm;
  const rT = Math.min(e.peakTorqueRpm, rP - 500);
  const tAtP = (e.hp * 5252) / rP;
  const tAtRed = (0.9 * e.hp * 5252) / Math.max(e.redlineRpm, rP + 1);
  const pts: [number, number][] = [
    [1500, 0.6 * e.torqueLbFt],
    [Math.max(1600, rT / 2), 0.88 * e.torqueLbFt],
    [rT, e.torqueLbFt],
    [rP, tAtP],
    [Math.max(e.redlineRpm, rP + 1), tAtRed],
  ];
  let base: number;
  if (rpm <= pts[0][0]) base = pts[0][1];
  else if (rpm >= pts[pts.length - 1][0]) base = pts[pts.length - 1][1];
  else {
    let i = 0;
    while (rpm > pts[i + 1][0]) i++;
    const [r0, t0] = pts[i];
    const [r1, t1] = pts[i + 1];
    base = t0 + ((t1 - t0) * (rpm - r0)) / (r1 - r0);
  }
  const k = rpm <= rT ? 0 : rpm >= rP ? 1 : (rpm - rT) / (rP - rT);
  return base * (g.tqFactor + (g.hpFactor - g.tqFactor) * k);
}
