import { useState } from 'preact/hooks';
import { DEFAULT_KE, KE_LIMITS, keBike, keErrors, keWarnings, type KeSpec } from '../data/ke1000';
import { calibrate } from '../engine/calibrate';
import { resetKe, saveKe } from '../store/db';

type Key = Exclude<keyof KeSpec, 'gearRatios' | 'calibration'>;
interface Field { key: Key; label: string; step?: string; optional?: boolean }

const GROUPS: { title: string; note?: string; fields: Field[] }[] = [
  {
    title: 'Engine',
    note: 'Redline, idle, displacement, hp and torque also shape the sound.',
    fields: [
      { key: 'displacementCc', label: 'Displacement (cc)' },
      { key: 'hp', label: 'Horsepower (crank)' },
      { key: 'peakHpRpm', label: 'Peak hp at (rpm)' },
      { key: 'torqueLbFt', label: 'Torque (lb-ft)' },
      { key: 'peakTorqueRpm', label: 'Peak torque at (rpm)' },
      { key: 'redlineRpm', label: 'Redline (rpm)' },
      { key: 'idleRpm', label: 'Idle (rpm)' },
    ],
  },
  {
    title: 'Performance',
    note: 'Stock KE1000 shows exactly these. Mods change them using the physics model.',
    fields: [
      { key: 'wetWeightLb', label: 'Weight, ready to ride (lb)' },
      { key: 'topSpeedMph', label: 'Top speed (mph)' },
      { key: 'zeroTo60S', label: '0–60 (s)', step: '0.01' },
      { key: 'zeroTo150S', label: '0–150 (s)', step: '0.01', optional: true },
    ],
  },
  {
    title: 'Gearing',
    fields: [
      { key: 'primaryRatio', label: 'Primary ratio', step: '0.001' },
      { key: 'frontSprocket', label: 'Front sprocket (teeth)' },
      { key: 'rearSprocket', label: 'Rear sprocket (teeth)' },
      { key: 'rearTireDiameterIn', label: 'Rear tire diameter (in)', step: '0.01' },
      { key: 'shiftTimeS', label: 'Shift time (s, 0.06 = quickshifter)', step: '0.01' },
    ],
  },
  { title: 'Price', fields: [{ key: 'msrpUsd', label: 'Your price ($)', optional: true }] },
];

const toStr = (v: number | null | undefined) => (v == null ? '' : String(v));
const fmt = (n: number) => n.toLocaleString('en-US');
/** "min–max" shown under each field. */
const Range = ({ k }: { k: keyof typeof KE_LIMITS }) => <span class="muted small" style={{ display: 'block' }}>{fmt(KE_LIMITS[k][0])}–{fmt(KE_LIMITS[k][1])}</span>;
const num = (s: string) => (s.trim() === '' ? null : Number(s));

export function KeSpecPage({ initial, onSaved }: { initial: KeSpec; onSaved: () => Promise<void> }) {
  const [f, setF] = useState<Record<string, string>>(() => {
    const o: Record<string, string> = {};
    for (const g of GROUPS) for (const x of g.fields) o[x.key] = toStr(initial[x.key] as number | null);
    initial.gearRatios.forEach((r, i) => { o[`g${i}`] = String(r); });
    return o;
  });
  const [busy, setBusy] = useState(false);

  const spec: KeSpec = {
    ...initial,
    ...Object.fromEntries(GROUPS.flatMap((g) => g.fields.map((x) => [x.key, num(f[x.key])]))),
    gearRatios: [0, 1, 2, 3, 4, 5].map((i) => num(f[`g${i}`]) ?? NaN),
    calibration: undefined,
  } as KeSpec;
  if (spec.topSpeedMph != null && spec.topSpeedMph < 150) spec.zeroTo150S = null;
  const errors = keErrors(spec);
  const warnings = errors.length ? [] : keWarnings(spec);
  const set = (k: string) => (e: Event) => setF({ ...f, [k]: (e.target as HTMLInputElement).value });

  const save = () => {
    setBusy(true);
    // Fitting the physics to the new numbers takes a second or two; let "Saving…" paint first.
    setTimeout(async () => {
      const calibration = calibrate(keBike(spec), true);
      await saveKe({ ...spec, calibration });
      await onSaved();
      setBusy(false);
      history.back();
    }, 30);
  };
  const reset = async () => {
    if (!confirm('Reset every KE1000 value to the defaults?')) return;
    await resetKe();
    await onSaved();
    history.back();
  };

  const input = (k: string, step = '1', label: string, [min, max]: readonly [number, number]) => (
    <input type="number" inputMode="decimal" step={step} min={min} max={max} value={f[k]} aria-label={label} onInput={set(k)} style={{ width: '110px', flex: '0 0 110px', textAlign: 'right' }} />
  );

  return (
    <main>
      <button class="btn ghost" onClick={() => history.back()}>‹ Back</button>
      <h1>KE1000 specs</h1>
      <p class="muted small">Your own bike: a 1000-class inline-6 screamer on an open race pipe. Every number below is yours.</p>
      {GROUPS.map((g) => (
        <section key={g.title}>
          <h2>{g.title}</h2>
          {g.note && <p class="muted small">{g.note}</p>}
          {g.fields.map((x) => (
            <label key={x.key} class="spread" style={{ marginBottom: '8px' }}>
              <span>{x.label}{x.optional && <span class="muted small"> (optional)</span>}<Range k={x.key} /></span>
              {input(x.key, x.step, x.label, KE_LIMITS[x.key])}
            </label>
          ))}
          {g.title === 'Performance' && spec.zeroTo150S != null && spec.zeroTo60S != null && (
            <p class="muted small">60–150: {(spec.zeroTo150S - spec.zeroTo60S).toFixed(2)} s</p>
          )}
          {g.title === 'Gearing' && (
            <>
              {[0, 1, 2, 3, 4, 5].map((i) => (
                <label key={i} class="spread" style={{ marginBottom: '8px' }}>
                  <span>Gear {i + 1} ratio<Range k="gearRatio" /></span>
                  {input(`g${i}`, '0.001', `Gear ${i + 1} ratio`, KE_LIMITS.gearRatio)}
                </label>
              ))}
            </>
          )}
        </section>
      ))}
      {errors.length > 0 && <div class="flag" role="alert">{errors.map((e) => <div key={e}>{e}</div>)}</div>}
      {warnings.map((w) => <p key={w} class="muted small">{w}</p>)}
      <button class="btn block" disabled={busy || errors.length > 0} onClick={save}>{busy ? 'Saving…' : 'Save'}</button>
      <button class="btn ghost block" style={{ marginTop: 8 }} onClick={reset}>Reset to defaults</button>
      <p class="muted small">Defaults: {DEFAULT_KE.hp} hp, {DEFAULT_KE.redlineRpm.toLocaleString('en-US')} rpm redline, {DEFAULT_KE.topSpeedMph} mph.</p>
    </main>
  );
}
