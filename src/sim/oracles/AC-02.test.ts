import { describe, it } from 'vitest';
import { near } from './util';
import { acCards, mag, nearDeg, phaseDeg } from './acUtil';
describe('AC-02 220 V rms 50 Hz across 44 mH', () => {
  it('XL 13.823 Ω; Irms 15.915 A; lag 90.00°; P 0', () => {
    const sol = acCards('V1 in 0 0 ac 311.1269837\nL1 in 0 44m').solve(50);
    const i = sol.i('L1');
    near(2 * Math.PI * 50 * 0.044, 13.823); near(mag(i) / Math.SQRT2, 15.915);
    nearDeg(phaseDeg(i), -90);
    // P = ½ Re(V·I*) with V real: Re(I) = 0
    near(Math.abs(0.5 * 311.1269837 * i.re) / (0.5 * 311.1269837 * mag(i)), 0, 1e-9);
  });
});
