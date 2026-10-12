// Usage: node scripts/calibrate.ts  — writes `calibration` into every data/bikes/*.json.
import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { calibrate } from '../src/engine/calibrate.ts';

const dir = new URL('../data/bikes/', import.meta.url);
for (const f of readdirSync(dir).filter((x) => x.endsWith('.json'))) {
  const url = new URL(f, dir);
  const bike = JSON.parse(readFileSync(url, 'utf8'));
  bike.calibration = calibrate(bike);
  writeFileSync(url, JSON.stringify(bike, null, 2) + '\n');
  console.log(bike.id.padEnd(22), bike.calibration.cdA, bike.calibration.launchG, bike.calibration.est ? 'EST' : '   ', bike.calibration.fit);
}
