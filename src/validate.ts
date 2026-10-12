import type { Bike, Part, Sourced } from './types';

const isoDate = /^\d{4}-\d{2}-\d{2}$/;

function checkSourced(where: string, s: Sourced | undefined, errors: string[]) {
  if (!s) return errors.push(`${where}: missing`);
  if (s.value !== null && !s.est && !s.source) errors.push(`${where}: published value needs a source`);
  if (s.est && !s.note && !s.source) errors.push(`${where}: estimate needs a note explaining it`);
}

export function validateBike(b: Bike): string[] {
  const e: string[] = [];
  const w = `bike ${b.id}`;
  if (!/^[a-z0-9-]+$/.test(b.id)) e.push(`${w}: id must be kebab-case`);
  if (!b.streetLegal && !b.streetLegalReason) e.push(`${w}: not street legal needs a reason`);
  checkSourced(`${w} msrp`, b.msrp, e);
  if (b.msrp.checked && !isoDate.test(b.msrp.checked)) e.push(`${w} msrp: checked must be YYYY-MM-DD`);
  for (const k of ['hp', 'torque', 'wetWeight', 'topSpeed', 'zeroTo60', 'sixtyTo150', 'zeroTo150', 'displacement'] as const) {
    checkSourced(`${w} ${k}`, b.stats[k], e);
  }
  return e;
}

export function validatePart(p: Part, bikeIds: Set<string>): string[] {
  const e: string[] = [];
  const w = `part ${p.id}`;
  if (p.priceUsd === null && !p.needsPrice) e.push(`${w}: no price must set needsPrice`);
  if (p.priceUsd !== null && (!p.priceSource || !p.priceChecked)) e.push(`${w}: price needs source and date`);
  if (p.priceChecked && !isoDate.test(p.priceChecked)) e.push(`${w}: priceChecked must be YYYY-MM-DD`);
  if (!p.streetLegal && !p.streetLegalReason) e.push(`${w}: not street legal needs a reason`);
  if (!p.assumption) e.push(`${w}: missing assumption`);
  if (!p.productUrl) e.push(`${w}: missing productUrl`);
  if (p.fits !== 'all') for (const id of p.fits) if (!bikeIds.has(id)) e.push(`${w}: unknown bike ${id}`);
  return e;
}
