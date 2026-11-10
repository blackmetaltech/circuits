import { describe, it } from 'vitest';
import { near } from './util';
import { acCards, mag, nearDeg, phaseDeg } from './acUtil';
describe('FI-02 RC high-pass 100 nF, 1 kΩ at 500 Hz', () => {
  it('|H| 0.29972 (−10.466 dB); +72.56°', () => {
    const h = acCards('V1 in 0 0 ac 1\nC1 in out 100n\nR1 out 0 1k').solve(500).transfer('out', 'in');
    near(mag(h), 0.29972); near(20 * Math.log10(mag(h)), -10.466, 1e-3); nearDeg(phaseDeg(h), 72.56);
  });
});
