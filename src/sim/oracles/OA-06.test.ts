import { describe, it } from 'vitest';
import { acCards, mag, nearDeg, phaseDeg } from './acUtil';
import { near } from './util';
import { dcAmp } from './oaUtil';
describe('OA-06 inverting low-pass 10k in, 100k ∥ 1.6 nF (ideal macro)', () => {
  it('fc 994.72 Hz; DC gain −10; |H(fc)| 7.0711 at 135°; |H(10fc)| 0.9950', () => {
    const ac = acCards(dcAmp('V1 in 0 0 ac 1\nR1 in inv 10k\nRf out inv 100k\nCf out inv 1.6n\nU1 0 inv out vp vn ideal'));
    const fc = 1 / (2 * Math.PI * 100e3 * 1.6e-9);
    near(fc, 994.72, 1e-5);
    const h0 = ac.solve(1e-3).transfer('out', 'in');
    near(h0.re, -10, 1e-4);
    const h = ac.solve(fc).transfer('out', 'in');
    near(mag(h), 7.0711, 1e-3); nearDeg(phaseDeg(h), 135, 0.3);
    near(mag(ac.solve(10 * fc).transfer('out', 'in')), 0.995, 1e-3);
  });
});
