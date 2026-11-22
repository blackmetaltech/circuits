// Bench cost estimator (DESIGN §3.11 "Work budget"): a PURE flop estimate for a full bench, from a compiled circuit and the bench
// conditions. No clock, no randomness; the estimate-vs-measured check lives in scripts/bench-cost.ts (the only place that reads a timer).
//
//   transient step  = Newton iterations x (LU 2/3 n^3 + back-substitution 2 n^2 + assembly) ; a LINEAR time-invariant circuit at fixed h
//                     factorises once per integration method (BE + TRAP) and then only back-substitutes (the reuse rule of §3.11).
//   AC point        = one complex LU (about 4x the real flops) + assembly.
// "Flops" here are flop-equivalents: assembly is charged as ASM_ELEM per element plus n^2 for clearing the matrix, so that small
// boards, which are assembly-bound, are not estimated at nearly zero. The constants are calibrated by `pnpm bench:cost`.
import { logFreqs } from '../mna/ac';
import type { Circuit } from '../mna/types';
import type { BenchOptions, BenchSpec } from './types';

/** Must-ship ticket budget per full bench (DESIGN §3.11): about 2 s on a desktop Node, 5 s on the Pixel 9a. */
export const BENCH_FLOP_LIMIT = 1.5e9;
/** Newton iterations per step assumed for a nonlinear circuit when the caller does not know better. */
export const DEFAULT_NEWTON_ITERS = 3;
/** Assembly cost per element and per Newton iteration, in flop-equivalents (calibrated, see scripts/bench-cost.ts). */
export const ASM_ELEM = 120;
/** Fixed per-accepted-step cost (state update, breakpoints, bookkeeping), flop-equivalents. */
export const STEP_OVERHEAD = 400;
/** A linear circuit's elements stamp constants (no device evaluation): assembly per element and per-step bookkeeping are far cheaper.
 *  Calibrated 11-23 with the steadier timing in scripts/bench-cost.ts: rc-step and rlc-step ran 5 to 6x faster per estimated flop
 *  than every nonlinear board, which the old 5-sample timing hid in noise. */
export const ASM_ELEM_LINEAR = 20;
export const STEP_OVERHEAD_LINEAR = 60;
/** Extra solves per step charged to a circuit with event devices (555, relay, fuse, regulator): crossing checks and re-solves. */
export const EVENT_EXTRA_ITERS = 1;
/** Newton iterations assumed for the DC operating point of a nonlinear circuit (source stepping included). */
export const OP_ITERS = 30;

/** One bench condition: a transient (h, tStop), optionally an AC sweep. */
export interface CostCondition {
  h: number;
  tStop: number;
  /** Mean Newton iterations per step; default 1 for a linear circuit, DEFAULT_NEWTON_ITERS otherwise. */
  newtonIters?: number;
  /** Number of AC frequencies (0 / absent: none). */
  acPoints?: number;
  /** Skip the transient (AC-only conditions). */
  noTran?: boolean;
}

export interface CostEstimate {
  /** MNA dimension: nodes + internal nodes + branch currents. */
  dim: number;
  linear: boolean;
  steps: number;
  newtonIters: number;
  /** Real LU factorisations charged. */
  factors: number;
  acPoints: number;
  tranFlops: number;
  acFlops: number;
  flops: number;
}

export type CostGate = { ok: true; flops: number } | { ok: false; key: 'bench.cost.too-big'; vars: { flops: number; limit: number; dim: number; steps: number } };

const luFlops = (n: number): number => (2 * n * n * n) / 3;

