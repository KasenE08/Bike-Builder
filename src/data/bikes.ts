import type { Bike } from './types';

const files = import.meta.glob<Bike>('../../data/bikes/*.json', { eager: true, import: 'default' });

export const bikes: Bike[] = Object.values(files).sort((a, b) => a.msrp.value! - b.msrp.value!);
export const bikeById = (id: string) => bikes.find((b) => b.id === id);
