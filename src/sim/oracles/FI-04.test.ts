import { describe, it } from 'vitest';
import { near } from './util';
import { acCards, bisect, mag } from './acUtil';
describe('FI-04 series RLC band-pass: 10 mH, 1 µF, 50 Ω output', () => {
  it('f0 1591.5 Hz; Q 2; BW 795.77 Hz; −3 dB 1242.64 / 2038.42; |H(f0)| 1; |H(2f0)| 0.31623', () => {
    const ac = acCards('V1 in 0 0 ac 1\nL1 in a 10m\nC1 a out 1u\nR1 out 0 50');
    const hAt = (f: number): number => mag(ac.solve(f).transfer('out', 'in'));
    const f0 = 1 / (2 * Math.PI * Math.sqrt(10e-3 * 1e-6));
    near(f0, 1591.5); near(hAt(f0), 1.0); near(2 * Math.PI * f0 * 10e-3 / 50, 2.0);
    const h = 1 / Math.SQRT2;
    const lo = bisect((f) => hAt(f) - h, 800, f0), hi = bisect((f) => h - hAt(f), f0, 3000);
    near(lo, 1242.64); near(hi, 2038.42); near(hi - lo, 795.77);
    near(hAt(2 * f0), 0.31623);
  });
});
