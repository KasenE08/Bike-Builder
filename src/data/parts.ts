import type { Part, PartGap } from './types';
import gapsJson from '../../data/parts/_gaps.json';

const files = import.meta.glob<Part[]>(['../../data/parts/*.json', '!../../data/parts/_*.json'], { eager: true, import: 'default' });

export const parts: Part[] = Object.values(files).flat();
export const gaps: PartGap[] = gapsJson as PartGap[];
export const partsFor = (bikeId: string) => parts.filter((p) => p.fits.includes(bikeId));
