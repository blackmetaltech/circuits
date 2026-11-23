// Transient analysis (DESIGN §3.5): fixed base step h₀, trapezoidal with a backward-Euler restart after t = 0 and after every
// source breakpoint, steps shortened to land exactly on breakpoints, Newton failure → halve h (≤ 10×, min h₀/1024) then grow ×2 per
// accepted step back to h₀. Never throws: failures are a result object with an i18n key + vars.
//
//   runTran(ckt, opts)            one call: init, advance to tStop, collect probe series.
//   tranInit(ckt, opts)           → { ok, st, failure }   `st` (TranState) is PLAIN JSON: x, device history, t, h, BE flag.
//   tranWork(ckt, st, reuse?)     → workspace (matrices, factor cache, breakpoint list): NOT serialisable, rebuilt from `st`.
//   tranAdvance(ws, st, k, cb?)   advance up to k accepted steps in place; resuming in chunks is bit-identical to one long run.
//
// Power-on (ic 'zero' or explicit): every C voltage and L current starts at 0 (or p.ic / the ic map), sources ramp in over 1 µs through
// ctx.lambda. Start from DC OP (ic 'op'): no ramp. State layout of C and L: state[so] = voltage / current, state[so+1] = current / voltage.
//
// REUSE: a linear time-invariant circuit's matrix depends only on (method, h), so the LU is cached per method and refactored only when
// h changes; sources only change b. Results are bit-identical with reuse off (the cached factor is of the identical matrix).
import type { CElem, Circuit, TranMethod } from './types';
import { assemble, nodeVoltage, StampCtx, terminalCurrents, terminalVoltages } from './stamp';
import { makeSolver, type LinearSolver } from './solver';
import { explainSingular, solveNewton, solveOp, type Failure } from './op';
import { POWER_ON_RAMP, waveBreakpoints } from './waveforms';

export type TranFailure = Failure;
export type IcSpec = 'zero' | 'op' | Record<string, number>;
export interface TranOptions {
  /** Base step h₀, s. */
  h: number;
  tStop: number;
  /** 'zero' (default, power-on), 'op' (start from the DC operating point) or { elementId: v0 (C, V) | i0 (L, A) } over zero. */
  ic?: IcSpec;
  /** Series to record: 'v(node)', 'v(a,b)', 'i(elementId)' (a→b through the element), 'p(elementId)' (absorbed power). */
  probes?: string[];
  /** Record every k-th accepted step (the first sample t = 0 and the last step are always kept). */
  decimate?: number;
  onStep?: (s: StepInfo) => void;
  /** 'auto' (default): BE restarts + TRAP. 'BE' / 'TRAP': force one method (tests, order of accuracy). */
  method?: 'auto' | 'BE' | 'TRAP';
  /** Power-on ramp of the sources (default: on unless ic = 'op'). */
  ramp?: boolean;
  gmin?: number;
  /** Cache the LU of linear circuits (default true). */
  reuse?: boolean;
}
export interface StepInfo { index: number; t: number; h: number; method: TranMethod; x: Float64Array; state: number[] }
export interface TranStats { steps: number; newtonIters: number; rejected: number }
export interface TranState {
  t: number; h: number; h0: number; tStop: number;
  x: number[]; state: number[];
  /** BE steps still owed (restart after t = 0 / a breakpoint); always 0 for forced methods. */
  be: number;
  method: 'auto' | 'BE' | 'TRAP';
  ramp: boolean; gmin: number;
  done: boolean;
  stats: TranStats;
}
export interface TranResult {
  ok: boolean;
  t: number[];
  series: Record<string, number[]>;
  failure: TranFailure | null;
  stats: TranStats;
  /** Final resumable state. */
  state: TranState;
}

export const MIN_H_DIVISOR = 1024;
const BP_EPS = 1e-9;

// ---------------------------------------------------------------- workspace
interface Cache { h: number; ok: boolean; solver: LinearSolver }
export interface TranWork {
  ckt: Circuit; ctx: StampCtx; reuse: boolean;
  x: Float64Array; xNew: Float64Array;
  cache: Record<TranMethod, Cache>;
  solver: LinearSolver;               // scratch solver for nonlinear circuits
  bp: number[]; bpHint: number;
  /** Elements with an event surface (§3.5); empty for every circuit without 555 / relay / fuse / regulator macros. */
  ev: CElem[];
  /** Event elements to fire on the step being accepted (scratch, reset by resolveEvents). */
  fire: Set<CElem>;
}

