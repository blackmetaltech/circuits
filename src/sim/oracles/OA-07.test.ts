import { describe, expect, it } from 'vitest';
import { acCards, bisect, mag } from './acUtil';
import { near } from './util';
import { dcAmp } from './oaUtil';
describe('OA-07 non-inverting gain 10 (1k/9k), macro A0 1e5, GBW 1 MHz', () => {
  it('DC gain 9.999; −3 dB at 100.01 kHz ±2 %', () => {
    const ac = acCards(dcAmp('V1 in 0 0 ac 1\nR1 inv 0 1k\nRf out inv 9k\nU1 in inv out vp vn m\n.model m opamp (a0=1e5 gbw=1e6)'));
    const h = (f: number): number => mag(ac.solve(f).transfer('out', 'in'));
    const dc = h(1e-2);
    near(dc, 9.999, 2e-4);
    const f3 = bisect((f) => h(f) - dc / Math.SQRT2, 1e3, 1e7, 100);
    near(f3, 100.01e3, 0.02);
    expect(f3).toBeGreaterThan(0);
  });
});
