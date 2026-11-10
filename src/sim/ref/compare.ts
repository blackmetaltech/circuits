// Comparison harness for NODE-vs-ngspice reference CSVs (DESIGN §9.2).
// Pure TS, no Node built-ins (tests read files with node:fs and pass the text in). Deterministic: uses dmath for log.
import { dmath } from '@core/numerics';

/** A parsed CSV: header names and columns of numbers (columnar). */
export interface Csv {
  header: string[];
  cols: number[][];
  rows: number;
}

/** A single-valued series y(x); x must be non-decreasing. */
export interface Series {
  x: number[];
  y: number[];
}

/** AC response: frequency (Hz), magnitude (dB), phase (degrees). */
export interface AcSeries {
  freq: number[];
  magDb: number[];
  phaseDeg: number[];
}

/** Parse the reference CSV dialect: a header row, then numeric rows. Blank lines and lines starting with '#' are skipped. */
export function parseCsv(text: string): Csv {
  const lines = text.split('\n');
  let header: string[] | null = null;
  const cols: number[][] = [];
  let rows = 0;
  for (let ln = 0; ln < lines.length; ln++) {
    const line = lines[ln].replace(/\r$/, '').trim();
    if (line === '' || line.charAt(0) === '#') continue;
    const cells = line.split(',').map((c) => c.trim());
    if (header === null) {
      header = cells;
      for (let i = 0; i < cells.length; i++) cols.push([]);
      continue;
    }
    if (cells.length !== header.length) throw new Error(`csv line ${ln + 1}: expected ${header.length} cells, got ${cells.length}`);
    for (let i = 0; i < cells.length; i++) {
      const s = cells[i];
      const v = s === '' ? NaN : Number(s);
      if (Number.isNaN(v)) throw new Error(`csv line ${ln + 1}: cell ${i + 1} is not a number: "${s}"`);
      cols[i].push(v);
    }
    rows++;
  }
  if (header === null) throw new Error('csv: empty');
  return { header, cols, rows };
}

/** One column by header name or index. */
export function column(csv: Csv, key: string | number): number[] {
  const i = typeof key === 'number' ? key : csv.header.indexOf(key);
  if (i < 0 || i >= csv.cols.length) throw new Error(`csv: no column ${String(key)}`);
  return csv.cols[i];
}

/** Linear interpolation of y(x) at xq (x ascending); clamps outside the range. */
export function interp(x: number[], y: number[], xq: number): number {
  const n = x.length;
  if (n === 0) throw new Error('interp: empty series');
  if (xq <= x[0]) return y[0];
  if (xq >= x[n - 1]) return y[n - 1];
  let lo = 0;
  let hi = n - 1;
  while (hi - lo > 1) {
    const mid = (lo + hi) >> 1;
    if (x[mid] <= xq) lo = mid;
    else hi = mid;
  }
  const dx = x[hi] - x[lo];
  if (dx === 0) return y[hi];
  return y[lo] + ((y[hi] - y[lo]) * (xq - x[lo])) / dx;
}

/** n equally spaced points from a to b inclusive (n >= 2). */
export function uniformGrid(a: number, b: number, n: number): number[] {
  const g: number[] = [];
  for (let i = 0; i < n; i++) g.push(a + ((b - a) * i) / (n - 1));
  return g;
}

/** Resample a series onto a grid (linear interpolation). */
export function resample(s: Series, grid: number[]): number[] {
  return grid.map((q) => interp(s.x, s.y, q));
}

export interface TransientOptions {
  /** Compare only inside [t0, t1] (intersected with the overlap of the two series). */
  window?: [number, number];
  /** Grid points on the common grid (default 4000). */
  points?: number;
  /** Periodic alignment: search a time shift of the test series in (-period/2, period/2] minimising the error. */
  period?: number;
}

export interface TransientResult {
  /** max |test - ref| in the signal's units. */
  maxAbs: number;
  /** max - min of the reference over the compared window. */
  range: number;
  /** maxAbs / range (0 when range is 0 and maxAbs is 0; Infinity if range is 0 and maxAbs > 0). */
  fraction: number;
  /** x position of the worst difference. */
  at: number;
  /** Only with `period`: how much the test series lags the reference (test(t + shift) is compared to ref(t)). */
  shift?: number;
}

