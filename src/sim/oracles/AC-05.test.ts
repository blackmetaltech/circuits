import { describe, it } from 'vitest';
import { near } from './util';
import { acCards, bisect, mag } from './acUtil';
import { findPeak } from '../mna/ac';
describe('AC-05 series RLC 7.4 Ω, 3 H, 27 µF (resonance)', () => {
  it('f0 17.684 Hz; Q 45.045; BW 0.39258 Hz; I(f0) 0.135135 A/V', () => {
    const ac = acCards('V1 in 0 0 ac 1\nR1 in a 7.4\nL1 a b 3\nC1 b 0 27u');
    const iAt = (f: number): number => mag(ac.solve(f).i('V1'));
    const pk = findPeak(iAt, 10, 30);
    near(pk.x, 17.684); near(pk.y, 0.135135);
    near(2 * Math.PI * pk.x * 3 / 7.4, 45.045, 2e-3);
    const half = pk.y / Math.SQRT2;
    const lo = bisect((f) => iAt(f) - half, 17, pk.x), hi = bisect((f) => half - iAt(f), pk.x, 18.5);
    near(hi - lo, 0.39258);
  });
});