export function tranBreakpoints(ckt: Circuit, tStop: number, ramp: boolean): number[] {
  const all: number[] = [tStop];
  if (ramp && POWER_ON_RAMP < tStop) all.push(POWER_ON_RAMP);
  for (const e of ckt.elements) if (e.el.wave) for (const t of waveBreakpoints(e.el.wave, tStop)) all.push(t);
  all.sort((a, b) => a - b);
  const out: number[] = [];
  for (const t of all) if (out.length === 0 || t - out[out.length - 1] > BP_EPS * 1e-3) out.push(t);
  return out;
}

export function tranWork(ckt: Circuit, st: Pick<TranState, 'tStop' | 'ramp' | 'state'>, reuse = true): TranWork {
  const mk = (): Cache => ({ h: NaN, ok: false, solver: makeSolver(ckt.dim) });
  return {
    ckt, ctx: new StampCtx(ckt.dim, st.state), reuse, x: new Float64Array(ckt.dim), xNew: new Float64Array(ckt.dim),
    cache: { BE: mk(), TRAP: mk() }, solver: makeSolver(ckt.dim), bp: tranBreakpoints(ckt, st.tStop, st.ramp), bpHint: 0,
    ev: ckt.elements.filter((e) => e.dev.eventValue), fire: new Set<CElem>(),
  };
}

// ---------------------------------------------------------------- one nonlinear/linear solve at a given time
interface Solve { ok: boolean; iters: number; failure: Failure | null }
const failNC = (ckt: Circuit, t: number, h: number, idx: number): Failure => {
  const nm = idx >= 0 ? ckt.unknownNames[idx] : '-';
  const nodes = idx >= 0 && idx < ckt.n ? [ckt.netlist.nodeNames[idx + 1]] : [];
  return { code: 'noConverge', key: 'tran.noConverge', vars: { t, h, where: nm }, nodes, elements: [] };
};

/** Row equilibration (each row scaled to max |entry| = 1): the LU's pivot threshold is relative to max|A|, so the t = 0 snapshot (C ≈ ∞·, L ≈ 1/∞) needs it. */
function equilibrate(c: StampCtx): void {
  const n = c.dim;
  for (let i = 0; i < n; i++) {
    let m = 0; for (let j = 0; j < n; j++) { const v = Math.abs(c.A[i * n + j]); if (v > m) m = v; }
    if (m > 0) { const f = 1 / m; for (let j = 0; j < n; j++) c.A[i * n + j] *= f; c.b[i] *= f; }
  }
}

/** `rescue`: last resort at the smallest step: skip the "residual grew 2x" damping test for a residual at the rounding floor (~1e-16). A guess that already IS the answer
 * can fail that test on noise alone and spin to maxIter (found on the 1-1 LED + 220 ohm build). Only ever tried after every halving failed, so no trajectory that
 * converged before changes (the goldens stay bit-exact). */
function newton(ws: TranWork, gmin: number, tNew: number, lambda: number, method: TranMethod, h: number, xGuess: Float64Array, cacheable: boolean, equil = false, rescue = false): Solve {
  const { ckt, ctx } = ws, x = ws.x, xNew = ws.xNew;
  x.set(xGuess);
  const asm = { gmin, lambda, time: tNew, mode: 'tran' as const, method, h };
  if (ckt.linear) {
    ctx.x.set(x);
    assemble(ckt, ctx, asm);
    if (equil) equilibrate(ctx);
    const c = ws.cache[method];
    const solver = cacheable && ws.reuse ? c.solver : ws.solver;
    if (!(cacheable && ws.reuse) || c.h !== h) {
      const f = solver.factor(ctx.A);
      if (cacheable && ws.reuse) { c.h = h; c.ok = f.ok; }
      if (!f.ok) return { ok: false, iters: 1, failure: explainSingular(ckt, ctx.A, f.badColumn) };
    } else if (!c.ok) return { ok: false, iters: 1, failure: explainSingular(ckt, ctx.A, -1) };
    solver.solve(ctx.b, xNew);
    for (let i = 0; i < ckt.dim; i++) if (!Number.isFinite(xNew[i])) return { ok: false, iters: 1, failure: failNC(ckt, tNew, h, i) };
    x.set(xNew);
    return { ok: true, iters: 1, failure: null };
  }
  // nonlinear: op.ts `solveNewton` (damped Newton, limit hooks, KCL residual test) at this time / method / h
  const opts = {
    gmin, lambda, time: tNew, mode: 'tran' as const, method, h, maxIter: 50, state: ctx.state,
    ws: { ctx, solver: ws.solver, xNew },
    extra: equil ? (c: StampCtx) => equilibrate(c) : undefined,
  };
  const r = solveNewton(ckt, x, rescue ? { ...opts, noiseFloor: 1e-10, abstol: 1e-9 } : opts);
  x.set(r.x);
  if (r.ok) return { ok: true, iters: r.iterations, failure: null };
  if (r.reason === 'singular') return { ok: false, iters: r.iterations, failure: explainSingular(ckt, ctx.A, r.badColumn) };
  return { ok: false, iters: r.iterations, failure: failNC(ckt, tNew, h, r.reason === 'nonfinite' ? r.x.findIndex((v) => !Number.isFinite(v)) : r.worst) };
}

