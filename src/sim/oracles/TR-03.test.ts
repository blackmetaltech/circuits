import { describe, it } from 'vitest';
import { dmath } from '@core/numerics';
import { near } from './util';
import { tranCards } from './tranUtil';
describe('TR-03 [Hayt & Kemmerly ch9 style] series RLC step: 10 V, 20 Ω, 10 mH, 10 µF, dt 1 µs', () => {
  it('ζ 0.31623; ω0 3162.3; overshoot 35.092 %; Vpk 13.509 V at 1.0472 ms (0.5 %)', () => {
    const s = tranCards('V1 in 0 10\nR1 in a 20\nL1 a c 10m\nC1 c 0 10u', { h: 1e-6, tStop: 2e-3, probes: ['v(c)'] });
    const zeta = 10 * dmath.sqrt(10e-6 / 10e-3), w0 = 1 / dmath.sqrt(10e-3 * 10e-6), wd = w0 * dmath.sqrt(1 - zeta * zeta);
    near(zeta, 0.31623, 1e-4); near(w0, 3162.3, 1e-4);
    const v = s.y('v(c)'); let k = 1; for (let i = 1; i < v.length; i++) if (v[i] > v[k]) k = i;
    // parabolic refinement of the peak
    const y0 = v[k - 1], y1 = v[k], y2 = v[k + 1], d = 0.5 * (y0 - y2) / (y0 - 2 * y1 + y2);
    const tpk = s.t[k] + d * (s.t[k + 1] - s.t[k]), vpk = y1 - 0.25 * (y0 - y2) * d;
    near(vpk, 10 * (1 + dmath.exp(-Math.PI * zeta / dmath.sqrt(1 - zeta * zeta))), 5e-3);
    near((vpk / 10 - 1) * 100, 35.092, 5e-3); near(vpk, 13.509, 5e-3);
    near(tpk, Math.PI / wd, 5e-3); near(tpk, 1.0472e-3, 5e-3);
  });
});
