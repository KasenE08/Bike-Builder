import { useState } from 'preact/hooks';
import type { Category, Part } from '../data/types';
import { makeCustomPart, saveCustomPart } from '../store/db';

interface Props {
  bikeId: string;
  category: Category;
  categoryLabel: string;
  existing?: Part;
  onClose: () => void;
  onSaved: (p: Part) => Promise<void>;
}

const num = (s: string) => (s.trim() === '' ? NaN : Number(s));

export function CustomPartForm({ bikeId, category, categoryLabel, existing, onClose, onSaved }: Props) {
  const ex = existing;
  const [f, setF] = useState({
    name: ex?.name ?? '',
    brand: ex?.brand ?? '',
    usd: ex?.price.usd != null ? String(ex.price.usd) : '',
    labor: ex?.labor ? String(ex.labor.usd) : '0',
    hp: ex ? String(ex.effect.hpPct) : '0',
    tq: ex ? String(ex.effect.torquePct) : '0',
    wt: ex?.weightDeltaLb.value != null ? String(ex.weightDeltaLb.value) : '0',
    needsTune: !!ex?.effect.needsTuneForFullGain,
  });
  const set = (k: keyof typeof f) => (e: Event) => {
    const t = e.target as HTMLInputElement;
    setF({ ...f, [k]: t.type === 'checkbox' ? t.checked : t.value });
  };
  const price = f.usd.trim() === '' ? null : num(f.usd);
  const nums = [num(f.labor), num(f.hp), num(f.tq), num(f.wt)];
  const valid = f.name.trim() !== '' && (price === null || (Number.isFinite(price) && price >= 0)) && nums.every(Number.isFinite) && num(f.labor) >= 0 && num(f.hp) > -100 && num(f.tq) > -100;

  const save = async () => {
    const p = makeCustomPart(
      { bikeId, category, name: f.name.trim(), brand: f.brand.trim() || 'Custom', usd: price, laborUsd: num(f.labor), hpPct: num(f.hp), torquePct: num(f.tq), weightDeltaLb: num(f.wt), needsTune: f.needsTune },
      ex?.id,
    );
    await saveCustomPart(p);
    await onSaved(p);
    onClose();
  };

  const field = (label: string, k: keyof typeof f, type: 'text' | 'number', hint?: string) => (
    <label class="spread" style={{ marginBottom: 10 }}>
      <span>{label}{hint && <div class="flag">{hint}</div>}</span>
      {type === 'text'
        ? <input type="text" value={f[k] as string} onInput={set(k)} style={{ width: 190 }} />
        : <input type="number" inputMode="decimal" value={f[k] as string} onInput={set(k)} style={{ width: 110 }} />}
    </label>
  );

  return (
    <div class="scrim" onClick={onClose}>
      <div class="sheet" role="dialog" aria-label="Custom part" onClick={(e) => e.stopPropagation()}>
        <div class="spread">
          <h2 style={{ margin: '0 0 12px' }}>{ex ? 'Edit' : 'Add'} custom {categoryLabel.toLowerCase()}</h2>
          <button class="btn ghost" onClick={onClose}>Cancel</button>
        </div>
        {field('Name', 'name', 'text')}
        {field('Brand', 'brand', 'text')}
        {field('Price ($)', 'usd', 'number', 'Leave empty if unknown')}
        {field('Labor ($)', 'labor', 'number')}
        {field('Power gain (%)', 'hp', 'number')}
        {field('Torque gain (%)', 'tq', 'number')}
        {field('Weight change (lb)', 'wt', 'number', 'Negative = lighter')}
        <label class="switch">
          Needs a tune for full gain
          <input type="checkbox" checked={f.needsTune} onChange={set('needsTune')} />
        </label>
        <p class="flag">Your own numbers; results using this part show est.</p>
        <button class="btn block" disabled={!valid} onClick={save}>Save part</button>
      </div>
    </div>
  );
}
