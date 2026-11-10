import { describe, it } from 'vitest';
import { near } from './util';
import { acCards, mag, nearDeg, phaseDeg } from './acUtil';
describe('AC-06 100 V rms 50 Hz; 10 Ω + 31.831 mH', () => {
  it('|Z| 14.142; I 7.0711; lag 45.000°; P 500 W; S 707.11 VA', () => {
    const sol = acCards('V1 in 0 0 ac 141.4213562\nR1 in a 10\nL1 a 0 31.831m').solve(50);
    const i = sol.i('R1'), irms = mag(i) / Math.SQRT2;
    near(100 / irms, 14.142); near(irms, 7.0711); nearDeg(phaseDeg(i), -45);
    near(irms * irms * 10, 500); near(100 * irms, 707.11);
  });
});
