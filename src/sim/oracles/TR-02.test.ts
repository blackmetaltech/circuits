import { describe, it } from 'vitest';
import { near } from './util';
import { tranCards } from './tranUtil';
describe('TR-02 [Hayt & Kemmerly ch8 style] 10 V step into 50 Ω + 10 mH, dt 0.2 µs', () => {
  it('I(0.2 ms) 126.42 mA; I(0.4 ms) 172.9 mA (0.5 %)', () => {
    const s = tranCards('V1 in 0 10\nR1 in x 50\nL1 x 0 10m', { h: 0.2e-6, tStop: 0.4e-3, probes: ['i(L1)'] });
    near(s.at('i(L1)', 0.2e-3), 126.42e-3, 5e-3); near(s.at('i(L1)', 0.4e-3), 172.93e-3, 5e-3);
  });
});