/** Flops of one condition's transient. */
function tranCost(ckt: Circuit, c: CostCondition): { steps: number; iters: number; factors: number; flops: number } {
  const n = ckt.dim, ne = ckt.elements.length;
  const asm = n * n + ASM_ELEM * ne, solve = 2 * n * n, lu = luFlops(n);
  const steps = Math.max(1, Math.ceil(c.tStop / c.h - 1e-9));
  const hasEvents = ckt.elements.some((e) => e.dev.eventValue !== undefined);
  if (ckt.linear) {
    // two cached factorisations (BE restart steps and TRAP), every step: assemble + back-substitute
    const factors = 2;
    const asmLin = n * n + ASM_ELEM_LINEAR * ne;
    return { steps, iters: 1, factors, flops: factors * (lu + asmLin) + steps * (asmLin + solve + STEP_OVERHEAD_LINEAR) };
  }
  const iters = (c.newtonIters ?? DEFAULT_NEWTON_ITERS) + (hasEvents ? EVENT_EXTRA_ITERS : 0);
  const op = OP_ITERS * (lu + solve + asm);
  return { steps, iters, factors: steps * iters, flops: op + steps * (iters * (lu + solve + asm) + STEP_OVERHEAD) };
}

/** Flops of an AC sweep of `points` frequencies (one OP solve, then a complex assemble + LU + solve per point). */
function acCost(ckt: Circuit, points: number): number {
  if (!(points > 0)) return 0;
  const n = ckt.dim, ne = ckt.elements.length;
  const op = ckt.linear ? luFlops(n) + 2 * n * n : OP_ITERS * (luFlops(n) + 2 * n * n + n * n + ASM_ELEM * ne);
  return op + points * (4 * luFlops(n) + 8 * n * n + n * n + 2 * ASM_ELEM * ne);
}

/** Estimated flops of a full bench: the sum over its conditions. */
export function estimateCost(ckt: Circuit, conds: readonly CostCondition[]): CostEstimate {
  let steps = 0, tranFlops = 0, acFlops = 0, factors = 0, acPoints = 0, iters = ckt.linear ? 1 : DEFAULT_NEWTON_ITERS;
  for (const c of conds) {
    if (!c.noTran) { const t = tranCost(ckt, c); steps += t.steps; tranFlops += t.flops; factors += t.factors; iters = t.iters; }
    acPoints += c.acPoints ?? 0; acFlops += acCost(ckt, c.acPoints ?? 0);
  }
  return { dim: ckt.dim, linear: ckt.linear, steps, newtonIters: iters, factors, acPoints, tranFlops, acFlops, flops: tranFlops + acFlops };
}

/** The gate of §3.11: ok, or the teaching refusal `bench.cost.too-big` (English in locales/sim.en.ts). */
export function costGate(est: CostEstimate, limit: number = BENCH_FLOP_LIMIT): CostGate {
  return est.flops <= limit ? { ok: true, flops: est.flops } : { ok: false, key: 'bench.cost.too-big', vars: { flops: est.flops, limit, dim: est.dim, steps: est.steps } };
}

/** The condition `runBench(ckt, specs, o)` will simulate (worst case for a periodic settle), so the gate can run before any stepping. */
export function conditionOf(specs: readonly BenchSpec[], o: BenchOptions): CostCondition {
  const T = o.period ?? 0, N = Math.max(1, Math.round(o.measurePeriods ?? 1));
  const needsTran = specs.some((s) => s.kind !== 'mask' && s.kind !== 'safety' && s.kind !== 'rating' && s.kind !== 'predict') || typeof o.ratings === 'function'
    || specs.some((s) => s.kind === 'predict' || s.kind === 'rating' && (s.probes?.length ?? 0) > 0);
  const tStop = o.settle === 'periodic' ? ((o.maxPeriods ?? 50) + N) * T : (typeof o.settle === 'number' ? o.settle : 0) + (o.window ?? N * T);
  let acPoints = 0;
  for (const s of specs) {
    if (s.kind !== 'mask' || s.regions.length === 0) continue;
    let lo = Infinity, hi = 0;
    for (const r of s.regions) { lo = Math.min(lo, r.f1); hi = Math.max(hi, r.f2); }
    acPoints += (hi > lo ? logFreqs(lo, hi, s.perDecade ?? 20).length : 1) + 2 * s.regions.length;
  }
  return { h: o.h, tStop: tStop > 0 ? tStop : 0, noTran: !needsTran || !(tStop > 0), acPoints };
}
