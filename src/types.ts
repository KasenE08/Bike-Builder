// Data format for Bike Builder.
// Repo data (bikes, parts) lives in /data as JSON. User data (builds, overrides,
// custom parts, photos, settings) lives only on the phone in IndexedDB.
// Units are US: USD, hp (crank), lb-ft, lb (wet), mph, seconds, cc.

/** A figure with provenance. `est: true` means not published; we estimated it. */
export interface Sourced<T = number> {
  value: T | null;
  /** URL or citation. Required unless est is true (then `note` explains the estimate). */
  source: string | null;
  est: boolean;
  note?: string;
}

export type StatKey =
  | 'hp'
  | 'torque'
  | 'wetWeight'
  | 'topSpeed'
  | 'zeroTo60'
  | 'sixtyTo150'
  | 'zeroTo150'
  | 'displacement';

export interface Bike {
  id: string; // kebab-case, matches filename
  make: string;
  model: string;
  modelYear: number;
  streetLegal: boolean;
  streetLegalReason?: string; // e.g. "Track-only model (H2R)"
  msrp: Sourced & { checked: string | null }; // checked = ISO date the price was verified
  stats: Record<StatKey, Sourced>;
  /** Stock drivetrain + aero inputs for the physics model. Calibration values are fitted in Phase 4. */
  physics: {
    redlineRpm: number | null;
    primaryRatio: number | null;
    gearRatios: number[]; // 1st..top
    frontSprocket: number | null;
    rearSprocket: number | null;
    rearTireCircumferenceM: number | null;
    /** Fitted so stock top speed matches. */
    cdA?: number;
    /** Fitted so stock 0-60 matches (launch/traction efficiency, 0-1). */
    launchFactor?: number;
    source: string | null;
  };
  /** Proportions for the shared wrap SVG template (Phase 6). */
  shape?: Record<string, number | string | boolean>;
}

export type Category =
  | 'exhaust'
  | 'intake'
  | 'ecu'
  | 'quickshifter'
  | 'carbon'
  | 'wheels'
  | 'brakes'
  | 'suspension'
  | 'gearing'
  | 'chain'
  | 'tail-tidy'
  | 'frame-sliders'
  | 'winglets'
  | 'wrap'
  | 'forced-induction';

export interface PartEffects {
  hpPct?: number; // +8 = +8% crank hp
  torquePct?: number;
  weightLb?: number; // negative = lighter
  /** Sprocket tooth changes vs stock (gearing parts). */
  frontTeethDelta?: number;
  rearTeethDelta?: number;
  /** Drag change multiplier on cdA, e.g. 1.02 for winglets. */
  cdAMult?: number;
}

export interface Part {
  id: string;
  name: string;
  brand: string;
  category: Category;
  /** Parts sharing a slot replace each other. Defaults to category. Carbon pieces use their own slots. */
  slot?: string;
  /** Bike ids this fits, or "all" for universal parts. */
  fits: string[] | 'all';
  /** Real current US price. null = not found; needsPrice flags it for the user. */
  priceUsd: number | null;
  priceSource: string | null;
  priceChecked: string | null; // ISO date
  needsPrice?: boolean;
  /** Install/labor cost shown separately from the part price. */
  labor?: { usd: number; note: string; source: string | null; est: boolean };
  effects: PartEffects;
  /** Where the effect numbers come from (dyno source or rule of thumb). */
  assumption: string;
  /** "Rough guess" label, e.g. forced induction on a bike not built for it. */
  roughGuess?: boolean;
  streetLegal: boolean;
  streetLegalReason?: string; // required when streetLegal is false
  /** Categories this part needs in the build (e.g. forced-induction requires "ecu"). */
  requires?: Category[];
  productUrl: string;
}

// ---- User data (IndexedDB only, never in repo) ----

export type Panel = 'tank' | 'fairing' | 'tail' | 'bellyPan' | 'wheels' | 'frame';
export type Finish = 'matte' | 'gloss' | 'metallic';
export type WrapConfig = Record<Panel, { color: string; finish: Finish }>;

export interface Build {
  id: string;
  name: string;
  bikeId: string;
  partIds: string[];
  wrap: WrapConfig;
  createdAt: string;
  updatedAt: string;
}

export interface Settings {
  riderWeightLb: number;
  /** User price edits, by part id. */
  priceOverrides: Record<string, number>;
  customParts: Part[];
}

export const DEFAULT_SETTINGS: Settings = {
  riderWeightLb: 180, // generic default; the user's own value is set on-device
  priceOverrides: {},
  customParts: [],
};
