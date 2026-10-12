import type { BuildResult } from '../engine/build';

type Key = 'hp' | 'torqueLbFt' | 'weightLb' | 'zeroTo60S' | 'sixtyTo150S' | 'zeroTo150S' | 'topSpeedMph' | 'totalUsd';

export interface Metric {
  key: Key;
  label: string;
  higherIsBetter: boolean;
  fmt: (v: number) => string;
  est: (r: BuildResult) => boolean;
}

const usd = (v: number) => '$' + Math.round(v).toLocaleString('en-US');

export const METRICS: Metric[] = [
  { key: 'hp', label: 'Power', higherIsBetter: true, fmt: (v) => `${v.toFixed(0)} hp`, est: (r) => r.estBy.power },
  { key: 'torqueLbFt', label: 'Torque', higherIsBetter: true, fmt: (v) => `${v.toFixed(1)} lb-ft`, est: (r) => r.estBy.power },
  { key: 'weightLb', label: 'Weight', higherIsBetter: false, fmt: (v) => `${v.toFixed(0)} lb`, est: (r) => r.estBy.weight },
  { key: 'zeroTo60S', label: '0–60', higherIsBetter: false, fmt: (v) => `${v.toFixed(2)} s`, est: (r) => r.estBy.times },
  { key: 'sixtyTo150S', label: '60–150', higherIsBetter: false, fmt: (v) => `${v.toFixed(2)} s`, est: (r) => r.estBy.times },
  { key: 'zeroTo150S', label: '0–150', higherIsBetter: false, fmt: (v) => `${v.toFixed(2)} s`, est: (r) => r.estBy.times },
  { key: 'topSpeedMph', label: 'Top', higherIsBetter: true, fmt: (v) => `${v.toFixed(0)} mph`, est: (r) => r.estBy.times },
  { key: 'totalUsd', label: 'Cost', higherIsBetter: false, fmt: usd, est: (r) => r.laborUsd > 0 },
];

export const NA_150 = "N/A, can't reach 150";
export { usd };

export function value(r: BuildResult, m: Metric): string {
  const v = r[m.key];
  return v == null ? NA_150 : m.fmt(v);
}

/** Change vs a baseline: arrow is about better/worse, not up/down. */
export function delta(r: BuildResult, base: BuildResult, m: Metric): { text: string; better: boolean } | null {
  const a = r[m.key], b = base[m.key];
  if (a == null || b == null) return null;
  const d = a - b;
  const eps = m.key === 'totalUsd' ? 0.5 : m.key.endsWith('S') ? 0.005 : 0.05;
  if (Math.abs(d) < eps) return null;
  const better = m.higherIsBetter ? d > 0 : d < 0;
  const abs = m.key === 'totalUsd' ? usd(Math.abs(d)) : m.fmt(Math.abs(d));
  return { text: `${better ? '▲' : '▼'} ${d > 0 ? '+' : '−'}${abs}`, better };
}

export const daysSince = (iso: string) => Math.floor((Date.now() - Date.parse(iso)) / 86_400_000);
export const isOutdated = (iso: string) => daysSince(iso) > 90;
