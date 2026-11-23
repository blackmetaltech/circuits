// DC operating point (DESIGN §3.3, §3.4, §3.10). Never throws to the caller: failures are a result object with an i18n key.
//   linear circuit → one assemble + factor + solve.
//   nonlinear      → `solveNewton` (damped Newton, limit hooks, reltol 1e-4 / vntol 1e-6 / abstol 1e-12 + KCL residual test), then
//                    the homotopy chain when plain Newton fails: gmin stepping → source stepping → pseudo-transient → explained failure.
//                    CIRCUITS keeps its own flat-array Newton loop (core `newton` takes number[][] Jacobians and a vector F; the MNA loop needs
//                    the factored flat matrix, device limit hooks writing into x, and in-place buffers per iteration): same algorithm
//                    family (limiter hook, damping, homotopy) but on Float64Array, no per-iteration allocation of rows.
//   initial guess  → opts.x0 (previous solution) else zeros with every diode junction seeded at 0.6 V above its cathode (diode-ON guess,
//                    `seedDiode`); source stepping and pseudo-transient start from all zeros (the unpowered circuit).
//   loops          → every loop is bounded by iteration counts (no wall clock: determinism).
//   topology       → blocking issues (ideal-source loop, shorted ideal source, current cutset) are returned WITHOUT solving.
//   singular       → core `singularityReport` names the nodes / elements; result.failure carries key 'solve.singular'.
import { singularityReport } from '@core/numerics';
import type { Circuit, TopoIssue, TranMethod } from './types';
import { seedDiode } from './devices/diode';
import { assemble, nodeVoltage, StampCtx } from './stamp';
import { makeSolver, type LinearSolver } from './solver';

export interface Workspace { ctx: StampCtx; solver: LinearSolver; xNew: Float64Array }
export const makeWorkspace = (ckt: Circuit, state: number[] = new Array(ckt.stateSize).fill(0)): Workspace =>
  ({ ctx: new StampCtx(ckt.dim, state), solver: makeSolver(ckt.dim), xNew: new Float64Array(ckt.dim) });

export interface OpOptions {
  gmin?: number;               // node-to-ground shunt, S (default 1e-12)
  lambda?: number;             // source scale (source stepping target), default 1
  x0?: Float64Array;           // initial guess
  maxIter?: number;            // Newton, default 150
  reltol?: number; vntol?: number; abstol?: number;
  ws?: Workspace;              // reuse buffers
  state?: number[];            // device history
  /** false → plain Newton only (no homotopy chain). Default true. */
  homotopy?: boolean;
  /** Stages to skip (tests and diagnostics: measure each homotopy stage on its own). Default none. */
  skip?: readonly OpStrategy[];
  /** Time at which time-dependent sources and elements are evaluated (default 0): the transient's quasi-static rescue solves the DC point at the step's time. */
  time?: number;
}
export interface Failure { code: 'topology' | 'singular' | 'noConverge'; key: string; vars: Record<string, string | number>; nodes: string[]; elements: string[] }
export type OpStrategy = 'linear' | 'newton' | 'gmin' | 'source' | 'pseudo';
export interface OpResult {
  ok: boolean;
  /** Solution; on failure the best (smallest-residual) state reached ("last good state"). */
  x: Float64Array;
  iterations: number;
  strategy: OpStrategy;
  /** Topology findings (all severities) for this circuit. */
  issues: TopoIssue[];
  failure: Failure | null;
  /** Stages attempted in order (e.g. ['newton','gmin']); the last one solved it when ok. */
  tried?: OpStrategy[];
  /** Total Newton iterations over every stage. */
  totalIterations?: number;
}

function fail(ckt: Circuit, f: Failure, iterations = 0): OpResult {
  return { ok: false, x: new Float64Array(ckt.dim), iterations, strategy: ckt.linear ? 'linear' : 'newton', issues: ckt.issues, failure: f };
}

