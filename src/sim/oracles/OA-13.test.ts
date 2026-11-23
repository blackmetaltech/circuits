import { describe, expect, it } from 'vitest';
import { parseNetlist } from '../mna/netlist';
import { sine } from '../mna/waveforms';
import { interp, tranNetlist } from './tranUtil';
import { near } from './util';
import { partModel, rails } from './oaUtil';
import { lm741, tl072 } from '../../data/parts/ics';
import type { PartDef } from '../../data/parts/types';
// Chapter 6-4 (Big Swing): non-inverting gain 5 (Rf 40k, Rg 10k), 4 Vpp at 50 kHz in, 20 Vpp wanted.
// The sine's steepest slope is 2π·f·Vp = 2π·50e3·10 = 3.14 V/µs (full-power bandwidth f = SR/(2π·Vp)).
// LM741: SR 0.5 V/µs (SNOSC25D §6.7) < 3.14, so the output is a triangle whose slope is ±SR: peak = SR·T/4 = 0.5e6·20e-6/4 = 2.50 V (5 Vpp, not 20).
//   (±3 % like OA-08: the tanh stage approaches SR asymptotically, the measured peak is ~2 % low.) A triangle's THD is 12.1 %.
// TL072: SR 20 V/µs typ, 8 min (SLOS080W §5.9) > 3.14: an undistorted sine. Closed loop: NG 5, f3 ≈ 5.25e6/5 = 1.05 MHz, so at 50 kHz
//   |H| = 4.999875/√(1 + (0.05/1.04845)²) = 4.99420 (A0 2e5; Ro 75 Ω [E] into 50k trims A0 and GBW by 0.15 %) → peak 9.9884 V.
// ±12 V rails: the macro's headroom is the TYPICAL swing, ±13.5 V into 10 kΩ at ±15 V (1.5 V), so 10 V peak fits under 10.5 V and does not clip.
//   (With the §5.8 MINIMUM, ±12 V at ±15 V, the headroom is 3 V and ±12 V rails would clip at 9 V: the macro does not model that spread.)
function run(def: PartDef, sup: number) {
  const nl = parseNetlist('V1 in 0 0\nRg inv 0 10k\nRf out inv 40k\nU1 in inv out vp vn m' + rails(sup) + partModel(def));
  nl.elements = nl.elements.map((e) => (e.id === 'V1' ? { ...e, wave: sine(2, 5e4) } : e));
  const r = tranNetlist(nl, { h: 2e-8, tStop: 2e-4, probes: ['v(out)'] });
  // last full period (180..200 µs), resampled on 400 points: peak and THD from a DFT of the first 15 harmonics
  const N = 400, t0 = 1.8e-4, T = 2e-5, y = Array.from({ length: N }, (_, k) => interp(r.t, r.y('v(out)'), t0 + (k * T) / N));
  const harm = (n: number): number => { let c = 0, s = 0; y.forEach((v, k) => { c += v * Math.cos((2 * Math.PI * n * k) / N); s += v * Math.sin((2 * Math.PI * n * k) / N); }); return (2 / N) * Math.hypot(c, s); };
  const h1 = harm(1); let hs = 0; for (let n = 2; n <= 15; n++) hs += harm(n) ** 2;
  return { peak: Math.max(...y.map(Math.abs)), thd: Math.sqrt(hs) / h1 };
}
describe('OA-13 slew rate: 20 Vpp at 50 kHz, gain 5', () => {
  it('LM741 (0.5 V/µs): a triangle of 2.50 V peak (±3 %), THD above 10 %', () => {
    const r = run(lm741, 15);
    near(r.peak, 2.5, 0.03); expect(r.thd).toBeGreaterThan(0.10);
  });
  it('TL072 (20 V/µs) at ±15 V: a sine of 9.988 V peak (±0.1 %), THD under 1 % (spec 3 %)', () => {
    const r = run(tl072, 15);
    near(r.peak, 9.9884, 1e-3); expect(r.thd).toBeLessThan(0.01);
  });
  it('TL072 at ±12 V: still 9.988 V peak with the typical 1.5 V headroom (no clipping)', () => {
    const r = run(tl072, 12);
    near(r.peak, 9.9884, 1e-3); expect(r.thd).toBeLessThan(0.01);
  });
});
