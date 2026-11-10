import { describe, it } from 'vitest';
import { near } from './util';
import { acCards, mag, nearDeg, phaseDeg } from './acUtil';
describe('AC-03 110 V rms 60 Hz across 60 µF', () => {
  it('XC 44.210 Ω; Irms 2.4881 A; lead 90.00°', () => {
    const sol = acCards('V1 in 0 0 ac 155.5634919\nC1 in 0 60u').solve(60);
    const i = sol.i('C1');
    near(1 / (2 * Math.PI * 60 * 60e-6), 44.21); near(mag(i) / Math.SQRT2, 2.4881);
    nearDeg(phaseDeg(i), 90);
  });
});