const rampAt = (ramp: boolean, t: number): number => (ramp ? Math.min(1, t / POWER_ON_RAMP) : 1);

// ---------------------------------------------------------------- init
export function tranInit(ckt: Circuit, o: TranOptions): { ok: boolean; st: TranState; failure: TranFailure | null } {
  const ic = o.ic ?? 'zero', ramp = o.ramp ?? ic !== 'op', gmin = o.gmin ?? 1e-12;
  const method = o.method ?? 'auto';
  const st: TranState = {
    t: 0, h: o.h, h0: o.h, tStop: o.tStop, x: new Array(ckt.dim).fill(0), state: new Array(ckt.stateSize).fill(0),
    be: method === 'auto' ? 1 : 0, method, ramp, gmin, done: false, stats: { steps: 0, newtonIters: 0, rejected: 0 },
  };
  if (!(o.h > 0) || !(o.tStop >= 0)) return { ok: false, st, failure: { code: 'singular', key: 'solve.badValue', vars: { detail: 'time step' }, nodes: [], elements: [] } };
  if (ic === 'op') {
    const op = solveOp(ckt, { gmin, state: st.state });
    if (!op.ok) return { ok: false, st, failure: op.failure };
    for (const e of ckt.elements) e.dev.initState?.(e, op.x, st.state);
    st.x = Array.from(op.x);
    return { ok: true, st, failure: null };
  }
  let any = false;
  for (const e of ckt.elements) {
    if (e.dev.kind !== 'C' && e.dev.kind !== 'L') continue;
    const v0 = typeof ic === 'object' && ic[e.el.id] !== undefined ? ic[e.el.id] : e.el.p.ic ?? 0;
    if (v0 !== 0) { st.state[e.so] = v0; any = true; }
  }
  if (any) {
    // t = 0 snapshot consistent with the initial conditions: BE with a small step turns C into a v0 source and L into an i0 source.
    // Three steps h₁, h₁/2, h₁/4 (h₁ = 1e-2·h₀), Richardson-extrapolated to h → 0 (error O(h₁³)); this also yields the C current / L
    // voltage (slot 1 of their history), which TRAP needs consistent at t = 0 (h₁ not tinier: v − v₀ would drown in roundoff).
    // The exact IC stays in slot 0. Rows are equilibrated (the LU pivot threshold is relative to max|A|).
    let fl: Failure | null = null;
    const lam = rampAt(ramp, 0), ws = tranWork(ckt, st, false);
    const snap = (hh: number): { x: Float64Array; s1: number[] } | null => {
      const r = newton(ws, gmin, 0, lam, 'BE', hh, ws.x, false, true);
      if (!r.ok) { fl = r.failure; return null; }
      const tmp = st.state.slice();
      for (const e of ckt.elements) if (e.dev.kind === 'C' || e.dev.kind === 'L') e.dev.update?.(e, ws.x, tmp, 'BE', hh);
      return { x: Float64Array.from(ws.x), s1: ckt.elements.map((e) => tmp[e.so + 1] ?? 0) };
    };
    type Snap = ReturnType<typeof snap>;
    let a1: Snap = null, a2: Snap = null, a3: Snap = null;
    for (const f of [1e-2, 1e-1, 1e-3, 1e-4]) { a1 = snap(o.h * f); a2 = a1 && snap(o.h * f / 2); a3 = a2 && snap(o.h * f / 4); if (a3) break; }
    if (!a1 || !a2 || !a3) return { ok: false, st, failure: fl };
    const ex = (u: number, v: number, w: number): number => (8 * w - 6 * v + u) / 3;
    st.x = Array.from(a3.x, (w, i) => ex(a1!.x[i], a2!.x[i], w));
    ckt.elements.forEach((e, k) => { if (e.dev.kind === 'C' || e.dev.kind === 'L') st.state[e.so + 1] = ex(a1!.s1[k], a2!.s1[k], a3!.s1[k]); });
  }
  return { ok: true, st, failure: null };
}

