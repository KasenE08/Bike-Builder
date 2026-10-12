import { bikeById } from '../data/bikes';
import type { SavedBuild } from '../store/db';
import { bikeName, evalSaved } from './model';
import { NA_150, usd } from './format';
import { go } from './router';

export function Garage({ builds, riderLb }: { builds: SavedBuild[]; riderLb: number }) {
  return (
    <main>
      <div class="spread">
        <h1>Garage</h1>
        <button class="btn" onClick={() => go('/new')}>New build</button>
      </div>
      {builds.length === 0 && <p class="muted">No builds yet. Tap New build to pick a bike.</p>}
      {builds.map((b) => {
        const r = evalSaved(b, riderLb);
        return (
          <button class="card" key={b.id} onClick={() => go(`/build/${b.id}`)}>
            <div style={{ fontWeight: 700 }}>{b.name}</div>
            <div class="muted small">{bikeName(bikeById(b.bikeId)!)}</div>
            <div class="row small" style={{ marginTop: 6, flexWrap: 'wrap', gap: '4px 12px' }}>
              <span>{r.hp.toFixed(0)} hp</span>
              <span>0–60 {r.zeroTo60S.toFixed(2)} s</span>
              <span>{r.zeroTo150S == null ? NA_150 : `0–150 ${r.zeroTo150S.toFixed(2)} s`}</span>
              <span>{r.topSpeedMph.toFixed(0)} mph</span>
              <span>{usd(r.totalUsd)}</span>
            </div>
          </button>
        );
      })}
    </main>
  );
}
