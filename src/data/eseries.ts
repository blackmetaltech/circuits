// IEC 60063 preferred-number series E3/E6/E12/E24 (DESIGN §4.1; `global` pack standards.eseries). The mantissas are the standard's
// published values, not a computed 10^(k/N) rounding: the classic deviations (2.7, 3.3, 3.9, 4.7 and, in E24, 2.7 3.0 3.3 3.6 3.9
// 4.3 4.7 5.1 ... 8.2 9.1) come from the standard itself. Decade values are built from the decimal text so 4.7e3 is exactly 4700.
export type ESeries = 'E3' | 'E6' | 'E12' | 'E24';

export const E_MANTISSAS: Readonly<Record<ESeries, readonly number[]>> = {
  E3: [1.0, 2.2, 4.7],
  E6: [1.0, 1.5, 2.2, 3.3, 4.7, 6.8],
  E12: [1.0, 1.2, 1.5, 1.8, 2.2, 2.7, 3.3, 3.9, 4.7, 5.6, 6.8, 8.2],
  E24: [1.0, 1.1, 1.2, 1.3, 1.5, 1.6, 1.8, 2.0, 2.2, 2.4, 2.7, 3.0, 3.3, 3.6, 3.9, 4.3, 4.7, 5.1, 5.6, 6.2, 6.8, 7.5, 8.2, 9.1],
};

/** value = mantissa x 10^exp, parsed from decimal text (exact, deterministic). */
function scaled(mantissa: number, exp: number): number {
  return Number(`${mantissa}e${exp}`);
}

/** All members of `series` in [lo, hi] (inclusive, tolerant of 1e-9 relative slop), ascending. lo/hi > 0. */
export function eseries(series: ESeries, lo: number, hi: number): number[] {
  const out: number[] = [];
  const m = E_MANTISSAS[series];
  // Decade range by scanning (no Math.log10: determinism rules): start 12 decades below lo and walk up.
  let exp = -12;
  while (scaled(10, exp) <= lo * 0.999999999) exp++;
  exp -= 1;
  for (; ; exp++) {
    for (const x of m) {
      const v = scaled(x, exp);
      if (v < lo * (1 - 1e-9)) continue;
      if (v > hi * (1 + 1e-9)) return out;
      out.push(v);
    }
  }
}

/** Nearest member of the series to `x` (ratio sense: log-nearest approximated by relative distance). */
export function nearestInSeries(series: ESeries, x: number): number {
  const cand = eseries(series, x / 10, x * 10);
  let best = cand[0];
  for (const c of cand) if (Math.abs(c - x) < Math.abs(best - x)) best = c;
  return best;
}
