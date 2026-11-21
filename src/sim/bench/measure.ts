// Signal metrics on a sampled window (DESIGN §3.12 `metric`). Pure functions of (t, y): linear interpolation between samples,
// exact piecewise-linear integrals, dmath only. A metric that cannot be measured (no crossing, no edge) is NaN, never a throw.
import { dmath } from '@core/numerics';

export interface Signal { t: number[]; y: number[] }

export type MetricName =
  | 'mean' | 'rms' | 'vpp' | 'min' | 'max' | 'peak' | 'freq' | 'duty' | 'riseTime' | 'fallTime' | 'overshoot'
  | 'settlingTime' | 'crossingTime' | 'crossingCount' | 'thd' | 'harmonic' | 'energy';

export interface MeasureParams {
  /** Crossing level (default: mid-level (min+max)/2). */
  level?: number;
  /** Total hysteresis width around `level` (default 0 for counts/times, 5 % of Vpp for freq). */
  hyst?: number;
  edge?: 'rising' | 'falling' | 'both';
  /** Which crossing `crossingTime` returns (0 = first). */
  index?: number;
  /** THD: highest harmonic order included (default 10). */
  harmonics?: number;
  /** `harmonic`: order k. */
  k?: number;
  /** settlingTime: tolerance as a fraction of the step (default 0.02). */
  tol?: number;
  /** Periods in the window (THD / harmonic). Overrides the context. */
  periods?: number;
  /** Resampled points for the DFT (power of two, default 16384). */
  points?: number;
}
export interface MeasureCtx { periods?: number }

export interface Crossing { t: number; rising: boolean }

// ---------------------------------------------------------------- helpers
export function interpAt(t: number[], y: number[], tq: number): number {
  const n = t.length;
  if (n === 0) return NaN;
  if (tq <= t[0]) return y[0];
  if (tq >= t[n - 1]) return y[n - 1];
  let lo = 0, hi = n - 1;
  while (hi - lo > 1) { const m = (lo + hi) >> 1; if (t[m] <= tq) lo = m; else hi = m; }
  const dt = t[hi] - t[lo];
  return dt > 0 ? y[lo] + ((tq - t[lo]) / dt) * (y[hi] - y[lo]) : y[hi];
}

/** Samples of [t0, t1] with interpolated end points (so a window of whole periods is exactly whole). */
export function sliceWindow(t: number[], y: number[], t0: number, t1: number): Signal {
  const ot: number[] = [], oy: number[] = [];
  if (t.length === 0) return { t: ot, y: oy };
  const a = Math.max(t0, t[0]), b = Math.min(t1, t[t.length - 1]);
  ot.push(a); oy.push(interpAt(t, y, a));
  for (let k = 0; k < t.length; k++) if (t[k] > a && t[k] < b) { ot.push(t[k]); oy.push(y[k]); }
  if (b > a) { ot.push(b); oy.push(interpAt(t, y, b)); }
  return { t: ot, y: oy };
}

const extent = (y: number[]): { lo: number; hi: number } => {
  let lo = Infinity, hi = -Infinity;
  for (const v of y) { if (v < lo) lo = v; if (v > hi) hi = v; }
  return { lo, hi };
};

function integral(s: Signal, seg: (a: number, b: number) => number): number {
  let acc = 0;
  for (let k = 1; k < s.t.length; k++) acc += seg(s.y[k - 1], s.y[k]) * (s.t[k] - s.t[k - 1]);
  return acc;
}
const span = (s: Signal): number => (s.t.length > 1 ? s.t[s.t.length - 1] - s.t[0] : 0);

/** Fraction of segment (a→b) spent above L (linear ramp). */
const above = (a: number, b: number, L: number): number => {
  if (a >= L && b >= L) return 1;
  if (a <= L && b <= L) return 0;
  return a > b ? (a - L) / (a - b) : (b - L) / (b - a);
};

// ---------------------------------------------------------------- crossings
/** Schmitt-trigger crossings of `level` with total hysteresis `hyst`; times are the interpolated level crossings. */
export function crossings(s: Signal, level: number, hyst = 0): Crossing[] {
  const hi = level + hyst / 2, lo = level - hyst / 2, out: Crossing[] = [];
  let state = -1;
  for (let k = 0; k < s.y.length; k++) {
    const v = s.y[k];
    if (state < 0) { if (v > hi) state = 1; else if (v < lo) state = 0; continue; }
    if (state === 0 && v > hi) {
      let j = k - 1; while (j > 0 && s.y[j] > level) j--;
      const a = s.y[j], b = s.y[j + 1];
      out.push({ t: b > a ? s.t[j] + ((level - a) / (b - a)) * (s.t[j + 1] - s.t[j]) : s.t[j + 1], rising: true });
      state = 1;
    } else if (state === 1 && v < lo) {
      let j = k - 1; while (j > 0 && s.y[j] < level) j--;
      const a = s.y[j], b = s.y[j + 1];
      out.push({ t: a > b ? s.t[j] + ((a - level) / (a - b)) * (s.t[j + 1] - s.t[j]) : s.t[j + 1], rising: false });
      state = 0;
    }
  }
  return out;
}
const pick = (c: Crossing[], edge: MeasureParams['edge'] = 'both'): Crossing[] => (edge === 'both' ? c : c.filter((x) => x.rising === (edge === 'rising')));