// ---------------------------------------------------------------- advance

// ---------------------------------------------------------------- events (§3.5)
/**
 * After a converged step of length hs: evaluate every event surface g at the step start (history state, x = xs, h = 0) and end (ws.x, h = hs).
 *  - g0 > 0 and g1 ≤ 0: a crossing. The earliest (smallest linear-interpolation fraction) is refined by false position with bisection safeguards
 *    (≤ 10 re-solves of the shortened step, stops when |g| ≤ 1e-9·(|g0| + |g1|) or the bracket is < 1e-7 of the step); the step is accepted at the
 *    refined time, that element fires (plus any other element with g ≤ 0 there).
 *  - g0 ≤ 0 and g1 ≤ 0: the condition already held at the start (power-up): fire at the end of this step, no refinement.
 * ws.x holds the solution of the step to accept, ws.fire the elements to fire. Never touches `st`.
 */
function resolveEvents(ws: TranWork, st: TranState, xs: Float64Array, method: TranMethod, hs: number, tNew: number): { h: number; t: number; fired: boolean; failure: TranFailure | null } {
  ws.fire.clear();
  const margin = (e: CElem, x: Float64Array, h: number): number => e.dev.eventValue!(e, x, st.state, h);
  let tgt: CElem | null = null, g0t = 0, g1t = 0, best = Infinity;
  const late: CElem[] = [];
  for (const e of ws.ev) {
    const g0 = margin(e, xs, 0), g1 = margin(e, ws.x, hs);
    if (g1 > 0) continue;
    if (g0 <= 0) { late.push(e); continue; }
    const f = g0 / (g0 - g1);
    if (f < best) { best = f; tgt = e; g0t = g0; g1t = g1; }
  }
  let h = hs, t = tNew;
  if (tgt) {
    let lo = 0, hi = 1, glo = g0t, ghi = g1t, f = Math.min(Math.max(best, 1e-6), 1 - 1e-6), last = 1;
    const tol = 1e-9 * (Math.abs(g0t) + Math.abs(g1t));
    for (let it = 0; it < 10; it++) {
      const hTry = hs * f, r = newton(ws, st.gmin, st.t + hTry, rampAt(st.ramp, st.t + hTry), method, hTry, xs, true);
      st.stats.newtonIters += r.iters; st.stats.rejected++;
      if (!r.ok) break;
      last = f;
      const g = margin(tgt, ws.x, hTry);
      if (g <= 0) { hi = f; ghi = g; } else { lo = f; glo = g; }
      if (Math.abs(g) <= tol || hi - lo <= 1e-7) break;
      const fp = lo + (glo * (hi - lo)) / (glo - ghi);
      f = it % 3 === 2 || !(fp > lo && fp < hi) ? 0.5 * (lo + hi) : fp;
    }
    if (last !== f || last === 1) {
      // the final solve failed (or never ran): redo the accepted point so ws.x matches h
      const hTry = hs * last, r = newton(ws, st.gmin, st.t + hTry, rampAt(st.ramp, st.t + hTry), method, hTry, xs, true);
      if (!r.ok) return { h, t, fired: false, failure: r.failure };
    }
    h = hs * last; t = st.t + h;
    ws.fire.add(tgt);
    for (const e of ws.ev) if (e !== tgt && margin(e, ws.x, h) <= 0 && margin(e, xs, 0) > 0) ws.fire.add(e);
  }
  for (const e of late) ws.fire.add(e);
  return { h, t, fired: ws.fire.size > 0, failure: null };
}
function nextBreakpoint(ws: TranWork, t: number): number {
  const bp = ws.bp;
  while (ws.bpHint > 0 && bp[ws.bpHint - 1] > t + BP_EPS * 1e-3) ws.bpHint--;
  while (ws.bpHint < bp.length && bp[ws.bpHint] <= t + BP_EPS * 1e-3) ws.bpHint++;
  return ws.bpHint < bp.length ? bp[ws.bpHint] : Infinity;
}

