import { describe, it } from 'vitest';
import { near } from './util';
import { acCards, mag, nearDeg, phaseDeg } from './acUtil';
describe('FI-01 RC low-pass 10 kΩ, 10 nF', () => {
  it('fc 1591.5 Hz; |H(fc)| 0.70711 at −45°; |H(10fc)| −20.04 dB', () => {
    const ac = acCards('V1 in 0 0 ac 1\nR1 in out 10k\nC1 out 0 10n');
    const fc = 1 / (2 * Math.PI * 10e3 * 10e-9);
    near(fc, 1591.5);
    const h = ac.solve(fc).transfer('out', 'in');
    near(mag(h), 0.70711); nearDeg(phaseDeg(h), -45);
    near(20 * Math.log10(mag(ac.solve(10 * fc).transfer('out', 'in'))), -20.04, 1e-3);
  });
});
