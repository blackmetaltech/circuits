import { describe, it } from 'vitest';
import { dmath } from '@core/numerics';
import { near } from './util';
import { crossing, tranCards } from './tranUtil';
describe('CAP-06 [NCERT XII ch7 / Hayt ch8 style] RL step: 12 V, 6 Ω, 0.3 H', () => {
  it('τ 50 ms; I(τ) 1.2642 A; t(1.5 A) 69.315 ms; I∞ 2 A', () => {
    const tau = 0.3 / 6;
    const s = tranCards('V1 in 0 12\nR1 in x 6\nL1 x 0 0.3', { h: tau / 200, tStop: 12 * tau, probes: ['i(L1)'] });
    near(tau, 0.05, 1e-12);
    near(s.at('i(L1)', tau), 2 * (1 - dmath.exp(-1)), 5e-3); near(s.at('i(L1)', tau), 1.2642, 5e-3);
    near(crossing(s.t, s.y('i(L1)'), 1.5), 69.315e-3, 5e-3);
    near(s.at('i(L1)', 12 * tau), 2, 5e-3);
  });
});
