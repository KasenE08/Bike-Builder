// Data format for bike and part JSON files in /data.
// Units: US only (mph, lb, lb-ft, hp). Power is always crank hp.

/** ISO date, e.g. "2026-10-12". */
export type IsoDate = string;

/** A sourced number. `est: true` means not published; the UI shows "est." */
export interface Stat {
  value: number | null;
  est: boolean;
  source: string; // URL, or a note explaining the estimate
  checked: IsoDate;
}

export interface TopSpeed extends Stat {
  limited: boolean; // electronically limited from the factory
  limitMph: number | null;
}

export type Category =
  | 'exhaust' | 'intake' | 'tune' | 'quickshifter' | 'carbon' | 'wheels'
  | 'brakes' | 'suspension' | 'gearing' | 'chain' | 'tailTidy'
  | 'frameSliders' | 'winglets' | 'wrap' | 'forcedInduction';

export interface Gearing {
  frontSprocket: number;
  rearSprocket: number;
  primaryRatio: number;
  gearRatios: number[]; // 1st..6th
  rearTire: string; // e.g. "190/55-17"
  rearTireDiameterIn: number;
  redlineRpm: number;
  est: boolean; // true if any ratio is estimated (see source)
  source: string;
}

/** Fitted by scripts/calibrate so the stock sim matches published numbers. */
export interface Calibration {
  cdA: number;        // drag area, ft^2 (bike + rider)
  launchG: number;    // traction/wheelie-limited peak accel, g
  shiftTimeS: number; // per shift, stock (quickshifter if fitted from the factory)
  est: boolean;       // fitted to estimated targets, or a target could not be matched
  fit: string;        // which published figures were matched, and any misses
}

export interface Bike {
  id: string; // kebab-case, matches file name
  make: string;
  model: string;
  year: number;
  msrp: Stat;
  hp: Stat;
  torqueLbFt: Stat;
  peakHpRpm: number;
  peakTorqueRpm: number;
  wetWeightLb: Stat; // ready to ride, full tank
  dryWeightLb: Stat; // no fuel, oil or coolant
  topSpeedMph: TopSpeed;
  zeroTo60S: Stat;
  sixtyTo150S: Stat; // value null => "N/A, can't reach 150"
  zeroTo150S: Stat;
  displacementCc: number;
  gearing: Gearing;
  calibration?: Calibration; // added in Phase 4
  streetLegal: boolean;
  streetLegalReason?: string; // e.g. "H2R base bike: track only"
  /** Categories fitted from the factory; shown as "Stock". */
  stock: Partial<Record<Category, string>>; // e.g. { quickshifter: "KQS up/down" }
  notes?: string[];
}

export type Tier = 'budget' | 'mid' | 'premium' | 'custom'; // custom = owner-made, stored on device

export interface Price {
  usd: number | null; // null => flagged "price not found"
  source: string;     // listing URL
  checked: IsoDate;   // > 90 days old => "price may be outdated"
  note?: string;      // e.g. conflicting listings, price-per-wheel, fitment caveat
}

export interface Labor {
  usd: number;
  hours: number;
  source: string; // shop rate source
  est: boolean;   // hours are estimated unless a published flat-rate time exists
}

export interface Effect {
  hpPct: number;     // crank hp change, % of stock
  torquePct: number;
  est: boolean;      // true when taken from the closest similar data, not this exact part/bike
  /** Full gain needs an ECU tune (exhaust/intake); without one a reduced share applies. */
  needsTuneForFullGain?: boolean;
  /** Gearing parts: tooth counts the kit is sold in. The UI defaults to stock and the owner picks. */
  sprocketOptions?: { front: number[]; rear: number[]; est: boolean };
  /** Quickshifter: seconds per upshift with the shifter (replaces calibration.shiftTimeS). */
  shiftTimeS?: number;
  roughGuess?: boolean; // forced induction on a bike that didn't ship with it
  basis: string;        // dyno source + wheel->crank conversion note
}

export interface Part {
  id: string;
  category: Category;
  tier?: Tier; // legacy budget/mid/premium label (UI lists products by name); 'custom' = owner-made
  name: string;
  brand: string;
  fits: string[]; // bike ids
  price: Price;
  labor?: Labor;
  weightDeltaLb: Stat; // negative = lighter
  effect: Effect;
  requires?: Category[]; // e.g. forcedInduction -> ["tune"]
  streetLegal: boolean;
  streetLegalReason: string;
  /** Tune only: can remove the factory speed limiter. */
  limiterRemovable?: boolean;
}

/** Per-bike gaps recorded when fewer than 3 real products exist. */
export interface PartGap {
  bike: string;
  category: Category;
  note: string; // e.g. "No real forced-induction kit found for the R7"
}
