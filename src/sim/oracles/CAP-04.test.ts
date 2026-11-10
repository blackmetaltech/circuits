import { describe, it } from 'vitest';
import { dmath } from '@core/numerics';
import { near } from './util';
import { crossing, tranCards } from './tranUtil';
describe('CAP-04 [NCERT XII ch2 style] discharge of 1000 µF from 10 V through 2 kΩ', () => {
  it('V(3 s) 2.2313 V; half-life 1.3863 s; I(0) 5.000 mA', () => {
    const s = tranCards('C1 c 0 1000u\nR1 c 0 2k', { h: 0.01, tStop: 6, ic: { C1: 10 }, probes: ['v(c)', 'i(R1)'] });
    near(s.at('v(c)', 3), 10 * dmath.exp(-1.5), 5e-3); near(s.at('v(c)', 3), 2.2313, 5e-3);
    near(crossing(s.t, s.y('v(c)'), 5), 1.3863, 5e-3);
    near(s.y('i(R1)')[0], 5e-3, 1e-4);
  });
});
