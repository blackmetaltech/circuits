import { describe, it } from 'vitest';
import { near } from './util';
import { tranCards } from './tranUtil';
describe('TR-01 [Hayt & Kemmerly ch8 style] 5 V step into 10 kΩ + 100 nF, dt 1 µs', () => {
  it('V(1 ms) 3.1606; V(2 ms) 4.3233 (0.5 %)', () => {
    const s = tranCards('V1 in 0 5\nR1 in c 10k\nC1 c 0 100n', { h: 1e-6, tStop: 2e-3, probes: ['v(c)'] });
    near(s.at('v(c)', 1e-3), 3.1606, 5e-3); near(s.at('v(c)', 2e-3), 4.3233, 5e-3);
  });
});
