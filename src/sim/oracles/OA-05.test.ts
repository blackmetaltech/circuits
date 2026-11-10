import { describe, expect, it } from 'vitest';
import { tranCards } from './tranUtil';
import { acCards, mag, nearDeg, phaseDeg } from './acUtil';
import { near } from './util';
import { dcAmp } from './oaUtil';
const NET = 'R1 in inv 10k\nC1 out inv 10n\nRdc out inv 100meg\nU1 0 inv out vp vn ideal';
describe('OA-05 integrator 10k, 10 nF (ideal macro)', () => {
  it('0.5 V step: V(1 ms) = −5.000 V within 0.5 % (dt 1 µs)', () => {
    const r = tranCards(dcAmp('V1 in 0 0.5\n' + NET), { h: 1e-6, tStop: 1e-3, probes: ['v(out)'] });
    near(r.at('v(out)', 1e-3), -5, 5e-3);
  });
  it('|H(1 kHz)| 1.5915 at +90°', () => {
    const h = acCards(dcAmp('V1 in 0 0 ac 1\n' + NET)).solve(1000).transfer('out', 'in');
    near(mag(h), 1.5915, 1e-3); nearDeg(phaseDeg(h), 90, 0.3);
    expect(true).toBe(true);
  });
});