/** Explain a singular matrix with core `singularityReport`: which node unknowns and which branch elements are involved. */
export function explainSingular(ckt: Circuit, A: Float64Array, badColumn: number): Failure {
  const rows: number[][] = [];
  for (let i = 0; i < ckt.dim; i++) rows.push(Array.from(A.subarray(i * ckt.dim, (i + 1) * ckt.dim)));
  let unknowns: number[] = badColumn >= 0 ? [badColumn] : [], eqs: number[] = [];
  try { const r = singularityReport(rows, { tol: 1e-14 * Math.max(1e-300, ...rows.map((r2) => Math.max(...r2.map(Math.abs)))) }); if (r.singular) { unknowns = r.unknowns; eqs = r.equations; } } catch { /* keep badColumn */ }
  const nodes = new Set<string>(), elements = new Set<string>();
  const owner = (i: number): void => {
    if (i < ckt.n) nodes.add(ckt.netlist.nodeNames[i + 1]);
    else for (const e of ckt.elements) if (e.branch.includes(i) || e.internal.includes(i)) elements.add(e.el.id);
  };
  unknowns.forEach(owner); eqs.forEach(owner);
  // equations at node rows also implicate the elements touching that node
  if (elements.size === 0 && nodes.size > 0) for (const e of ckt.elements) if (e.nodes.some((k) => k >= 0 && k < ckt.n && nodes.has(ckt.netlist.nodeNames[k + 1]))) elements.add(e.el.id);
  const nn = [...nodes], ee = [...elements];
  return { code: 'singular', key: 'solve.singular', vars: { nodes: nn.join(', ') || '-', elements: ee.join(', ') || '-' }, nodes: nn, elements: ee };
}

// ------------------------------------------------------------------------------------------------ Newton
export interface NewtonOpts {
  lambda?: number;             // source scale (default 1)
  gmin?: number;               // node-to-ground + junction shunt (default 1e-12)
  mode?: 'dc' | 'tran';        // tran → devices stamp stampTran(method, h)
  method?: TranMethod; h?: number; time?: number;
  maxIter?: number;            // default 150 for DC, 25 for mode 'tran'
  reltol?: number; vntol?: number; abstol?: number;
  /** KCL residual floor, A (default 1e-9). Converged needs |residual_i| ≤ kclAbs + reltol·(largest branch current at node i). */
  kclAbs?: number;
  /** Max step halvings when the residual norm grows more than 2x (default 6). */
  maxHalvings?: number;
  /** Residual 2-norm at or below which the damping test is skipped (default 0: always on). A retry after a stall at the rounding floor sets ~1e-12. */
  noiseFloor?: number;
  ws?: Workspace;
  state?: number[];
  /** Extra stamps added after assembly (pseudo-transient capacitors). */
  extra?: (c: StampCtx, x: Float64Array) => void;
}
export interface NewtonResult {
  ok: boolean;
  /** Final iterate (fresh array). Its stamp is left in `ws.ctx` (A, b assembled AT this x: usable for AC linearisation). */
  x: Float64Array;
  /** Newton solves performed. */
  iterations: number;
  reason: 'converged' | 'maxIter' | 'singular' | 'nonfinite';
  /** max |KCL residual| over node rows at x, A (stamp residual: A(x)·x − b). */
  residual: number;
  /** Index of the unknown (node row) with the largest residual, −1 if none. */
  worst: number;
  /** Failing column when reason is 'singular'. */
  badColumn: number;
  /** Iterations in which a device limiter changed the step. */
  limitedIters: number;
}

