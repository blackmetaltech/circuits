// Quantisation on entry (DESIGN §8.4): every numeric argument is snapped so each board state has exactly one solution-code encoding.
// Pot alpha to 1/1000, supply to 10 mV / 1 mA, jockey to 0.1 mm, generator to 3 significant figures, scope knobs to the 1-2-5 sequence.
import { sig } from '../sim/explain';

export const q = {
  alpha: (a: number): number => Math.round(a * 1000) / 1000,
  volts: (v: number): number => Math.round(v * 100) / 100,
  amps: (i: number): number => Math.round(i * 1000) / 1000,
  mm: (l: number): number => Math.round(l * 10) / 10,
  sig3: (x: number): number => sig(x, 3),
};

/** Nearest member (by ratio) of {1, 2, 5} x 10^k within [lo, hi]. Candidates are built from decimal text, no transcendental functions. */
export function snap125(x: number, lo: number, hi: number): number {
  let best = lo, bestR = Infinity;
  for (let e = -12; e <= 6; e++) for (const m of [1, 2, 5]) {
    const c = Number(`${m}e${e}`);
    if (c < lo * (1 - 1e-9) || c > hi * (1 + 1e-9)) continue;
    const r = c > x ? c / x : x / c;
    if (r < bestR) { bestR = r; best = c; }
  }
  return best;
}
