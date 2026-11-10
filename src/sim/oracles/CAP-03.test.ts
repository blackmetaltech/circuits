import { describe, it } from 'vitest';
import { dmath } from '@core/numerics';
import { near } from './util';
import { crossing, tranCards } from './tranUtil';
describe('CAP-03 [NCERT XII ch2 / Hayt ch8] RC charging, 12 V, 10 kΩ, 100 µF', () => {
  it('V(1 s) 7.5854 V; t(9 V) 1.3863 s (dt = τ/200)', () => {
    const s = tranCards('V1 in 0 12\nR1 in c 10k\nC1 c 0 100u', { h: 5e-3, tStop: 3, probes: ['v(c)'] });
    near(s.at('v(c)', 1), 12 * (1 - dmath.exp(-1)), 5e-3); near(s.at('v(c)', 1), 7.5854, 5e-3);
    near(crossing(s.t, s.y('v(c)'), 9), 1.3863, 5e-3);
  });
});