/** Node-row residual of the assembled system at x: r_i = Σ_j A_ij·x_j − b_i (equals the true nonlinear KCL because companions are stamped at x). */
function nodeResidual(c: StampCtx, x: Float64Array, nn: number, r: Float64Array): number {
  // returns the 2-norm over ALL rows (node KCL in A, branch constraints in V: a starting point that violates a source equation has
  // a large residual, so the damping test can't be fooled by an all-zero KCL at x = 0); r holds every row, tests use the first nn.
  const dim = c.dim; let s = 0;
  for (let i = 0; i < dim; i++) {
    let a = -c.b[i]; const row = i * dim;
    for (let j = 0; j < dim; j++) a += c.A[row + j] * x[j];
    r[i] = a; s += a * a;
  }
  return Math.sqrt(s);
}

/** KCL test: |r_i| ≤ kclAbs + reltol · (largest branch current touching node i, from the models' terminalCurrents). */
function kclOk(ckt: Circuit, c: StampCtx, x: Float64Array, nn: number, r: Float64Array, kclAbs: number, reltol: number): boolean {
  const scale = new Float64Array(nn);
  for (const e of ckt.elements) {
    const tc = e.dev.terminalCurrents(e, x, c.state);
    let big = 0; for (const v of tc) if (Math.abs(v) > big) big = Math.abs(v);
    for (let t = 0; t < e.nodes.length; t++) { const k = e.nodes[t]; if (k >= 0 && k < nn) scale[k] = Math.max(scale[k], Math.abs(tc[t])); }
    for (const k of e.internal) if (k < nn) scale[k] = Math.max(scale[k], big);
  }
  for (let i = 0; i < nn; i++) if (!(Math.abs(r[i]) <= kclAbs + reltol * scale[i])) return false;
  return true;
}

/**
 * Damped Newton on the MNA system at a given source scale / time / companion state. Reusable per transient step.
 *   iteration k: stamp at x_k → residual → (damp if ‖r‖ grew > 2x: halve the step back toward x_{k−1}, ≤ 6 times) → test → solve → limit.
 *   converged ⇔ the step into x_k was a full unlimited Newton step, every unknown moved by ≤ reltol·max(|x|) + vntol|abstol,
 *   AND the KCL residual at x_k is ≤ 1e-9 A + reltol·(largest branch current at the node). A limited or damped step never counts.
 * Never throws; non-convergence is a result.
 */
