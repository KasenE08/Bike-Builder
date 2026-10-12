// On-device storage (IndexedDB): saved builds and settings. Nothing leaves the phone.
import { openDB, type DBSchema, type IDBPDatabase } from 'idb';
import type { Category } from '../data/types';

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

export const DEFAULT_SETTINGS: Settings = { riderLb: 155 };

interface Schema extends DBSchema {
  builds: { key: string; value: SavedBuild };
  settings: { key: string; value: Settings };
}

let dbp: Promise<IDBPDatabase<Schema>> | null = null;
const db = () =>
  (dbp ??= openDB<Schema>('bike-builder', 1, {
    upgrade(d) {
      d.createObjectStore('builds', { keyPath: 'id' });
      d.createObjectStore('settings');
    },
  }));

export const listBuilds = async () => (await (await db()).getAll('builds')).sort((a, b) => b.updatedAt - a.updatedAt);
export const getBuild = async (id: string) => (await db()).get('builds', id);
export const saveBuild = async (b: SavedBuild) => { await (await db()).put('builds', { ...b, updatedAt: Date.now() }); };
export const deleteBuild = async (id: string) => { await (await db()).delete('builds', id); };
export const getSettings = async (): Promise<Settings> => ({ ...DEFAULT_SETTINGS, ...((await (await db()).get('settings', 'main')) ?? {}) });
export const saveSettings = async (s: Settings) => { await (await db()).put('settings', s, 'main'); };

export function newBuild(bikeId: string, name: string): SavedBuild {
  const now = Date.now();
  return { id: `b${now.toString(36)}${Math.random().toString(36).slice(2, 6)}`, name, bikeId, picks: {}, createdAt: now, updatedAt: now };
}
