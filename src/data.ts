import type { Bike, Part } from './types';

// Drop a JSON file into /data/bikes or /data/parts and it is picked up automatically.
const bikeFiles = import.meta.glob<Bike>('../data/bikes/*.json', { eager: true, import: 'default' });
const partFiles = import.meta.glob<Part[]>('../data/parts/*.json', { eager: true, import: 'default' });

export const bikes: Bike[] = Object.values(bikeFiles).sort((a, b) =>
  `${a.make} ${a.model}`.localeCompare(`${b.make} ${b.model}`),
);
export const parts: Part[] = Object.values(partFiles).flat();
