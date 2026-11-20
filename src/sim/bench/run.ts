// runBench (DESIGN §3.12): analyses → discard settle (fixed seconds or 'periodic') → evaluate the specs on the window.
// Pure and deterministic: no inputs are mutated (specs, options and the circuit are only read), no clock, no randomness; the same
// inputs give a bit-identical result. Failures are { key, vars } (English in locales/sim.en.ts).
import { tranInit, tranWork, tranAdvance, makeProbe } from '../mna/tran';
import type { Circuit } from '../mna/types';
import { interpAt, measure, sliceWindow, type Signal } from './measure';
import { checkBand } from './band';
import { checkMask } from './mask';
import { checkSafety } from './safety';
import { conditionOf, costGate, estimateCost } from './cost';
import type { BenchFailure, BenchOptions, BenchResult, BenchSpec, BenchWindow, Measure, PredictionScore, RatingReport } from './types';

export * from './types';
export type { Signal };

const SETTLE_PTS = 64, CHUNK = 256;

function probesOf(specs: readonly BenchSpec[]): string[] {
  const out: string[] = [], add = (p: string): void => { if (!out.includes(p)) out.push(p); };
  for (const s of specs) {
    if (s.kind === 'level' || s.kind === 'band' || s.kind === 'metric') add(s.probe);
    else if (s.kind === 'predict') add(s.of.probe);
    else if (s.kind === 'rating') for (const p of s.probes ?? []) add(p);
  }
  return out;
}

/** Relative RMS difference of two consecutive periods of y (amplitude = half Vpp, floored). */
function periodDiff(t: number[], y: number[], t0: number, T: number): number {
  let sq = 0, lo = Infinity, hi = -Infinity;
  for (let j = 0; j < SETTLE_PTS; j++) {
    const a = interpAt(t, y, t0 + (T * j) / SETTLE_PTS), b = interpAt(t, y, t0 + T + (T * j) / SETTLE_PTS);
    sq += (b - a) * (b - a);
    if (b < lo) lo = b; if (b > hi) hi = b;
  }
  return Math.sqrt(sq / SETTLE_PTS) / Math.max((hi - lo) / 2, 1e-9);
}

