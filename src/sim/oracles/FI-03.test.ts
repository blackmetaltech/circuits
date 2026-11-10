import { describe, it } from 'vitest';
import { near } from './util';
import { acCards, mag, nearDeg, phaseDeg } from './acUtil';
import { dcAmp } from './oaUtil';
describe('FI-03 Sallen-Key low-pass unity gain, 10k/10k, C1 20 nF, C2 10 nF', () => {
  it('fc 1125.4 Hz; Q 0.70711; |H(fc)| 0.70711 at −90°; |H(10fc)| −40.00 dB', () => {
    const ac = acCards(dcAmp('V1 in 0 0 ac 1\nR1 in a 10k\nR2 a p 10k\nC1 a out 20n\nC2 p 0 10n\nU1 p out out vp vn ideal'));
    const fc = 1 / (2 * Math.PI * Math.sqrt(10e3 * 10e3 * 20e-9 * 10e-9));
    near(fc, 1125.4, 1e-4);
    near(Math.sqrt(20e-9 / 10e-9) / 2, 0.70711, 1e-4);          // Q of the unity-gain stage
    const h = ac.solve(fc).transfer('out', 'in');
    near(mag(h), 0.70711, 1e-3); nearDeg(phaseDeg(h), -90, 0.3);
    near(20 * Math.log10(mag(ac.solve(10 * fc).transfer('out', 'in'))), -40.0, 1e-3);
  });
});
