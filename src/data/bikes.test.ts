import { describe, it, expect } from 'vitest';
import { bikes } from './bikes';

const statKeys = ['msrp', 'hp', 'torqueLbFt', 'wetWeightLb', 'topSpeedMph', 'zeroTo60S', 'sixtyTo150S', 'zeroTo150S'] as const;

describe('bike data', () => {
  it('loads all 12 v1 bikes', () => expect(bikes).toHaveLength(12));

  for (const b of bikes) {
    describe(b.id, () => {
      it('every stat has a source and date', () => {
        for (const k of statKeys) {
          expect(b[k].source, k).toBeTruthy();
          expect(b[k].checked, k).toMatch(/^\d{4}-\d{2}-\d{2}$/);
        }
      });

      it('150 mph figures are N/A exactly when top speed < 150', () => {
        const cant = b.topSpeedMph.value! < 150;
        expect(b.sixtyTo150S.value === null).toBe(cant);
        expect(b.zeroTo150S.value === null).toBe(cant);
      });

      it('6th gear at redline is at least the top speed', () => {
        const g = b.gearing;
        const overall = g.primaryRatio * g.gearRatios.at(-1)! * (g.rearSprocket / g.frontSprocket);
        const mph = (g.redlineRpm / overall) * Math.PI * g.rearTireDiameterIn * 60 / 63360;
        expect(mph).toBeGreaterThanOrEqual(b.topSpeedMph.value!);
      });
    });
  }
});