export function runBench(ckt: Circuit, specs: readonly BenchSpec[], o: BenchOptions): BenchResult {
  const failures: BenchFailure[] = [], metrics: Record<string, number> = {}, predictions: PredictionScore[] = [], badSamples: Record<string, number[]> = {};
  const cond = o.condition ?? '';
  const settleInfo = { settled: true, periods: 0, t0: 0, t1: 0 };
  const probes = probesOf(specs);
  if (o.maxFlops !== undefined) {   // optional cost gate (§3.11): refuse before any stepping
    const g = costGate(estimateCost(ckt, [conditionOf(specs, o)]), o.maxFlops);
    if (!g.ok) return fail(g.key, { ...g.vars, cond });
  }
  const ratingFn = typeof o.ratings === 'function' ? o.ratings : null;
  const N = Math.max(1, Math.round(o.measurePeriods ?? 1));
  const periodic = o.settle === 'periodic';
  const T = o.period ?? 0;
  let win: { t: number[]; series: Record<string, number[]>; t0: number; t1: number } | null = null;

  // ---- transient (only when something needs a waveform)
  if (probes.length > 0 || ratingFn) {
    const settleProbe = o.settleProbe ?? probes[0];
    const rec = probes.slice(); if (periodic && settleProbe && !rec.includes(settleProbe)) rec.push(settleProbe);
    let tStop: number;
    if (periodic) {
      if (!(T > 0)) throw new Error('runBench: settle "periodic" needs options.period');
      tStop = ((o.maxPeriods ?? 50) + N) * T;
    } else tStop = (typeof o.settle === 'number' ? o.settle : 0) + (o.window ?? N * T);
    if (!(tStop > 0)) throw new Error('runBench: no measurement window (set window or period)');
    const init = tranInit(ckt, { h: o.h, tStop, ic: o.ic });
    if (!init.ok) return fail(init.failure!.key, { ...init.failure!.vars, cond });
    const st = init.st, ws = tranWork(ckt, st, true);
    const fns = rec.map((p) => makeProbe(ckt, p));
    const t: number[] = [0], series: Record<string, number[]> = {};
    rec.forEach((p, i) => { series[p] = [fns[i](Float64Array.from(st.x), st.state)]; });
    const settleSeries = (): number[] => series[settleProbe!];
    /** The headline probe at the last step the solver did accept (a stuck solve is never shown to the player: the explainer talks about this value). */
    const lastGood = (): Record<string, string | number> => { const pr = probes[0]; const sr = pr === undefined ? undefined : series[pr]; return pr !== undefined && sr !== undefined && sr.length > 0 ? { probe: pr, value: sr[sr.length - 1]! } : {}; };
    let m = 1, found = -1;   // m: next period index whose (m-1, m) difference is to be tested
    const maxP = o.maxPeriods ?? 50, tol = o.settleTol ?? 0.005;
    for (;;) {
      const r = tranAdvance(ws, st, CHUNK, (s) => { t.push(s.t); rec.forEach((p, i) => series[p].push(fns[i](s.x, s.state))); });
      if (r.failure) return fail(r.failure.key, { ...r.failure.vars, cond, ...lastGood() });
      const now = t[t.length - 1];
      if (periodic) {
        while (found < 0 && m <= maxP && now >= (m + 1) * T - 1e-12 * T) { if (periodDiff(t, settleSeries(), (m - 1) * T, T) < tol) found = m; else m++; }
        if (found >= 0 && now >= (found + N) * T - 1e-12 * T) break;
      }
      if (st.done) break;
    }
    const last = t[t.length - 1];
    let t0: number, t1: number;
    if (periodic) {
      settleInfo.settled = found >= 0;
      const p = found >= 0 ? found : maxP;
      settleInfo.periods = p;
      t0 = p * T; t1 = Math.min((p + N) * T, last);
      if (found < 0) failures.push({ key: 'bench.settle.fail', vars: { periods: maxP, tol, cond } });
    } else { t0 = o.settle === undefined ? 0 : (o.settle as number); t1 = Math.min(t0 + (o.window ?? N * T), last); }
    settleInfo.t0 = t0; settleInfo.t1 = t1;
    win = { t, series, t0, t1 };
  }
  const signal = (probe: string): Signal => sliceWindow(win!.t, win!.series[probe], win!.t0, win!.t1);
  const meas = (m: Measure): number => measure(m.metric, signal(m.probe), m.params, { periods: N });

  for (const s of specs) {
    switch (s.kind) {
      case 'level': case 'metric': {
        const v = s.kind === 'level' ? measure('mean', signal(s.probe)) : measure(s.metric, signal(s.probe), s.params, { periods: N });
        metrics[s.id] = v;
        const vars = { id: s.id, probe: s.probe, metric: s.kind === 'level' ? 'mean' : s.metric, value: v, lo: s.lo, hi: s.hi, cond };
        if (Number.isNaN(v)) failures.push({ key: 'bench.metric.nan', vars });
        else if (!(v >= s.lo && v <= s.hi)) failures.push({ key: s.kind === 'level' ? 'bench.level.fail' : 'bench.metric.fail', vars });
        break;
      }
      case 'band': {
        const r = checkBand(signal(s.probe), s.target, { dv: s.dv, dt: s.dt, phaseFree: s.phaseFree, period: T || undefined });
        metrics[s.id] = r.worst; badSamples[s.id] = r.bad;
        if (!r.ok) failures.push({ key: 'bench.band.fail', vars: { id: s.id, probe: s.probe, dv: s.dv, dt: s.dt, t: r.first!.t, value: r.first!.y, count: r.badCount, worst: r.worst, cond } });
        break;
      }
      case 'mask': {
        const r = checkMask(ckt, s.id, s.out, s.inp, s.regions, s.perDecade, cond);
        metrics[s.id] = r.worst; failures.push(...r.failures);
        break;
      }
      case 'rating': {
        const rep: RatingReport | undefined = ratingFn ? ratingFn(win as BenchWindow) : (o.ratings as RatingReport | undefined);
        for (const v of rep?.violations ?? []) failures.push({ key: 'bench.rating.violation', vars: { id: s.id, part: v.part, what: v.what, value: v.value, limit: v.limit, cond } });
        for (const p of rep?.smoked ?? []) failures.push({ key: 'bench.rating.smoked', vars: { id: s.id, part: p, cond } });
        metrics[s.id] = (rep?.violations.length ?? 0) + (rep?.smoked.length ?? 0);
        break;
      }
      case 'safety': {
        const r = checkSafety(ckt, s.rule);
        metrics[s.id] = r.ok ? 1 : 0;
        if (!r.ok) failures.push({ key: 'bench.safety.fail', vars: { id: s.id, rule: s.rule.rule, detail: r.detail, cond } });
        break;
      }
      case 'predict': {
        const truth = meas(s.of), err = Math.abs(s.entered - truth), rel = err / Math.max(Math.abs(truth), 1e-12);
        const grade = rel <= (s.tol1 ?? 0.01) ? 'exact' : rel <= (s.tol5 ?? 0.05) ? 'close' : 'miss';
        metrics[s.id] = truth;
        predictions.push({ id: s.id, entered: s.entered, truth, relErr: rel, grade });
        break;
      }
    }
  }
  return { pass: failures.length === 0, metrics, failures, predictions, settle: settleInfo, badSamples };

  function fail(key: string, vars: Record<string, string | number>): BenchResult {
    return { pass: false, metrics, failures: [...failures, { key, vars }], predictions, settle: settleInfo, badSamples };
  }
}
