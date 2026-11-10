import { describe, it } from 'vitest';
import { dmath } from '@core/numerics';
import { near } from './util';
import { tranCards } from './tranUtil';
describe('CAP-05 [Hayt & Kemmerly ch8 style] RC with a Thevenin source: 12 V, 2k, 4k, 1k, 10 µF', () => {
  it('V∞ 8 V; Q 80 µC; τ 23.333 ms; V(τ) 5.0570 V', () => {
    const tau = (2e3 * 4e3 / 6e3 + 1e3) * 10e-6;
    const s = tranCards('V1 in 0 12\nR1 in m 2k\nR2 m 0 4k\nR3 m c 1k\nC1 c 0 10u', { h: tau / 200, tStop: 12 * tau, probes: ['v(c)'] });
    near(tau, 23.333e-3, 1e-4);
    near(s.at('v(c)', 12 * tau), 8, 5e-3); near(10e-6 * s.at('v(c)', 12 * tau), 80e-6, 5e-3);
    near(s.at('v(c)', tau), 8 * (1 - dmath.exp(-1)), 5e-3); near(s.at('v(c)', tau), 5.0570, 5e-3);
  });
});