export function solveNewton(ckt: Circuit, x0: ArrayLike<number>, o: NewtonOpts = {}): NewtonResult {
  const dim = ckt.dim, nn = ckt.n + ckt.nInternal;
  const ws = o.ws ?? makeWorkspace(ckt, o.state);
  const c = ws.ctx; if (o.state) c.state = o.state;
  const tran = o.mode === 'tran';
  const maxIter = o.maxIter ?? (tran ? 25 : 150);
  const reltol = o.reltol ?? 1e-4, vntol = o.vntol ?? 1e-6, abstol = o.abstol ?? 1e-12, kclAbs = o.kclAbs ?? 1e-9, maxHalv = o.maxHalvings ?? 6, noiseFloor = o.noiseFloor ?? 0;
  const asm = { gmin: o.gmin ?? 1e-12, lambda: o.lambda ?? 1, time: o.time ?? 0, mode: o.mode ?? 'dc', method: o.method ?? 'BE', h: o.h ?? 0 } as const;
  const x = new Float64Array(dim), xp = new Float64Array(dim), d = new Float64Array(dim), xNew = ws.xNew, r = new Float64Array(dim);
  for (let i = 0; i < dim; i++) x[i] = x0[i] ?? 0;
  const stamp = (): number => { c.x.set(x); assemble(ckt, c, asm); o.extra?.(c, x); return nodeResidual(c, x, nn, r); };
  const worstOf = (): { res: number; at: number } => { let m = 0, at = -1; for (let i = 0; i < nn; i++) if (Math.abs(r[i]) > m || at < 0) { m = Math.abs(r[i]); at = i; } return { res: m, at }; };
  const res = (reason: NewtonResult['reason'], it: number, bad = -1, lim = 0): NewtonResult => { const w = worstOf(); return { ok: reason === 'converged', x, iterations: it, reason, residual: w.res, worst: w.at, badColumn: bad, limitedIters: lim }; };

  let prevNorm = Infinity, stepFull = false, limitedIters = 0;
  for (let it = 1; it <= maxIter + 1; it++) {
    let norm = stamp();
    let damped = false;
    // (a residual already at the rounding floor, ~1e-16, jitters by more than 2x between iterations: that is noise, not divergence, and must never block convergence)
    const noisy = (n: number): boolean => n <= noiseFloor;
    if (it > 1 && norm > 2 * prevNorm && !noisy(norm)) {
      for (let h = 1; h <= maxHalv && norm > 2 * prevNorm && !noisy(norm); h++) {
        const a = 1 / (1 << h);
        for (let i = 0; i < dim; i++) x[i] = xp[i] + d[i] * a;
        norm = stamp(); damped = true;
      }
    }
    if (it > 1 && stepFull && !damped && kclOk(ckt, c, x, nn, r, kclAbs, reltol)) {
      // converged by the §3.3 criteria; take ONE more unlimited Newton step (quadratic convergence makes it ~free accuracy: the
      // residual drops far below the 1e-4 criterion, so downstream KCL / device-consistency checks hold at 1e-6 or better)
      if (ws.solver.factor(c.A).ok) {
        ws.solver.solve(c.b, xNew);
        let finite = true; for (let i = 0; i < dim; i++) if (!Number.isFinite(xNew[i])) finite = false;
        if (finite) { xp.set(x); x.set(xNew); if (stamp() > norm) { x.set(xp); stamp(); } }
      }
      return res('converged', it - 1, -1, limitedIters);
    }
    if (it > maxIter) break;
    prevNorm = norm;
    const f = ws.solver.factor(c.A);
    if (!f.ok) return res('singular', it, f.badColumn, limitedIters);
    ws.solver.solve(c.b, xNew);
    let limited = false;
    for (const e of ckt.elements) if (e.dev.limit?.(e, xNew, x)) limited = true;
    if (limited) limitedIters++;
    let conv = !limited;
    for (let i = 0; i < dim; i++) {
      const v = xNew[i];
      if (!Number.isFinite(v)) return res('nonfinite', it, -1, limitedIters);
      if (conv && Math.abs(v - x[i]) > reltol * Math.max(Math.abs(v), Math.abs(x[i])) + (i < nn ? vntol : abstol)) conv = false;
    }
    for (let i = 0; i < dim; i++) { xp[i] = x[i]; d[i] = xNew[i] - x[i]; x[i] = xNew[i]; }
    stepFull = conv;
  }
  return res('maxIter', maxIter, -1, limitedIters);
}

// ------------------------------------------------------------------------------------------------ operating point
function seedGuess(ckt: Circuit): Float64Array {
  const x = new Float64Array(ckt.dim);
  for (const e of ckt.elements) if (e.dev.kind === 'D') seedDiode(e, x);
  return x;
}

const GMIN_STAGES = [1e-2, 1e-3, 1e-4, 1e-5, 1e-6, 1e-7, 1e-8, 1e-9, 1e-10, 1e-11, 1e-12];
const SOURCE_ATTEMPTS = 400;
const PSEUDO_STEPS = 2000;
const PSEUDO_C = 1e-6;

interface Stage { ok: boolean; x: Float64Array; iters: number; best?: { x: Float64Array; res: number } }

