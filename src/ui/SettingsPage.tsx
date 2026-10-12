import { useState } from 'preact/hooks';
import { exportBackup, parseBackup, restoreBackup, saveSettings, type Settings } from '../store/db';

interface Props {
  settings: Settings;
  onSaved: (s: Settings) => void;
  onRestored: () => Promise<void>;
}

export function SettingsPage({ settings, onSaved, onRestored }: Props) {
  const [rider, setRider] = useState(String(settings.riderLb));
  const [msg, setMsg] = useState('');
  const n = Number(rider);
  const valid = Number.isFinite(n) && n >= 80 && n <= 400;
  const save = async () => {
    const s = { ...settings, riderLb: Math.round(n) };
    await saveSettings(s);
    onSaved(s);
  };

  const backup = async () => {
    const data = await exportBackup();
    const name = `bike-builder-${data.exportedAt.slice(0, 10)}.bikebuilder-backup.json`;
    const file = new File([JSON.stringify(data, null, 2)], name, { type: 'application/json' });
    // iPhone: the share sheet offers "Save to Files". Fallback: plain download.
    if (navigator.canShare?.({ files: [file] })) {
      try { await navigator.share({ files: [file], title: 'Bike Builder backup' }); setMsg('Backup ready.'); return; }
      catch (e) { if ((e as Error).name === 'AbortError') return; }
    }
    const a = document.createElement('a');
    a.href = URL.createObjectURL(file);
    a.download = name;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
    setMsg('Backup downloaded.');
  };

  const restore = async (e: Event) => {
    const input = e.target as HTMLInputElement;
    const f = input.files?.[0];
    input.value = '';
    if (!f) return;
    try {
      const b = parseBackup(await f.text());
      if (!confirm(`Restore backup from ${b.exportedAt.slice(0, 10)}? This replaces all builds, your prices and custom parts on this phone.`)) return;
      await restoreBackup(b);
      await onRestored();
      setRider(String(b.settings.riderLb ?? settings.riderLb));
      setMsg(`Restored ${b.builds.length} build(s).`);
    } catch (err) {
      setMsg((err as Error).message);
    }
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

      <h2>Backup</h2>
      <p class="muted small">Builds, your prices and custom parts are stored only on this phone. Save a backup to Files now and then.</p>
      <button class="btn block" onClick={backup}>Save backup</button>
      <label class="btn ghost block" style={{ display: 'block', textAlign: 'center', marginTop: 8 }}>
        Restore from backup…
        <input type="file" accept="application/json,.json" onChange={restore} style={{ display: 'none' }} />
      </label>
      {msg && <p class="small" role="status">{msg}</p>}
    </main>
  );
}