function evalTransient(ref: Series, test: Series, lo: number, hi: number, n: number, shift: number): TransientResult {
  const g = uniformGrid(lo, hi, n);
  let maxAbs = 0;
  let at = lo;
  let rmin = Infinity;
  let rmax = -Infinity;
  for (let i = 0; i < n; i++) {
    const r = interp(ref.x, ref.y, g[i]);
    const t = interp(test.x, test.y, g[i] + shift);
    const d = Math.abs(t - r);
    if (d > maxAbs) {
      maxAbs = d;
      at = g[i];
    }
    if (r < rmin) rmin = r;
    if (r > rmax) rmax = r;
  }
  const range = rmax - rmin;
  const fraction = maxAbs === 0 ? 0 : range === 0 ? Infinity : maxAbs / range;
  return { maxAbs, range, fraction, at };
}

/** Transient comparison: max |Δ| as a fraction of the reference signal range, on a common uniform grid. */
export function transientError(ref: Series, test: Series, opts: TransientOptions = {}): TransientResult {
  let lo = Math.max(ref.x[0], test.x[0]);
  let hi = Math.min(ref.x[ref.x.length - 1], test.x[test.x.length - 1]);
  if (opts.window) {
    lo = Math.max(lo, opts.window[0]);
    hi = Math.min(hi, opts.window[1]);
  }
  if (!(hi > lo)) throw new Error('transientError: no overlap between the series');
  const n = opts.points ?? 4000;
  const p = opts.period;
  if (p === undefined) return evalTransient(ref, test, lo, hi, n, 0);
  // Periodic alignment: coarse scan of the shift, then ternary refinement around the best cell.
  // Shifts move the test series, so the comparison range is trimmed to keep both inside their data.
  const f = (s: number): TransientResult => evalTransient(ref, test, lo + Math.abs(s), hi - Math.abs(s), n, s);
  const steps = 200;
  let best = 0;
  let bestErr = Infinity;
  for (let i = 0; i <= steps; i++) {
    const s = -p / 2 + (p * i) / steps;
    const e = f(s).maxAbs;
    if (e < bestErr) {
      bestErr = e;
      best = s;
    }
  }
  let a = best - p / steps;
  let b = best + p / steps;
  for (let k = 0; k < 60; k++) {
    const m1 = a + (b - a) / 3;
    const m2 = b - (b - a) / 3;
    if (f(m1).maxAbs < f(m2).maxAbs) b = m2;
    else a = m1;
  }
  const shift = (a + b) / 2;
  const r = f(shift);
  return { ...r, shift };
}

/** Wrap an angle in degrees to (-180, 180]. */
export function wrapDeg(d: number): number {
  let w = d - 360 * Math.floor(d / 360); // [0, 360)
  if (w > 180) w -= 360;
  return w;
}

/** Unwrap a phase sequence (degrees): remove 360° jumps so consecutive steps are within ±180°. */
export function unwrapDeg(p: number[]): number[] {
  const out: number[] = [];
  let off = 0;
  for (let i = 0; i < p.length; i++) {
    if (i > 0) {
      const d = p[i] + off - out[i - 1];
      if (d > 180) off -= 360 * Math.ceil((d - 180) / 360);
      else if (d < -180) off += 360 * Math.ceil((-d - 180) / 360);
    }
    out.push(p[i] + off);
  }
  return out;
}

export interface AcResult {
  /** max |Δ magnitude| in dB. */
  maxDb: number;
  /** max |Δ phase| in degrees, difference wrapped to (-180, 180]. */
  maxDeg: number;
  atDb: number;
  atDeg: number;
}

/**
 * AC comparison on the reference's frequency points (log-frequency interpolation of the test response,
 * phases unwrapped before interpolation, phase difference wrapped). Frequencies outside the test range are skipped.
 */
export function acError(ref: AcSeries, test: AcSeries): AcResult {
  const lf = test.freq.map((f) => dmath.log(f));
  const tm = test.magDb;
  const tp = unwrapDeg(test.phaseDeg);
  const rp = unwrapDeg(ref.phaseDeg);
  const tlo = test.freq[0];
  const thi = test.freq[test.freq.length - 1];
  let maxDb = 0;
  let maxDeg = 0;
  let atDb = ref.freq[0];
  let atDeg = ref.freq[0];
  for (let i = 0; i < ref.freq.length; i++) {
    const f = ref.freq[i];
    if (f < tlo * (1 - 1e-12) || f > thi * (1 + 1e-12)) continue;
    const q = dmath.log(f);
    const dDb = Math.abs(interp(lf, tm, q) - ref.magDb[i]);
    const dDeg = Math.abs(wrapDeg(interp(lf, tp, q) - rp[i]));
    if (dDb > maxDb) {
      maxDb = dDb;
      atDb = f;
    }
    if (dDeg > maxDeg) {
      maxDeg = dDeg;
      atDeg = f;
    }
  }
  return { maxDb, maxDeg, atDb, atDeg };
}
