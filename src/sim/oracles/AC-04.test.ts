import { describe, it } from 'vitest';
import { near } from './util';
import { acCards, mag, nearDeg, phaseDeg } from './acUtil';
describe('AC-04 100 V rms 50 Hz; series 30 Ω, 0.127324 H, 39.789 µF', () => {
  it('|Z| 50; I 2.0000; lead 53.130°; VL 80; VC 160; PF 0.6; P 120 W', () => {
    const vpk = 100 * Math.SQRT2;
    const sol = acCards(`V1 in 0 0 ac ${vpk}\nR1 in a 30\nL1 a b 0.127324\nC1 b 0 39.789u`).solve(50);
    const i = sol.i('R1');                      // current into R1 from the source side
    const irms = mag(i) / Math.SQRT2;
    near(100 / irms, 50); near(irms, 2);
    nearDeg(phaseDeg(i), 53.13);
    near(mag(sol.vd('a', 'b')) / Math.SQRT2, 80); near(mag(sol.v('b')) / Math.SQRT2, 160);
    near(Math.cos(phaseDeg(i) / 180 * Math.PI), 0.6);
    near(irms * irms * 30, 120);
  });
});
