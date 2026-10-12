import { Fragment } from 'preact';
import { bikes } from '../data/bikes';
import { parts } from '../data/parts';
import type { Bike } from '../data/types';
import { newBuild, saveBuild } from '../store/db';
import { Est } from './Stats';
import { bikeName } from './model';
import { go } from './router';

const hasParts = (b: Bike) => parts.some((p) => p.fits.includes(b.id));

export function BikePicker({ onCreated }: { onCreated: () => Promise<unknown> }) {
  const sorted = [...bikes].sort((a, b) => Number(hasParts(b)) - Number(hasParts(a)) || a.msrp.value! - b.msrp.value!);
  const pick = async (b: Bike) => {
    const nb = newBuild(b.id, `${b.model} build`);
    await saveBuild(nb);
    await onCreated();
    go(`/build/${nb.id}`);
  };
  return (
    <main>
      <button class="btn ghost" onClick={() => history.back()}>‹ Back</button>
      <h1>Pick a bike</h1>
      {sorted.map((b, i) => (
        <Fragment key={b.id}>
          {i > 0 && hasParts(sorted[i - 1]) && !hasParts(b) && <h2>Stock only (no parts yet)</h2>}
          <button class="card" onClick={() => pick(b)}>
            <div style={{ fontWeight: 700 }}>{bikeName(b)}</div>
            <div class="row small muted" style={{ flexWrap: 'wrap', gap: '2px 12px', marginTop: 4 }}>
              <span>{b.hp.value} hp{b.hp.est && <Est />}</span>
              <span>{b.wetWeightLb.value} lb wet{b.wetWeightLb.est && <Est />}</span>
              <span>0–60 {b.zeroTo60S.value} s{b.zeroTo60S.est && <Est />}</span>
              <span>{b.topSpeedMph.value} mph{b.topSpeedMph.est && <Est />}</span>
              <span>${b.msrp.value!.toLocaleString('en-US')}</span>
            </div>
          </button>
        </Fragment>
      ))}
    </main>
  );
}
