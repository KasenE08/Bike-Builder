// Time-step acceleration sim and steady-state top speed. SI inside, US units at the edges.
import { torqueAt, type EngineSpec, type Gains } from './curve.ts';

const G = 9.81;
const RHO = 1.2; // air density, kg/m^3 (sea level, ~20 C)
const CRR = 0.015; // tire rolling resistance
const DRIVETRAIN_EFF = 0.9; // crank -> wheel (~10% loss)
const INERTIA = 1.05; // rotating-mass allowance on effective mass (est.)
const LB_KG = 0.45359237;
const FT2_M2 = 0.09290304;
const MPH_MS = 0.44704;
const LBFT_NM = 1.3558179;
const DT = 0.001;

export interface SimInput {
  engine: EngineSpec;
  gains?: Gains;
  massLb: number; // bike (wet) + parts + rider
  primaryRatio: number;
  gearRatios: number[];
  frontSprocket: number;
  rearSprocket: number;
  rearTireDiameterIn: number;
  cdA: number; // ft^2
  launchG: number;
  shiftTimeS: number;
  speedLimitMph: number | null; // electronic limiter, null = none/removed
}

export interface SimResult {
  zeroTo60S: number;
  zeroTo150S: number | null; // null => can't reach 150
  sixtyTo150S: number | null;
  topSpeedMph: number;
}

function setup(s: SimInput) {
  const m = s.massLb * LB_KG;
  const rW = (s.rearTireDiameterIn * 0.0254) / 2;
  const final = s.rearSprocket / s.frontSprocket;
  const ratios = s.gearRatios.map((g) => s.primaryRatio * g * final);
  const rpmAt = (v: number, gi: number) => (v / rW) * ratios[gi] * (60 / (2 * Math.PI));
  const launchRpm = Math.min(s.engine.peakTorqueRpm, 0.85 * s.engine.redlineRpm); // rider launches near peak torque
  /** Wheel drive force in gear gi at speed v (clutch slips below launch rpm; 0 past redline). */
  const drive = (v: number, gi: number) => {
    let rpm = rpmAt(v, gi);
    if (rpm > s.engine.redlineRpm) return 0;
    if (rpm < launchRpm) rpm = launchRpm;
    const f = (torqueAt(s.engine, rpm, s.gains) * LBFT_NM * ratios[gi] * DRIVETRAIN_EFF) / rW;
    return Math.min(f, s.launchG * m * G);
  };
  const resist = (v: number) => 0.5 * RHO * s.cdA * FT2_M2 * v * v + CRR * m * G;
  return { m, drive, resist, rpmAt };
}

export function topSpeedMph(s: SimInput): number {
  const { drive, resist } = setup(s);
  let top = 0;
  for (let mph = 1; mph <= 300; mph += 0.05) {
    const v = mph * MPH_MS;
    const f = Math.max(...s.gearRatios.map((_, gi) => drive(v, gi)));
    if (f < resist(v)) break;
    top = mph;
  }
  return s.speedLimitMph != null ? Math.min(top, s.speedLimitMph) : top;
}

export function simulate(s: SimInput): SimResult {
  const top = topSpeedMph(s);
  const { m, drive, resist, rpmAt } = setup(s);
  const vCap = s.speedLimitMph != null ? s.speedLimitMph * MPH_MS : Infinity;
  let v = 0, t = 0, gi = 0, shiftLeft = 0;
  let t60 = NaN, t150: number | null = null;
  const last = s.gearRatios.length - 1;
  while (t < 90) {
    if (shiftLeft <= 0 && gi < last && (rpmAt(v, gi) >= s.engine.redlineRpm || drive(v, gi + 1) > drive(v, gi))) {
      gi++;
      shiftLeft = s.shiftTimeS;
    }
    const f = shiftLeft > 0 ? 0 : drive(v, gi);
    shiftLeft -= DT;
    v = Math.min(vCap, Math.max(0, v + ((f - resist(v)) / (m * INERTIA)) * DT));
    t += DT;
    const mph = v / MPH_MS;
    if (isNaN(t60) && mph >= 60) t60 = t;
    if (mph >= 150) { t150 = t; break; }
    if (mph >= top - 0.05) break; // reached its top speed below 150
  }
  const reach150 = top >= 150 && t150 != null;
  return {
    zeroTo60S: t60,
    zeroTo150S: reach150 ? t150 : null,
    sixtyTo150S: reach150 ? t150! - t60 : null,
    topSpeedMph: top,
  };
}