// ---------------------------------------------------------------- DFT over whole periods
/** Complex DFT bin magnitudes of the window resampled to M points (periodic: end point excluded). */
function binMagnitudes(s: Signal, M: number, bins: number[]): number[] {
  const t0 = s.t[0], L = span(s);
  const y = new Float64Array(M);
  for (let j = 0; j < M; j++) y[j] = interpAt(s.t, s.y, t0 + (L * j) / M);
  const cs = new Float64Array(M), sn = new Float64Array(M);
  for (let m = 0; m < M; m++) { const a = (2 * Math.PI * m) / M; cs[m] = dmath.cos(a); sn[m] = dmath.sin(a); }
  return bins.map((b) => {
    let re = 0, im = 0;
    for (let j = 0; j < M; j++) { const m = (b * j) % M; re += y[j] * cs[m]; im -= y[j] * sn[m]; }
    return Math.sqrt(re * re + im * im);
  });
}
const pow2 = (n: number): number => { let m = 16; while (m < n) m *= 2; return m; };

// ---------------------------------------------------------------- the metrics
export function measure(name: MetricName, s: Signal, p: MeasureParams = {}, ctx: MeasureCtx = {}): number {
  const n = s.t.length;
  if (n < 2 || span(s) <= 0) return name === 'crossingCount' ? 0 : n === 1 && (name === 'mean' || name === 'min' || name === 'max' || name === 'peak') ? s.y[0] : NaN;
  const { lo, hi } = extent(s.y), mid = (lo + hi) / 2, L = span(s);
  switch (name) {
    case 'mean': return integral(s, (a, b) => (a + b) / 2) / L;
    /** The integral of the signal over the window (a power probe gives the energy in joules: the heat in a switch, 3-4). */
    case 'energy': return integral(s, (a, b) => (a + b) / 2);
    case 'rms': return Math.sqrt(integral(s, (a, b) => (a * a + a * b + b * b) / 3) / L);
    case 'vpp': return hi - lo;
    case 'min': return lo;
    case 'max': return hi;
    case 'peak': return Math.max(Math.abs(lo), Math.abs(hi));
    case 'duty': return integral(s, (a, b) => above(a, b, p.level ?? mid)) / L;
    case 'freq': {
      const c = crossings(s, p.level ?? mid, p.hyst ?? 0.05 * (hi - lo)).filter((x) => x.rising);
      return c.length >= 2 ? (c.length - 1) / (c[c.length - 1].t - c[0].t) : NaN;
    }
    case 'crossingCount': return pick(crossings(s, p.level ?? mid, p.hyst ?? 0), p.edge).length;
    case 'crossingTime': {
      const c = pick(crossings(s, p.level ?? mid, p.hyst ?? 0), p.edge)[p.index ?? 0];
      return c ? c.t - s.t[0] : NaN;
    }
    case 'riseTime': case 'fallTime': return edgeTime(s, lo, hi, name === 'riseTime');
    case 'overshoot': {
      const y0 = s.y[0], yf = s.y[n - 1], step = yf - y0;
      if (step === 0) return NaN;
      return (100 * (step > 0 ? hi - yf : yf - lo)) / Math.abs(step);
    }
    case 'settlingTime': {
      const yf = s.y[n - 1], band = (p.tol ?? 0.02) * Math.abs(yf - s.y[0]);
      let last = -1;
      for (let k = n - 1; k >= 0; k--) if (Math.abs(s.y[k] - yf) > band) { last = k; break; }
      if (last < 0) return 0;
      if (last === n - 1) return NaN;
      // interpolate where the segment last enters the band
      const a = Math.abs(s.y[last] - yf), b = Math.abs(s.y[last + 1] - yf);
      const f = a > b ? (a - band) / (a - b) : 1;
      return s.t[last] + f * (s.t[last + 1] - s.t[last]) - s.t[0];
    }
    case 'thd': case 'harmonic': {
      const N = Math.max(1, Math.round(p.periods ?? ctx.periods ?? 1)), M = pow2(p.points ?? 16384);
      const H = name === 'thd' ? Math.max(2, Math.min(p.harmonics ?? 10, Math.floor((M / 2 - 1) / N))) : p.k ?? 2;
      if (H * N >= M / 2) return NaN;
      const orders: number[] = []; if (name === 'thd') for (let k = 2; k <= H; k++) orders.push(k); else orders.push(H);
      const mags = binMagnitudes(s, M, [N, ...orders.map((k) => k * N)]), f1 = mags[0];
      if (!(f1 > 0)) return NaN;
      if (name === 'harmonic') return mags[1] > 0 ? 20 * dmath.log10(mags[1] / f1) : -Infinity;
      let sum = 0; for (let k = 1; k < mags.length; k++) sum += mags[k] * mags[k];
      return (100 * Math.sqrt(sum)) / f1;
    }
  }
}

/** 10-90 % transition time of the first complete edge (rising: up through 10 % then 90 %; falling: mirrored). */
function edgeTime(s: Signal, lo: number, hi: number, rising: boolean): number {
  if (!(hi > lo)) return NaN;
  const a = rising ? lo + 0.1 * (hi - lo) : hi - 0.1 * (hi - lo), b = rising ? lo + 0.9 * (hi - lo) : hi - 0.9 * (hi - lo);
  const cross = (k: number, L: number): number => s.t[k - 1] + ((L - s.y[k - 1]) / (s.y[k] - s.y[k - 1])) * (s.t[k] - s.t[k - 1]);
  let tA = NaN;
  for (let k = 1; k < s.y.length; k++) {
    const p = s.y[k - 1], v = s.y[k];
    if (rising ? p < a && v >= a : p > a && v <= a) tA = cross(k, a);
    else if (rising ? v < a : v > a) tA = NaN;
    if (!Number.isNaN(tA) && (rising ? p < b && v >= b : p > b && v <= b)) return cross(k, b) - tA;
  }
  return NaN;
}