/** Element kinds with no stored energy on the circuit's time scale: memoryless devices, sources, and the op-amp / comparator macros whose internal pole (microseconds) is far
 *  shorter than any bench step. A circuit made only of these is quasi-static: its state at a time is its DC operating point there. */
const QUASI_STATIC = new Set(['R', 'V', 'I', 'BAT', 'BENCH', 'AM', 'E', 'G', 'D', 'Q', 'DAR', 'M', 'OA', 'CMP', 'LOGIC', 'NTCT', 'SWT']);
const quasiStatic = (ckt: Circuit): boolean => ckt.elements.every((e) => QUASI_STATIC.has(e.dev.kind));
/**
 * The quasi-static rescue (chapter 6, 6-5): a comparator with positive feedback (a Schmitt trigger) switches regeneratively, far faster than the smallest step (its loop gain is ~1e5 over a
 * 1.9 us pole), and at the switch point the step's Newton system has a fold: the only solution is on the other branch and Newton cannot reach it. When every halving and the rescue pass
 * have failed AND the circuit is quasi-static, the step is solved as the DC operating point at tNew (the full homotopy chain of solveOp, seeded by the last accepted step) and the macros'
 * internal history is re-seeded there: the switch is taken to finish within the step, which is what a 1.3 us comparator does inside a 20 us step. Only ever tried where the
 * stepper used to give up, so no trajectory that converged before changes. Null when the DC solve fails too.
 */
function quasiStaticStep(ckt: Circuit, st: TranState, xs: Float64Array, tNew: number, lambda: number): Float64Array | null {
  const state = st.state.slice();
  const op = solveOp(ckt, { x0: xs, time: tNew, lambda, gmin: st.gmin, state });
  if (!op.ok) return null;
  for (const e of ckt.elements) e.dev.initState?.(e, op.x, st.state);
  return op.x;
}

/** Advance up to k accepted steps (until tStop). Returns the number taken and a failure (state is left at the last accepted step). */
export function tranAdvance(ws: TranWork, st: TranState, k: number, cb?: (s: StepInfo) => void): { steps: number; failure: TranFailure | null } {
  const ckt = ws.ckt;
  ws.ctx.state = st.state;
  let taken = 0;
  const xs = Float64Array.from(st.x);
  while (taken < k && !st.done) {
    if (st.t >= st.tStop) { st.done = true; break; }
    // a circuit the stepper keeps rejecting (halve, accept a sliver, double, reject again) must end: more than 8 times the planned steps and 10000 more is a failure to converge, not a long run
    if (st.stats.steps > 8 * (st.tStop / st.h0) + 10000) return { steps: taken, failure: { code: 'noConverge', key: 'tran.noConverge', vars: { t: st.t }, nodes: [], elements: [] } };
    const method: TranMethod = st.method === 'BE' ? 'BE' : st.method === 'TRAP' ? 'TRAP' : st.be > 0 ? 'BE' : 'TRAP';
    for (;;) {
      const nb = Math.min(nextBreakpoint(ws, st.t), st.tStop);
      const land = nb - st.t <= st.h + BP_EPS * st.h0;
      const hs = land ? nb - st.t : st.h, tNew = land ? nb : st.t + hs;
      let r = newton(ws, st.gmin, tNew, rampAt(st.ramp, tNew), method, hs, xs, true);
      st.stats.newtonIters += r.iters;
      if (!r.ok && r.failure!.code !== 'singular' && st.h * 0.5 < st.h0 / MIN_H_DIVISOR * (1 - 1e-12)) {   // out of halvings: the rescue pass before giving up
        r = newton(ws, st.gmin, tNew, rampAt(st.ramp, tNew), method, hs, xs, true, false, true);
        st.stats.newtonIters += r.iters;
      }
      if (!r.ok && r.failure!.code !== 'singular' && st.h * 0.5 < st.h0 / MIN_H_DIVISOR * (1 - 1e-12) && quasiStatic(ckt)) {   // still stuck: a circuit with no stored energy may jump to its DC point
        const q = quasiStaticStep(ckt, st, xs, tNew, rampAt(st.ramp, tNew));
        if (q) { ws.x.set(q); r = { ok: true, iters: 0, failure: null }; }
      }
      if (!r.ok) {
        st.stats.rejected++;
        if (r.failure!.code === 'singular' || st.h * 0.5 < st.h0 / MIN_H_DIVISOR * (1 - 1e-12)) return { steps: taken, failure: r.failure };
        st.h *= 0.5;
        continue;
      }
      let hAcc = hs, tAcc = tNew, fired = false;
      if (ws.ev.length) {
        const ev = resolveEvents(ws, st, xs, method, hs, tNew);
        if (ev.failure) return { steps: taken, failure: ev.failure };
        hAcc = ev.h; tAcc = ev.t; fired = ev.fired;
      }
      for (const e of ckt.elements) e.dev.update?.(e, ws.x, st.state, method, hAcc);
      if (fired) for (const e of ws.ev) if (ws.fire.has(e)) e.dev.fire!(e, ws.x, st.state);
      xs.set(ws.x);
      for (let i = 0; i < ckt.dim; i++) st.x[i] = xs[i];
      st.t = tAcc; st.stats.steps++; taken++;
      if (st.method === 'auto') st.be = (land && hAcc === hs && nb < st.tStop) || fired ? 1 : st.be > 0 ? st.be - 1 : 0;
      st.h = Math.min(st.h0, st.h * 2);
      if (st.t >= st.tStop - BP_EPS * st.h0 * 1e-3) st.done = true;
      cb?.({ index: st.stats.steps, t: st.t, h: hAcc, method, x: xs, state: st.state });
      break;
    }
  }
  return { steps: taken, failure: null };
}

