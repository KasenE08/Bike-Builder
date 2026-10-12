// On-device storage (IndexedDB): builds, settings, price edits, custom parts. Nothing leaves the phone.
import { openDB, type DBSchema, type IDBPDatabase } from 'idb';
import type { Category, Part } from '../data/types';

export interface SavedBuild {
  id: string;
  name: string;
  bikeId: string;
  picks: Partial<Record<Category, string>>; // category -> part id
  sprockets?: { front: number; rear: number };
  removeLimiter?: boolean;
  createdAt: number;
  updatedAt: number;
}

export interface Settings {
  riderLb: number;
}

/** Owner's own price for a catalog part. */
export interface PriceEdit {
  partId: string;
  usd: number;
  updatedAt: number;
}

export const DEFAULT_SETTINGS: Settings = { riderLb: 155 };

interface Schema extends DBSchema {
  builds: { key: string; value: SavedBuild };
  settings: { key: string; value: Settings };
  prices: { key: string; value: PriceEdit };
  customParts: { key: string; value: Part };
}

let dbp: Promise<IDBPDatabase<Schema>> | null = null;
const db = () =>
  (dbp ??= openDB<Schema>('bike-builder', 2, {
    upgrade(d, old) {
      if (old < 1) {
        d.createObjectStore('builds', { keyPath: 'id' });
        d.createObjectStore('settings');
      }
      if (old < 2) {
        d.createObjectStore('prices', { keyPath: 'partId' });
        d.createObjectStore('customParts', { keyPath: 'id' });
      }
    },
  }));

const uid = (p: string) => `${p}${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;

export const listBuilds = async () => (await (await db()).getAll('builds')).sort((a, b) => b.updatedAt - a.updatedAt);
export const getBuild = async (id: string) => (await db()).get('builds', id);
export const saveBuild = async (b: SavedBuild) => { await (await db()).put('builds', { ...b, updatedAt: Date.now() }); };
export const deleteBuild = async (id: string) => { await (await db()).delete('builds', id); };
export const getSettings = async (): Promise<Settings> => ({ ...DEFAULT_SETTINGS, ...((await (await db()).get('settings', 'main')) ?? {}) });
export const saveSettings = async (s: Settings) => { await (await db()).put('settings', s, 'main'); };

export const listPriceEdits = async () => (await db()).getAll('prices');
export const setPriceEdit = async (partId: string, usd: number) => { await (await db()).put('prices', { partId, usd, updatedAt: Date.now() }); };
export const clearPriceEdit = async (partId: string) => { await (await db()).delete('prices', partId); };

export const listCustomParts = async () => (await db()).getAll('customParts');
export const saveCustomPart = async (p: Part) => { await (await db()).put('customParts', p); };
export const deleteCustomPart = async (id: string) => { await (await db()).delete('customParts', id); };

export function newBuild(bikeId: string, name: string): SavedBuild {
  const now = Date.now();
  return { id: uid('b'), name, bikeId, picks: {}, createdAt: now, updatedAt: now };
}

export interface CustomPartInput {
  bikeId: string;
  category: Category;
  name: string;
  brand: string;
  usd: number | null;
  laborUsd: number;
  hpPct: number;
  torquePct: number;
  weightDeltaLb: number;
  needsTune: boolean;
}

/** Owner-made part. Everything about it is the owner's own number, so it is marked est. */
export function makeCustomPart(i: CustomPartInput, id = uid('c')): Part {
  const today = new Date().toISOString().slice(0, 10);
  return {
    id,
    category: i.category,
    tier: 'custom',
    name: i.name,
    brand: i.brand,
    fits: [i.bikeId],
    price: { usd: i.usd, source: 'custom', checked: today, note: 'Your own part' },
    labor: { usd: i.laborUsd, hours: 0, source: 'Your number', est: true },
    weightDeltaLb: { value: i.weightDeltaLb, est: true, source: 'Your number', checked: today },
    effect: {
      hpPct: i.hpPct,
      torquePct: i.torquePct,
      est: true,
      basis: 'Your numbers',
      ...(i.needsTune ? { needsTuneForFullGain: true } : {}),
    },
    streetLegal: true,
    streetLegalReason: 'Not checked (custom part)',
  };
}

// ---- Backup (export/import as a JSON file) ----
export interface Backup {
  app: 'bike-builder';
  version: 1;
  exportedAt: string;
  builds: SavedBuild[];
  settings: Settings;
  prices: PriceEdit[];
  customParts: Part[];
}

export async function exportBackup(): Promise<Backup> {
  return {
    app: 'bike-builder',
    version: 1,
    exportedAt: new Date().toISOString(),
    builds: await listBuilds(),
    settings: await getSettings(),
    prices: await listPriceEdits(),
    customParts: await listCustomParts(),
  };
}

export function parseBackup(text: string): Backup {
  const b = JSON.parse(text);
  if (b?.app !== 'bike-builder' || b.version !== 1 || !Array.isArray(b.builds) || !Array.isArray(b.prices) || !Array.isArray(b.customParts)) {
    throw new Error('Not a Bike Builder backup file');
  }
  return b as Backup;
}

/** Replaces everything on the device with the backup's contents. */
export async function restoreBackup(b: Backup) {
  const d = await db();
  const tx = d.transaction(['builds', 'settings', 'prices', 'customParts'], 'readwrite');
  await Promise.all([tx.objectStore('builds').clear(), tx.objectStore('prices').clear(), tx.objectStore('customParts').clear()]);
  await Promise.all([
    ...b.builds.map((x) => tx.objectStore('builds').put(x)),
    ...b.prices.map((x) => tx.objectStore('prices').put(x)),
    ...b.customParts.map((x) => tx.objectStore('customParts').put(x)),
    tx.objectStore('settings').put({ ...DEFAULT_SETTINGS, ...b.settings }, 'main'),
  ]);
  await tx.done;
}
