import { describe, it } from 'vitest';
import { near } from './util';
import { acCards, bisect, mag } from './acUtil';
import { findPeak } from '../mna/ac';
describe('TR-04 1 mA AC into R 1k ∥ L 1 mH ∥ C 1 µF (parallel resonance)', () => {
  it('f0 5032.9 Hz; |V(f0)| 1.0000 V; Q 31.623; −3 dB 4953.97 / 5113.13 Hz; |V(f0/2)| 0.02108 V (1 %)', () => {
    const ac = acCards('I1 0 out 0 ac 1m\nR1 out 0 1k\nL1 out 0 1m\nC1 out 0 1u');
    const vAt = (f: number): number => mag(ac.solve(f).v('out'));
    const pk = findPeak(vAt, 4000, 6000);
    near(pk.x, 5032.9, 1e-2); near(pk.y, 1.0, 1e-2); near(pk.x / (1 / Math.sqrt(1e-3 * 1e-6) / 2 / Math.PI) * 31.623, 31.623, 1e-2);
    const half = pk.y / Math.SQRT2;
    const lo = bisect((f) => vAt(f) - half, 4000, pk.x), hi = bisect((f) => half - vAt(f), pk.x, 6500);
    near(lo, 4953.97, 1e-2); near(hi, 5113.13, 1e-2); near(pk.x / (hi - lo), 31.623, 1e-2);
    near(vAt(pk.x / 2), 0.02108, 1e-2);
  });
});
