import { Fragment } from 'preact';
import { bikes, getCustomBike } from '../data/bikes';
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
  const ke = getCustomBike();
  return (
    <main>
      <button class="btn ghost" onClick={() => history.back()}>‹ Back</button>
      <h1>Pick a bike</h1>
      {ke && (
        <>
          <h2>Your bike</h2>
          <button class="card" onClick={() => pick(ke)}>
            <div style={{ fontWeight: 700 }}>KE1000 <span class="muted small">· your custom inline-6</span></div>
            <div class="row small muted" style={{ flexWrap: 'wrap', gap: '2px 12px', marginTop: 4 }}>
              <span>{ke.hp.value} hp</span>
              <span>{ke.gearing.redlineRpm.toLocaleString('en-US')} rpm</span>
              <span>{ke.wetWeightLb.value} lb</span>
              <span>0–60 {ke.zeroTo60S.value} s</span>
              <span>{ke.topSpeedMph.value} mph</span>
              {ke.msrp.value != null && <span>${ke.msrp.value.toLocaleString('en-US')}</span>}
            </div>
          </button>
          <a class="btn ghost small" href="#/ke1000">Edit KE1000 specs ›</a>
          <h2>Real bikes</h2>
        </>
      )}
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
