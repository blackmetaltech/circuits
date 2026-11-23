import { describe, expect, it } from 'vitest';
import { acCards, bisect, mag } from './acUtil';
import { near } from './util';
import { partModel, rails } from './oaUtil';
import { lm358 } from '../../data/parts/ics';
// Chapter 6-3 (Bandwidth): closed-loop bandwidth = GBW / NOISE gain. LM358: A0 1e5, GBW 0.7 MHz (SLOS068AB §5.7), ±12 V, AC analysis.
// A single-pole op-amp in a loop of noise gain NG gives H = G0 / (1 + jf/f3) with f3 = GBW·(1 + NG/A0)/NG.
// (a) one inverting stage 1k / 100k: G = −100, NG = 101. Ideal Ro: f3 = 0.7e6·1.00101/101 = 6937.7 Hz; at 20 kHz x = 2.8828, loss 10·log10(1 + x²) = 9.690 dB.
//     The macro's Ro 75 Ω [E] drives Rf = 100k, so the loop gain is ×100/100.075: f3 = 6932.5 Hz, loss 9.6956 dB. Either way ~7 kHz, about −9.7 dB at 20 kHz.
// (b) two inverting stages 10k / 100k (both halves of one LM358): G = −10 each but NG = 11 (not 10), so f3 = 0.7e6·1.00011/11 = 63.64 kHz each,
//     not the 70 kHz that GBW/|G| gives. Ideal Ro: DC 2·20·log10(10/1.00011) = 39.9981 dB, loss 2 × 0.4090 dB at 20 kHz → 39.180 dB.
//     With Ro 75 Ω: stage 1 drives 100k ∥ 10k (stage 2's input, to a virtual ground), stage 2 drives 100k: f3 = 63.12 / 63.60 kHz,
//     loss 0.4155 + 0.4096 dB → 39.173 dB. Inside the 39-41 dB mask by 0.17 dB (DESIGN's 39.32 dB used NG = 10).
const ONE = 'V1 in 0 0 ac 1\nR1 in inv 1k\nRf out inv 100k\nU1 0 inv out vp vn m' + rails(12) + partModel(lm358);
const TWO = 'V1 in 0 0 ac 1\nR1 in a 10k\nR2 a o1 100k\nU1 0 a o1 vp vn m\nR3 o1 b 10k\nR4 b out 100k\nU2 0 b out vp vn m' + rails(12) + partModel(lm358);
const dB = (x: number): number => 20 * Math.log10(x);
describe('OA-12 closed-loop bandwidth = GBW / noise gain, LM358 macro, ±12 V', () => {
  it('one stage at −100: DC 99.899, −3 dB at 6932 Hz (±0.5 %), −9.696 dB at 20 kHz', () => {
    const ac = acCards(ONE), h = (f: number): number => mag(ac.solve(f).transfer('out', 'in'));
    const h0 = h(1);
    near(h0, 99.899, 1e-4);
    near(bisect((f) => h(f) - h0 / Math.SQRT2, 1e3, 1e5, 100), 6932.5, 5e-3);
    near(dB(h(2e4) / h0), -9.6956, 2e-3);
  });
  it('two stages at −10 each: 39.998 dB flat, 39.173 dB at 20 kHz (±0.01 dB), inside the 39-41 dB mask', () => {
    const ac = acCards(TWO), g = (f: number): number => dB(mag(ac.solve(f).transfer('out', 'in')));
    expect(Math.abs(g(20) - 39.9981)).toBeLessThan(0.002);
    expect(Math.abs(g(2e4) - 39.173)).toBeLessThan(0.01);
    expect(g(2e4)).toBeGreaterThan(39);
  });
});
