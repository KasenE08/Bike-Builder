import { useEffect, useMemo, useRef, useState } from 'preact/hooks';
import { bikeById } from '../data/bikes';
import type { Category, Part } from '../data/types';
import { deleteBuild, saveBuild, type SavedBuild } from '../store/db';
import { CustomPartForm } from './CustomPartForm';
import { PartSheet } from './PartSheet';
import { Est, StatBar } from './Stats';
import { isOutdated, usd } from './format';
import { CATEGORIES, TIERS, bikeName, customFor, evalSaved, evalStock, gapFor, partById, partsFor, userPrice } from './model';
import { go } from './router';

const cap = (s: string) => s[0].toUpperCase() + s.slice(1);

interface Props {
  initial: SavedBuild;
  riderLb: number;
  userVersion: number; // bumps when price edits / custom parts change
  onChanged: () => void;
  onUserDataChanged: () => Promise<void>;
}

export function BuildEditor({ initial, riderLb, userVersion, onChanged, onUserDataChanged }: Props) {
  const [b, setB] = useState(initial);
  const [sheet, setSheet] = useState<Part | null>(null);
  const [form, setForm] = useState<{ category: Category; existing?: Part } | null>(null);
  const bike = bikeById(b.bikeId)!;
  const stock = useMemo(() => evalStock(bike.id, riderLb), [bike.id, riderLb]);
  const r = useMemo(() => evalSaved(b, riderLb), [b, riderLb, userVersion]);

  // Autosave (debounced) to IndexedDB.
  const first = useRef(true);
  useEffect(() => {
    if (first.current) { first.current = false; return; }
    const t = setTimeout(() => saveBuild(b).then(onChanged), 300);
    return () => clearTimeout(t);
  }, [b]);

  const setPick = (cat: Category, id: string | undefined) => {
    const picks = { ...b.picks, [cat]: id };
    if (!id) delete picks[cat];
    const next: SavedBuild = { ...b, picks };
    if (cat === 'gearing') next.sprockets = id ? { front: bike.gearing.frontSprocket, rear: bike.gearing.rearSprocket } : undefined;
    if (cat === 'tune' && !(id && partById(id)?.limiterRemovable)) next.removeLimiter = false;
    setB(next);
  };

  const remove = async () => {
    if (!confirm(`Delete "${b.name}"?`)) return;
    await deleteBuild(b.id);
    onChanged();
    go('/');
  };

  const tune = b.picks.tune ? partById(b.picks.tune) : undefined;
  const kit = b.picks.gearing ? partById(b.picks.gearing) : undefined;

  return (
    <main>
      <button class="btn ghost" onClick={() => go('/')}>‹ Garage</button>
      <input class="title" type="text" value={b.name} aria-label="Build name" onInput={(e) => setB({ ...b, name: (e.target as HTMLInputElement).value })} />
      <div class="muted small" style={{ marginBottom: 8 }}>{bikeName(bike)} · {riderLb} lb rider</div>
      <StatBar r={r} base={stock} />

      {CATEGORIES.map(({ key, label }) => {
        const options = partsFor(bike.id, key);
        const customs = customFor(bike.id, key);
        const stockItem = bike.stock[key];
        const gap = gapFor(bike.id, key);
        const chosen = b.picks[key] ? partById(b.picks[key]!) : undefined;
        const mine = chosen ? userPrice(chosen.id) : undefined;
        const shownUsd = mine ?? chosen?.price.usd;
        return (
          <section class="cat" key={key}>
            <div class="spread">
              <strong>{label}</strong>
              {chosen ? <button class="btn ghost small" onClick={() => setSheet(chosen)}>Details</button> : null}
            </div>
            <div class="seg" role="group" aria-label={`${label} tier`} style={customs.length ? { gridTemplateColumns: 'repeat(5, 1fr)' } : undefined}>
              <button aria-pressed={!chosen} onClick={() => setPick(key, undefined)}>Stock</button>
              {TIERS.map((t) => {
                const p = options.find((o) => o.tier === t);
                return (
                  <button key={t} disabled={!p} aria-pressed={!!p && chosen?.id === p.id} onClick={() => p && setPick(key, p.id)}>
                    {cap(t)}
                  </button>
                );
              })}
              {customs.length > 0 && (
                <button aria-pressed={chosen?.tier === 'custom'} onClick={() => setPick(key, chosen?.tier === 'custom' ? chosen.id : customs[0].id)}>Custom</button>
              )}
            </div>
            {chosen?.tier === 'custom' && customs.length > 1 && (
              <select aria-label={`${label} custom part`} value={chosen.id} onChange={(e) => setPick(key, (e.target as HTMLSelectElement).value)} style={{ marginTop: 8, width: '100%' }}>
                {customs.map((c) => <option key={c.id} value={c.id}>{c.brand} {c.name}</option>)}
              </select>
            )}
            <div class="pick">
              {chosen ? (
                <>
                  <div>{chosen.brand} {chosen.name}</div>
                  <div class="muted small">
                    {shownUsd == null ? (chosen.tier === 'custom' ? 'No price' : 'Price not found') : usd(shownUsd)}
                    {mine != null && ' (your price)'}
                    {chosen.labor && <> + {usd(chosen.labor.usd)} labor<Est /></>}
                    {chosen.effect.hpPct > 0 && <> · +{chosen.effect.hpPct}% hp{chosen.effect.est && <Est />}</>}
                    {chosen.effect.needsTuneForFullGain && !b.picks.tune && chosen.effect.hpPct > 0 && <> (half without tune)</>}
                  </div>
                  {chosen.tier !== 'custom' && mine == null && isOutdated(chosen.price.checked) && <div class="flag">Price may be outdated</div>}
                </>
              ) : (
                stockItem && <div class="muted small">Stock: {stockItem}</div>
              )}
              {gap && <div class="flag" style={{ marginTop: 4 }}>{gap.note}</div>}
              <button class="btn ghost small" onClick={() => setForm({ category: key })}>+ Add custom part</button>
            </div>

            {key === 'gearing' && (
              <div class="row small" style={{ marginTop: 8 }}>
                <span class="muted">Teeth</span>
                {(['front', 'rear'] as const).map((side) => {
                  const opts = kit?.effect.sprocketOptions?.[side] ?? [side === 'front' ? bike.gearing.frontSprocket : bike.gearing.rearSprocket];
                  const cur = b.sprockets?.[side] ?? (side === 'front' ? bike.gearing.frontSprocket : bike.gearing.rearSprocket);
                  return (
                    <label key={side} class="row">
                      {cap(side)}
                      <select disabled={!kit} value={cur} onChange={(e) => setB({ ...b, sprockets: { ...b.sprockets!, [side]: +(e.target as HTMLSelectElement).value } })}>
                        {opts.map((n) => <option key={n} value={n}>{n}{n === (side === 'front' ? bike.gearing.frontSprocket : bike.gearing.rearSprocket) ? ' (stock)' : ''}</option>)}
                      </select>
                    </label>
                  );
                })}
                {!kit && <span class="flag">Pick a kit to change teeth</span>}
              </div>
            )}

            {key === 'tune' && tune?.limiterRemovable && (
              <label class="switch">
                Remove factory speed limiter
                <input type="checkbox" checked={!!b.removeLimiter} onChange={(e) => setB({ ...b, removeLimiter: (e.target as HTMLInputElement).checked })} />
              </label>
            )}
          </section>
        );
      })}

      <h2>Cost</h2>
      <table>
        <tbody>
          <tr><td>Bike (MSRP)</td><td>{usd(bike.msrp.value!)}</td></tr>
          <tr><td>Parts</td><td>{usd(r.partsUsd)}</td></tr>
          <tr><td>Labor <Est /></td><td>{usd(r.laborUsd)}</td></tr>
          <tr><td><strong>Total</strong></td><td><strong>{usd(r.totalUsd)}</strong></td></tr>
        </tbody>
      </table>
      <button class="btn ghost" style={{ marginTop: 16 }} onClick={remove}>Delete build</button>
      {sheet && (
        <PartSheet
          part={sheet}
          onClose={() => setSheet(null)}
          onUserDataChanged={onUserDataChanged}
          onEditCustom={(p) => { setSheet(null); setForm({ category: p.category, existing: p }); }}
        />
      )}
      {form && (
        <CustomPartForm
          bikeId={bike.id}
          category={form.category}
          categoryLabel={CATEGORIES.find((c) => c.key === form.category)!.label}
          existing={form.existing}
          onClose={() => setForm(null)}
          onSaved={async (p) => { await onUserDataChanged(); setPick(p.category, p.id); }}
        />
      )}
    </main>
  );
}
