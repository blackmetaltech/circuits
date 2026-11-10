import { describe, expect, it } from 'vitest';
import { near } from './util';
import { integrate, tranCards } from './tranUtil';
// 4 µF at 100 V connected through R to 6 µF at 0 V: final voltage and energy lost in R are independent of R.
describe('CAP-02 [NCERT XII ch2 / Halliday ch25] charge sharing between two capacitors', () => {
  for (const R of [1, 10, 100]) {
    it(`R = ${R} Ω: Vf 40 V, loss 12 mJ in R (energy ledger), τ = R·2.4 µF`, () => {
      const tau = R * 2.4e-6;
      const s = tranCards(`C1 a 0 4u\nR1 a b ${R}\nC2 b 0 6u`, { h: tau / 200, tStop: 15 * tau, ic: { C1: 100, C2: 0 }, probes: ['v(a)', 'v(b)', 'p(R1)'] });
      near(s.y('v(a)')[0], 100, 1e-6);
      near(s.at('v(a)', 15 * tau), 40, 5e-3); near(s.at('v(b)', 15 * tau), 40, 5e-3);
      near(integrate(s.t, s.y('p(R1)')), 12e-3, 5e-3);
      // ledger: ½C1·100² − (½C1 + ½C2)·Vf² = 20 mJ − 8 mJ
      expect(0.5 * 4e-6 * 1e4 - 0.5 * 10e-6 * 1600).toBeCloseTo(12e-3, 12);
      // τ: v(a) − v(b) starts at 100 V and falls by 1/e in τ
      near(s.at('v(a)', tau) - s.at('v(b)', tau), 100 / Math.E, 5e-3);
    });
  }
});
