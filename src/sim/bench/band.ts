// The Minkowski tube (DESIGN §3.12 `band`): EVERY window sample (t, y) must have a target point within [t - dt, t + dt] whose value is
// within ±dv of y. For a continuous target the values reachable in [t - dt, t + dt] form the interval [min, max] of y* there, so the test
// is y ∈ [min - dv, max + dv]; min/max come exactly from the end points plus the target's knots (extrema / corners), which makes square
// edges, sines, exp and measured reference traces all exact. Pure; dmath only.
import { dmath } from '@core/numerics';
import { waveBreakpoints, waveValue, type Wave } from '../mna/waveforms';
import { crossings, interpAt, type Signal } from './measure';

export type Target =
  | { k: 'wave'; wave: Wave }
  | { k: 'exp'; v0: number; vInf: number; tau: number; t0?: number }
  /** "Reference circuit output": a sampled trace, linearly interpolated. */
  | { k: 'ref'; t: number[]; y: number[] };

export interface BandParams {
  dv: number; dt: number;
  /** Align the target to the measured trace by trigger first (needs `period`). */
  phaseFree?: boolean;
  period?: number;
}
export interface BandResult {
  ok: boolean;
  /** Largest distance of any sample outside the tube (0 when inside). */
  worst: number;
  /** Time shift applied to the target (0 unless phaseFree). */
  shift: number;
  /** Times of failing samples (first 256), for the scope's red overlay. */
  bad: number[];
  badCount: number;
  /** First failing sample. */
  first: { t: number; y: number } | null;
}

const value = (g: Target, t: number): number => {
  if (g.k === 'wave') return waveValue(g.wave, t);
  if (g.k === 'exp') { const t0 = g.t0 ?? 0; return t <= t0 ? g.v0 : g.vInf + (g.v0 - g.vInf) * dmath.exp(-(t - t0) / g.tau); }
  return interpAt(g.t, g.y, t);
};

/** Ascending corner / extremum times of the target inside [a, b]. */
function knots(g: Target, a: number, b: number): number[] {
  if (g.k === 'exp') return [];
  if (g.k === 'ref') return g.t.filter((x) => x > a && x < b);
  const w = g.wave;
  if (w.k === 'sine') {
    const td = w.delay ?? 0, ph = w.phase ?? 0, om = 2 * Math.PI * w.f, out: number[] = [];
    if (td > a && td < b) out.push(td);
    const m0 = Math.floor((om * (Math.max(a, td) - td) + ph) / Math.PI - 0.5) - 1, m1 = Math.ceil((om * (b - td) + ph) / Math.PI - 0.5) + 1;
    for (let m = m0; m <= m1; m++) { const t = td + ((m + 0.5) * Math.PI - ph) / om; if (t > a && t < b && t >= td) out.push(t); }
    return out.sort((x, y) => x - y);
  }
  return waveBreakpoints(w, b).filter((x) => x > a && x < b);
}

function lowerBound(arr: number[], x: number): number {
  let lo = 0, hi = arr.length;
  while (lo < hi) { const m = (lo + hi) >> 1; if (arr[m] <= x) lo = m + 1; else hi = m; }
  return lo;
}

function evaluate(s: Signal, g: Target, dv: number, dt: number, shift: number, collect: boolean): { worst: number; bad: number[]; badCount: number; first: { t: number; y: number } | null } {
  const n = s.t.length;
  if (n === 0) return { worst: 0, bad: [], badCount: 0, first: null };
  const kn = knots(g, s.t[0] - shift - dt, s.t[n - 1] - shift + dt);
  let worst = 0, badCount = 0, first: { t: number; y: number } | null = null;
  const bad: number[] = [];
  for (let k = 0; k < n; k++) {
    const q = s.t[k] - shift, a = q - dt, b = q + dt;
    let lo = Math.min(value(g, a), value(g, b)), hi = Math.max(value(g, a), value(g, b));
    for (let i = lowerBound(kn, a); i < kn.length && kn[i] < b; i++) { const v = value(g, kn[i]); if (v < lo) lo = v; if (v > hi) hi = v; }
    const y = s.y[k], slack = 1e-12 * (1 + Math.abs(y));
    const ex = y < lo - dv - slack ? lo - dv - y : y > hi + dv + slack ? y - hi - dv : 0;
    if (ex > 0) {
      if (ex > worst) worst = ex;
      badCount++;
      if (!first) first = { t: s.t[k], y };
      if (collect && bad.length < 256) bad.push(s.t[k]);
    }
  }
  return { worst, bad, badCount, first };
}

/** Mid-level rising trigger (5 % hysteresis) of a trace: first rising crossing time, or NaN. */
function trigger(s: Signal): number {
  let lo = Infinity, hi = -Infinity;
  for (const v of s.y) { if (v < lo) lo = v; if (v > hi) hi = v; }
  const c = crossings(s, (lo + hi) / 2, 0.05 * (hi - lo)).find((x) => x.rising);
  return c ? c.t : NaN;
}

export function checkBand(s: Signal, g: Target, o: BandParams): BandResult {
  let shift = 0;
  if (o.phaseFree && o.period && o.period > 0 && s.t.length > 1) {
    // target trace over one period (+ one more so a rising edge is always found), starting at the window start
    const t0 = s.t[0], M = 2048, tt: number[] = [], yy: number[] = [];
    for (let k = 0; k <= 2 * M; k++) { const t = t0 + (o.period * k) / M; tt.push(t); yy.push(value(g, t)); }
    const tm = trigger(s), tg = trigger({ t: tt, y: yy });
    if (!Number.isNaN(tm) && !Number.isNaN(tg)) {
      const base = tm - tg;
      let bestErr = Infinity;
      for (let i = 0; i <= 40; i++) {
        const d = (((i + 1) >> 1) * (i % 2 === 1 ? 1 : -1) * 0.05 * o.period) / 20;   // 0, +1, -1, +2, -2, … steps of 0.25 % of a period
        const r = evaluate(s, g, o.dv, o.dt, base + d, false);
        if (r.worst < bestErr) { bestErr = r.worst; shift = base + d; }
      }
    }
  }
  const r = evaluate(s, g, o.dv, o.dt, shift, true);
  return { ok: r.badCount === 0, worst: r.worst, shift, bad: r.bad, badCount: r.badCount, first: r.first };
}
