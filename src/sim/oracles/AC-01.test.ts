import { describe, it } from 'vitest';
import { near } from './util';
import { acCards, mag } from './acUtil';
describe('AC-01 [NCERT ch7 style] 311.127 V pk 50 Hz across 100 Ω', () => {
  it('Irms 2.2000 A; Ipk 3.1113 A; P 484.00 W', () => {
    const sol = acCards('V1 in 0 0 ac 311.127\nR1 in 0 100').solve(50);
    const ipk = mag(sol.i('V1'));
    near(ipk, 3.1113); near(ipk / Math.SQRT2, 2.2); near(0.5 * 311.127 * ipk, 484.0);
  });
});
