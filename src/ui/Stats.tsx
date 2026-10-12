import type { BuildResult } from '../engine/build';
import { METRICS, delta, value } from './format';

export function Est() {
  return <span class="est">est.</span>;
}

/** Sticky stat bar: every metric with its change vs stock. */
export function StatBar({ r, base }: { r: BuildResult; base: BuildResult }) {
  return (
    <div class="stats" aria-label="Build stats">
      <div class="stats-grid">
        {METRICS.map((m) => {
          const v = r[m.key];
          const d = delta(r, base, m);
          const est = m.est(r);
          return (
            <div class="stat" key={m.key}>
              <div class="k">{m.label}{est && v != null ? <Est /> : null}</div>
              <div class={v == null ? 'v na' : 'v'}>{value(r, m)}</div>
              {v != null && <div class={`d ${d ? (d.better ? 'better' : 'worse') : 'muted'}`}>{d ? d.text : 'Stock'}</div>}
            </div>
          );
        })}
      </div>
      {r.priceMissing.length > 0 && <div class="flag">Total excludes {r.priceMissing.length} part(s) with no price found.</div>}
    </div>
  );
}