export function solveOp(ckt: Circuit, o: OpOptions = {}): OpResult {
  const blocking = ckt.issues.filter((i) => i.severity === 'block');
  if (blocking.length) {
    const b = blocking[0];
    return fail(ckt, { code: 'topology', key: b.key, vars: b.vars, nodes: b.nodes, elements: b.elements });
  }
  if (ckt.dim === 0) return { ok: true, x: new Float64Array(0), iterations: 0, strategy: 'linear', issues: ckt.issues, failure: null };
  const gmin = o.gmin ?? 1e-12, lambda = o.lambda ?? 1;
  const ws = o.ws ?? makeWorkspace(ckt, o.state);
  const c = ws.ctx;
  if (o.state) c.state = o.state;

  if (ckt.linear) {
    const x = new Float64Array(ckt.dim);
    c.x.set(o.x0 ?? x);
    assemble(ckt, c, { gmin, lambda, time: o.time ?? 0 });
    const f = ws.solver.factor(c.A);
    if (!f.ok) return fail(ckt, explainSingular(ckt, c.A, f.badColumn), 1);
    ws.solver.solve(c.b, x);
    return { ok: true, x, iterations: 1, strategy: 'linear', issues: ckt.issues, failure: null };
  }

  const base = { gmin, lambda, reltol: o.reltol, vntol: o.vntol, abstol: o.abstol, ws, state: o.state, time: o.time };
  const maxIter = o.maxIter ?? 150;
  const tried: OpStrategy[] = [];
  let total = 0;
  let best: { x: Float64Array; res: number } | null = null;
  let plainSingular = false, singularCol = -1, singularIter = 0;
  const note = (x: Float64Array, res: number): void => { if (Number.isFinite(res) && (!best || res < best.res)) best = { x: Float64Array.from(x), res }; };
  const done = (strategy: OpStrategy, x: Float64Array, iterations: number): OpResult =>
    ({ ok: true, x, iterations, strategy, issues: ckt.issues, failure: null, tried: tried.slice(), totalIterations: total });

  // 1. plain Newton
  const seed = o.x0 ? Float64Array.from(o.x0) : seedGuess(ckt);
  const skip = o.skip ?? [];
  const plain = skip.includes('newton') ? null : solveNewton(ckt, seed, { ...base, maxIter });
  if (plain) tried.push('newton');
  if (plain) total += plain.iterations;
  if (plain?.ok) return done('newton', plain.x, plain.iterations);
  // A "singular" pivot test in the middle of a diode chain (one junction ON at 1e7 S next to one OFF at 1e-12 S) is a numerical
  // artefact of that iterate, not a property of the circuit: let the homotopy stages try. A circuit that is singular for real
  // (nothing ever produced a finite residual) is reported as singular at the end.
  if (plain && plain.reason === 'singular') { plainSingular = true; singularCol = plain.badColumn; singularIter = plain.iterations; }
  else if (plain) note(plain.x, plain.residual);
  if (o.homotopy === false) return noConverge(ckt, ws, best, base, total, tried, plainSingular ? { col: singularCol, it: singularIter } : null);

  // 2. gmin stepping: shunt 1e-2 → 1e-12 S, one decade per stage, each seeded by the last
  if (!skip.includes('gmin')) {
    tried.push('gmin');
    let x: Float64Array = seed, ok = true;
    for (const g of GMIN_STAGES) {
      const r = solveNewton(ckt, x, { ...base, gmin: Math.max(g, gmin), maxIter: Math.min(maxIter, 100) });
      total += r.iterations; x = r.x;
      if (!r.ok) { note(r.x, r.residual); ok = false; break; }
    }
    if (ok) return done('gmin', x, total);
  }

  // 3. source stepping: λ 0 → target, step 0.1, ×2 on success, ÷2 on failure, min 1e-4 (bounded by attempts)
  if (!skip.includes('source')) {
    tried.push('source');
    let x: Float64Array = new Float64Array(ckt.dim), lam = 0, step = 0.1, ok = true;
    const r0 = solveNewton(ckt, x, { ...base, lambda: 0, maxIter: 50 });
    total += r0.iterations; x = r0.x;
    if (!r0.ok) ok = false;
    for (let a = 0; ok && lam < lambda; a++) {
      if (a >= SOURCE_ATTEMPTS) { ok = false; break; }
      const tryL = Math.min(lambda, lam + step);
      const r = solveNewton(ckt, x, { ...base, lambda: tryL, maxIter: 50 });
      total += r.iterations;
      if (r.ok) { lam = tryL; x = r.x; step = Math.min(step * 2, 1); }
      else { note(r.x, r.residual); step /= 2; if (step < 1e-4) ok = false; }
    }
    if (ok) return done('source', x, total);
  }

  // 4. pseudo-transient: 1 µF from every node to ground, backward Euler from the unpowered state until steady, then a DC polish
  if (!skip.includes('pseudo')) {
    tried.push('pseudo');
    const nn = ckt.n + ckt.nInternal;
    let x: Float64Array = new Float64Array(ckt.dim), h = 1e-7, lastTry = -100;
    const xo = new Float64Array(ckt.dim);
    const extra = (cc: StampCtx): void => { const g = PSEUDO_C / h; for (let i = 0; i < nn; i++) { cc.A[i * cc.dim + i] += g; cc.b[i] += g * xo[i]; } };
    for (let s = 0; s < PSEUDO_STEPS; s++) {
      xo.set(x);
      const r = solveNewton(ckt, x, { ...base, maxIter: 25, extra });
      total += r.iterations;
      if (!r.ok) { h /= 4; if (h < 1e-13) break; continue; }
      let moved = 0;
      for (let i = 0; i < ckt.dim; i++) moved = Math.max(moved, Math.abs(r.x[i] - xo[i]) / (1e-6 + 1e-4 * Math.abs(r.x[i])));
      x = r.x; h = Math.min(h * 2, 1e9);
      if (moved < 10 || s - lastTry >= 20) {
        lastTry = s;
        const f = solveNewton(ckt, x, { ...base, maxIter: 50 });
        total += f.iterations;
        if (f.ok) return done('pseudo', f.x, total);
        note(f.x, f.residual);
      }
    }
  }
  return noConverge(ckt, ws, best, base, total, tried, plainSingular ? { col: singularCol, it: singularIter } : null);
}

