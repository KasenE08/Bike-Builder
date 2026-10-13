import 'fake-indexeddb/auto';
import { describe, it, expect } from 'vitest';
import { deleteBuild, getBuild, getSettings, listBuilds, newBuild, saveBuild, saveSettings } from './db';

describe('on-device storage', () => {
  it('saves, lists newest first, loads and deletes builds', async () => {
    const a = newBuild('kawasaki-ninja-500', 'A');
    await saveBuild(a);
    await new Promise((r) => setTimeout(r, 2));
    const b = { ...newBuild('yamaha-r7', 'B'), picks: { exhaust: 'akrapovic-evolution-r7-2026' } };
    await saveBuild(b);
    expect((await listBuilds()).map((x) => x.name)).toEqual(['B', 'A']);
    expect((await getBuild(b.id))!.picks.exhaust).toBe('akrapovic-evolution-r7-2026');
    await deleteBuild(a.id);
    expect((await listBuilds()).map((x) => x.name)).toEqual(['B']);
  });

  it('settings default to a 155 lb rider and persist changes', async () => {
    expect((await getSettings()).riderLb).toBe(155);
    await saveSettings({ riderLb: 170 });
    expect((await getSettings()).riderLb).toBe(170);
  });
});

import { clearPriceEdit, deleteCustomPart, exportBackup, listCustomParts, listPriceEdits, makeCustomPart, parseBackup, restoreBackup, saveCustomPart, setPriceEdit } from './db';

describe('price edits, custom parts, backup', () => {
  it('stores and clears price edits and custom parts', async () => {
    await setPriceEdit('dna-filter-r7', 79);
    expect((await listPriceEdits()).map((p) => [p.partId, p.usd])).toEqual([['dna-filter-r7', 79]]);
    await clearPriceEdit('dna-filter-r7');
    expect(await listPriceEdits()).toEqual([]);
    const c = makeCustomPart({ bikeId: 'yamaha-r7', category: 'intake', name: 'Lid', brand: 'X', usd: 40, laborUsd: 0, hpPct: 1, torquePct: 1, weightDeltaLb: 0, needsTune: true });
    await saveCustomPart(c);
    expect((await listCustomParts())[0].effect.needsTuneForFullGain).toBe(true);
    await deleteCustomPart(c.id);
    expect(await listCustomParts()).toEqual([]);
  });

  it('backup round-trips and restore replaces everything', async () => {
    const b = newBuild('yamaha-r7', 'Backed up');
    await saveBuild(b);
    await setPriceEdit('dna-filter-r7', 80);
    const c = makeCustomPart({ bikeId: 'yamaha-r7', category: 'intake', name: 'Lid', brand: 'X', usd: 40, laborUsd: 0, hpPct: 1, torquePct: 1, weightDeltaLb: 0, needsTune: false });
    await saveCustomPart(c);
    await saveSettings({ riderLb: 160 });
    const file = JSON.stringify(await exportBackup());

    await saveBuild(newBuild('kawasaki-zx-4r', 'Made after backup'));
    await clearPriceEdit('dna-filter-r7');
    await restoreBackup(parseBackup(file));

    const names = (await listBuilds()).map((x) => x.name);
    expect(names).toContain('Backed up');
    expect(names).not.toContain('Made after backup');
    expect((await listPriceEdits())[0].usd).toBe(80);
    expect((await listCustomParts())[0].id).toBe(c.id);
    expect((await getSettings()).riderLb).toBe(160);
  });

  it('KE1000 specs default, persist, back up and restore', async () => {
    const { getKe, saveKe, resetKe } = await import('./db');
    expect((await getKe()).hp).toBe(260);
    await saveKe({ ...(await getKe()), hp: 300, redlineRpm: 19000 });
    expect((await getKe()).redlineRpm).toBe(19000);
    const file = JSON.stringify(await exportBackup());
    await resetKe();
    expect((await getKe()).hp).toBe(260);
    await restoreBackup(parseBackup(file));
    expect((await getKe()).hp).toBe(300);
    // An older backup without KE1000 specs restores the defaults.
    const old = { ...JSON.parse(file) }; delete old.ke1000;
    await restoreBackup(parseBackup(JSON.stringify(old)));
    expect((await getKe()).hp).toBe(260);
  });

  it('rejects files that are not backups', () => {
    expect(() => parseBackup('{"hello":1}')).toThrow(/Not a Bike Builder backup/);
  });
});
