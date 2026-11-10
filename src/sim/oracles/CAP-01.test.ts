import { describe, it } from 'vitest';
import { near } from './util';
import { tranCards } from './tranUtil';
// 110 V across 2 µF in series with (3 µF ∥ 6 µF); each capacitor carries the Textbook-bin 1 GΩ bleed (DESIGN §3.4).
// The capacitive divider is the answer on any time scale ≪ R·C = 2000 s, so we read the charged network after 1 ms of transient.
describe('CAP-01 [NCERT XII ch2 style] series-parallel capacitor bank, 110 V', () => {
  it('Ceq 1.6364 µF; Q 180 µC; V(a) 20 V; U 9.9 mJ', () => {
    const s = tranCards('V1 in 0 110\nC1 in a 2u\nR1 in a 1g\nC2 a 0 3u\nR2 a 0 1g\nC3 a 0 6u\nR3 a 0 1g', { h: 1e-6, tStop: 1e-3, probes: ['v(a)', 'v(in,a)'] });
    const va = s.at('v(a)', 1e-3), v1 = s.at('v(in,a)', 1e-3);
    const Q = 2e-6 * v1, U = 0.5 * 2e-6 * v1 * v1 + 0.5 * 9e-6 * va * va;
    near(va, 20); near(Q, 180e-6); near(Q / 110, 1.6364e-6, 1e-4); near(U, 9.9e-3);
  });
});
