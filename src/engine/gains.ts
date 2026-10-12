// Mod gains stack with diminishing returns: largest first, each next gain x 0.85^n, applied multiplicatively.

/** Share of an exhaust/intake gain that applies without an ECU tune (est.). */
export const NO_TUNE_SHARE = 0.5;

export function stackGains(pcts: number[]): number {
  return [...pcts]
    .sort((a, b) => b - a)
    .reduce((f, p, n) => f * (1 + (p / 100) * 0.85 ** n), 1);
}
