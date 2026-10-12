import type { Part } from '../data/types';
import { Est } from './Stats';
import { daysSince, isOutdated, usd } from './format';

export function PartSheet({ part, onClose }: { part: Part; onClose: () => void }) {
  const p = part.price, e = part.effect, w = part.weightDeltaLb;
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
            {p.usd == null ? 'Price not found' : usd(p.usd)} · checked {p.checked} ({daysSince(p.checked)} days ago)
            {isOutdated(p.checked) && <div class="flag">Price may be outdated</div>}
            {p.note && <div class="flag">{p.note}</div>}
          </dd>
          <dt>Listing</dt>
          <dd><a href={p.source} target="_blank" rel="noopener noreferrer">{new URL(p.source).hostname.replace(/^www\./, '')}</a></dd>
          {part.labor && (<><dt>Labor</dt><dd>{usd(part.labor.usd)} ({part.labor.hours} h){part.labor.est && <Est />}<div class="flag">{part.labor.source}</div></dd></>)}
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
          <dd>{part.streetLegal ? 'Yes' : 'No'} — {part.streetLegalReason}</dd>
          {part.limiterRemovable && (<><dt>Limiter</dt><dd>Can remove the factory speed limiter</dd></>)}
          {part.requires?.length ? (<><dt>Needs</dt><dd>{part.requires.join(', ')}</dd></>) : null}
        </dl>
      </div>
    </div>
  );
}
