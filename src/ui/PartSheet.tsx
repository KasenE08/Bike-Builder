import { useState } from 'preact/hooks';
import type { Part } from '../data/types';
import { clearPriceEdit, deleteCustomPart, setPriceEdit } from '../store/db';
import { Est } from './Stats';
import { daysSince, isOutdated, usd } from './format';
import { userPrice } from './model';

interface Props {
  part: Part;
  onClose: () => void;
  onUserDataChanged: () => Promise<void>;
  onEditCustom: (p: Part) => void;
}

export function PartSheet({ part, onClose, onUserDataChanged, onEditCustom }: Props) {
  const p = part.price, e = part.effect, w = part.weightDeltaLb;
  const isCustom = part.tier === 'custom';
  const mine = userPrice(part.id);
  const [draft, setDraft] = useState(mine != null ? String(mine) : '');
  const n = Number(draft);
  const valid = draft.trim() !== '' && Number.isFinite(n) && n >= 0;

  const savePrice = async () => { await setPriceEdit(part.id, Math.round(n * 100) / 100); await onUserDataChanged(); };
  const resetPrice = async () => { await clearPriceEdit(part.id); setDraft(''); await onUserDataChanged(); };
  const remove = async () => {
    if (!confirm(`Delete custom part "${part.name}"? Builds using it go back to stock for this category.`)) return;
    await deleteCustomPart(part.id);
    await onUserDataChanged();
    onClose();
  };

  return (
    <div class="scrim" onClick={onClose}>
      <div class="sheet" role="dialog" aria-label={part.name} onClick={(ev) => ev.stopPropagation()}>
        <div class="spread">
          <div>
            <div class="muted small">{part.brand} · {part.tier}</div>
            <h2 style={{ margin: '2px 0 12px' }}>{part.name}</h2>
          </div>
          <button class="btn ghost" onClick={onClose}>Done</button>
        </div>
        <dl>
          <dt>Price</dt>
          <dd>
            {isCustom ? (
              <>{p.usd == null ? 'No price' : usd(p.usd)} (your number)</>
            ) : (
              <>
                {mine != null && <div><strong>{usd(mine)}</strong> your price</div>}
                <div class={mine != null ? 'muted small' : ''}>
                  {p.usd == null ? 'Price not found' : `${usd(p.usd)} listed`} · checked {p.checked} ({daysSince(p.checked)} days ago)
                </div>
                {isOutdated(p.checked) && <div class="flag">Price may be outdated</div>}
                {p.note && <div class="flag">{p.note}</div>}
              </>
            )}
          </dd>
          {!isCustom && (<><dt>Listing</dt><dd><a href={p.source} target="_blank" rel="noopener noreferrer">{new URL(p.source).hostname.replace(/^www\./, '')}</a></dd></>)}
          {part.labor && (<><dt>Labor</dt><dd>{usd(part.labor.usd)}{part.labor.hours ? ` (${part.labor.hours} h)` : ''}{part.labor.est && <Est />}<div class="flag">{part.labor.source}</div></dd></>)}
          <dt>Gain</dt>
          <dd>
            {e.hpPct || e.torquePct ? `+${e.hpPct}% hp, +${e.torquePct}% torque` : 'No power change'}
            {e.est && <Est />}
            {e.needsTuneForFullGain && <div class="flag">Full gain needs an ECU tune (half without).</div>}
            {e.shiftTimeS != null && <div class="flag">Shift time {e.shiftTimeS}s</div>}
            <div class="flag">{e.basis}</div>
          </dd>
          <dt>Weight</dt>
          <dd>{w.value! > 0 ? '+' : ''}{w.value} lb{w.est && <Est />}<div class="flag">{w.source}</div></dd>
          <dt>Street legal</dt>
          <dd>{isCustom ? part.streetLegalReason : `${part.streetLegal ? 'Yes' : 'No'} — ${part.streetLegalReason}`}</dd>
          {part.limiterRemovable && (<><dt>Limiter</dt><dd>Can remove the factory speed limiter</dd></>)}
          {part.requires?.length ? (<><dt>Needs</dt><dd>{part.requires.join(', ')}</dd></>) : null}
        </dl>

        {isCustom ? (
          <div class="row" style={{ marginTop: 16 }}>
            <button class="btn" onClick={() => onEditCustom(part)}>Edit part</button>
            <button class="btn ghost" onClick={remove}>Delete part</button>
          </div>
        ) : (
          <div style={{ marginTop: 16 }}>
            <label class="spread">
              <span>Your price ($)</span>
              <input type="number" inputMode="decimal" min={0} step="0.01" value={draft} placeholder={p.usd != null ? String(p.usd) : ''} onInput={(ev) => setDraft((ev.target as HTMLInputElement).value)} style={{ width: 120 }} />
            </label>
            <div class="row" style={{ marginTop: 8 }}>
              <button class="btn" disabled={!valid || n === mine} onClick={savePrice}>Use my price</button>
              {mine != null && <button class="btn ghost" onClick={resetPrice}>Reset to listed price</button>}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
