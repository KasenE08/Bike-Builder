import { useState } from 'preact/hooks';
import { allBikes } from '../data/bikes';
import type { BuildResult } from '../engine/build';
import type { SavedBuild } from '../store/db';
import { Est } from './Stats';
import { METRICS, delta, value } from './format';
import { evalSaved, evalStock } from './model';

interface Option { id: string; label: string; run: () => BuildResult }

export function Compare({ builds, riderLb }: { builds: SavedBuild[]; riderLb: number }) {
  const options: Option[] = [
    ...builds.map((b) => ({ id: b.id, label: b.name, run: () => evalSaved(b, riderLb) })),
    ...allBikes().map((bk) => ({ id: `stock:${bk.id}`, label: `Stock ${bk.model}`, run: () => evalStock(bk.id, riderLb) })),
  ];
  const [aId, setA] = useState(options[0]?.id);
  const [bId, setB] = useState(builds[0] ? `stock:${builds[0].bikeId}` : options[1]?.id);
  const A = options.find((o) => o.id === aId) ?? options[0];
  const B = options.find((o) => o.id === bId) ?? options[1];
  const ra = A.run(), rb = B.run();
  const sel = (v: string, set: (s: string) => void, label: string) => (
    <select aria-label={label} value={v} onChange={(e) => set((e.target as HTMLSelectElement).value)} style={{ width: '100%' }}>
      {options.map((o) => <option key={o.id} value={o.id}>{o.label}</option>)}
    </select>
  );
  return (
    <main>
      <h1>Compare</h1>
      <div class="row" style={{ marginBottom: 12 }}>
        <div style={{ flex: 1 }}>{sel(A.id, setA, 'First')}</div>
        <span class="muted">vs</span>
        <div style={{ flex: 1 }}>{sel(B.id, setB, 'Second')}</div>
      </div>
      <table>
        <thead><tr><th></th><th>{A.label}</th><th>{B.label}</th></tr></thead>
        <tbody>
          {METRICS.map((m) => {
            const d = delta(ra, rb, m);
            return (
              <tr key={m.key}>
                <td>{m.label}{(m.est(ra) || m.est(rb)) && <Est />}</td>
                <td>{value(ra, m)}{d && <div class={`small ${d.better ? 'better' : 'worse'}`}>{d.text}</div>}</td>
                <td>{value(rb, m)}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
      <p class="muted small">Arrows show the first column vs the second: green ▲ better, gray ▼ worse.</p>
    </main>
  );
}