// ---------------------------------------------------------------- probes
/** Accessor for a probe name; throws on an unknown node / element (developer error, not a player path). */
export function makeProbe(ckt: Circuit, name: string): (x: Float64Array, state: number[]) => number {
  const m = /^([vip])\(([^)]*)\)$/i.exec(name.trim());
  if (!m) throw new Error(`bad probe '${name}'`);
  const kind = m[1].toLowerCase(), arg = m[2].split(',').map((s) => s.trim());
  const node = (n: string): number => { const k = n.toLowerCase() === 'gnd' ? 0 : ckt.nodeIndex[n.toLowerCase()]; if (k === undefined) throw new Error(`no node ${n}`); return k; };
  if (kind === 'v') {
    const a = node(arg[0]), b = arg[1] === undefined ? 0 : node(arg[1]);
    return (x) => nodeVoltage(x, a) - nodeVoltage(x, b);
  }
  const k = ckt.elementIndex[arg[0]]; if (k === undefined) throw new Error(`no element ${arg[0]}`);
  const e: CElem = ckt.elements[k];
  if (kind === 'i') return (x, s) => terminalCurrents(e, x, s)[0];
  return (x, s) => { const v = terminalVoltages(e, x), i = terminalCurrents(e, x, s); let p = 0; for (let t = 0; t < v.length; t++) p += v[t] * i[t]; return p; };
}

// ---------------------------------------------------------------- one-call API
export function runTran(ckt: Circuit, o: TranOptions): TranResult {
  const init = tranInit(ckt, o);
  const t: number[] = [], series: Record<string, number[]> = {};
  const probes = (o.probes ?? []).map((n) => { series[n] = []; return { n, f: makeProbe(ckt, n) }; });
  if (!init.ok) return { ok: false, t, series, failure: init.failure, stats: init.st.stats, state: init.st };
  const st = init.st, ws = tranWork(ckt, st, o.reuse ?? true), dec = Math.max(1, o.decimate ?? 1);
  const sample = (tt: number, x: Float64Array): void => { t.push(tt); for (const p of probes) series[p.n].push(p.f(x, st.state)); };
  sample(0, Float64Array.from(st.x));
  let last = 0;
  const r = tranAdvance(ws, st, Infinity, (s) => {
    o.onStep?.(s);
    last = s.index;
    if (s.index % dec === 0) sample(s.t, s.x);
  });
  if (!r.failure && last % dec !== 0 && last > 0) sample(st.t, Float64Array.from(st.x));
  return { ok: !r.failure, t, series, failure: r.failure, stats: st.stats, state: st };
}
