import { useState } from 'preact/hooks';
import { saveSettings, type Settings } from '../store/db';

export function SettingsPage({ settings, onSaved }: { settings: Settings; onSaved: (s: Settings) => void }) {
  const [rider, setRider] = useState(String(settings.riderLb));
  const n = Number(rider);
  const valid = Number.isFinite(n) && n >= 80 && n <= 400;
  const save = async () => {
    const s = { ...settings, riderLb: Math.round(n) };
    await saveSettings(s);
    onSaved(s);
  };
  return (
    <main>
      <h1>Settings</h1>
      <label class="spread">
        <span>Rider weight (lb, with gear)</span>
        <input type="number" inputMode="numeric" min={80} max={400} value={rider} onInput={(e) => setRider((e.target as HTMLInputElement).value)} style={{ width: 100 }} />
      </label>
      <p class="muted small">Used for every build. Published test numbers use ~180 lb riders, so a lighter rider is quicker.</p>
      <button class="btn block" disabled={!valid || n === settings.riderLb} onClick={save}>Save</button>
      <p class="muted small" style={{ marginTop: 24 }}>Builds and settings are stored only on this device.</p>
    </main>
  );
}
