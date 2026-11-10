import { describe, it } from 'vitest';
import { dmath } from '@core/numerics';
import { near } from './util';
import { integrate, tranCards } from './tranUtil';
describe('CAP-07 [Hayt & Kemmerly ch8 style] source-free RL: 0.5 H carrying 2 A into 10 Ω', () => {
  it('I(50 ms) 0.73576 A; |V(0)| 20 V; energy dissipated 1.0000 J', () => {
    const s = tranCards('L1 a 0 0.5\nR1 a 0 10', { h: 2.5e-4, tStop: 0.5, ic: { L1: 2 }, probes: ['i(L1)', 'v(a)', 'p(R1)'] });
    near(s.at('i(L1)', 0.05), 2 * dmath.exp(-1), 5e-3); near(s.at('i(L1)', 0.05), 0.73576, 5e-3);
    near(Math.abs(s.y('v(a)')[0]), 20, 1e-4);
    near(integrate(s.t, s.y('p(R1)')), 1.0, 5e-3);
  });
});
