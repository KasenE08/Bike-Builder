import type { Bike } from './types';

const files = import.meta.glob<Bike>('../../data/bikes/*.json', { eager: true, import: 'default' });

/** Catalog bikes (real, sourced data). */
export const bikes: Bike[] = Object.values(files).sort((a, b) => a.msrp.value! - b.msrp.value!);

// The owner's KE1000 (built from on-device specs; App sets it at startup and after every edit).
let customBike: Bike | null = null;
export const setCustomBike = (b: Bike | null) => { customBike = b; };
export const getCustomBike = () => customBike;
/** Catalog bikes plus the owner's KE1000. */
export const allBikes = (): Bike[] => (customBike ? [customBike, ...bikes] : bikes);
export const bikeById = (id: string) => (customBike?.id === id ? customBike : bikes.find((b) => b.id === id));