/** Final failure: keep the best state, name the node with the largest residual, point at the explainer. */
function noConverge(ckt: Circuit, ws: Workspace, best: { x: Float64Array; res: number } | null, base: { gmin: number; lambda: number }, total: number, tried: OpStrategy[], sing: { col: number; it: number } | null): OpResult {
  if (!best && sing) {
    // every stage hit a singular matrix: that is a structural problem, explain it as such (re-stamp at the seed to name the culprits)
    const c0 = ws.ctx; c0.x.set(seedGuess(ckt)); assemble(ckt, c0, { gmin: base.gmin, lambda: base.lambda });
    const f = ws.solver.factor(c0.A);
    return fail(ckt, explainSingular(ckt, c0.A, f.ok ? sing.col : f.badColumn), sing.it);
  }
  const x = best ? best.x : new Float64Array(ckt.dim), nn = ckt.n + ckt.nInternal, c = ws.ctx;
  c.x.set(x); assemble(ckt, c, { gmin: base.gmin, lambda: base.lambda });
  const r = new Float64Array(ckt.dim); nodeResidual(c, x, nn, r);
  let w = 0; for (let i = 1; i < nn; i++) if (Math.abs(r[i]) > Math.abs(r[w])) w = i;
  const nodes: string[] = [], elements: string[] = [];
  let label = '-';
  if (nn > 0) {
    label = ckt.unknownNames[w].slice(2, -1);
    nodes.push(w < ckt.n ? ckt.netlist.nodeNames[w + 1] : label);
    for (const e of ckt.elements) if (e.nodes.includes(w) || e.internal.includes(w)) elements.push(e.el.id);
  }
  return { ok: false, x, iterations: total, strategy: 'pseudo', issues: ckt.issues, tried,
    failure: { code: 'noConverge', key: 'solve.noConverge', vars: { node: label, elements: elements.join(', ') || '-' }, nodes, elements }, totalIterations: total };
}

export { nodeVoltage };
