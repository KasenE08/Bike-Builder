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
