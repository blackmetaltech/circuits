// DC operating point (DESIGN §3.3, §3.4, §3.10). Never throws to the caller: failures are a result object with an i18n key.
//   linear circuit → one assemble + factor + solve.
//   nonlinear      → plain damped-free Newton loop (limit hooks, reltol 1e-4 / vntol 1e-6 / abstol 1e-12). The homotopy chain
//                    (gmin stepping, source stepping via opts.lambda, pseudo-transient) slots in at `solveNewton`'s caller.
//   topology       → blocking issues (ideal-source loop, shorted ideal source, current cutset) are returned WITHOUT solving.
//   singular       → core `singularityReport` names the nodes / elements; result.failure carries key 'solve.singular'.
import { singularityReport } from '@core/numerics';
import type { Circuit, TopoIssue } from './types';
import { assemble, nodeVoltage, StampCtx } from './stamp';
import { makeSolver, type LinearSolver } from './solver';

export interface Workspace { ctx: StampCtx; solver: LinearSolver; xNew: Float64Array }
export const makeWorkspace = (ckt: Circuit, state: number[] = new Array(ckt.stateSize).fill(0)): Workspace =>
  ({ ctx: new StampCtx(ckt.dim, state), solver: makeSolver(ckt.dim), xNew: new Float64Array(ckt.dim) });

export interface OpOptions {
  gmin?: number;               // node-to-ground shunt, S (default 1e-12)
  lambda?: number;             // source scale (source stepping), default 1
  x0?: Float64Array;           // initial guess
  maxIter?: number;            // Newton, default 150
  reltol?: number; vntol?: number; abstol?: number;
  ws?: Workspace;              // reuse buffers
  state?: number[];            // device history
}
export interface Failure { code: 'topology' | 'singular' | 'noConverge'; key: string; vars: Record<string, string | number>; nodes: string[]; elements: string[] }
export interface OpResult {
  ok: boolean;
  x: Float64Array;
  iterations: number;
  strategy: 'linear' | 'newton';
  /** Topology findings (all severities) for this circuit. */
  issues: TopoIssue[];
  failure: Failure | null;
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

export function solveOp(ckt: Circuit, o: OpOptions = {}): OpResult {
  const blocking = ckt.issues.filter((i) => i.severity === 'block');
  if (blocking.length) {
    const b = blocking[0];
    return fail(ckt, { code: 'topology', key: b.key, vars: b.vars, nodes: b.nodes, elements: b.elements });
  }
  if (ckt.dim === 0) return { ok: true, x: new Float64Array(0), iterations: 0, strategy: 'linear', issues: ckt.issues, failure: null };
  const gmin = o.gmin ?? 1e-12;
  const ws = o.ws ?? makeWorkspace(ckt, o.state);
  const c = ws.ctx;
  if (o.state) c.state = o.state;
  const x = new Float64Array(ckt.dim);
  if (o.x0) x.set(o.x0);
  c.x.set(x);
  const asm = { gmin, lambda: o.lambda ?? 1 };

  if (ckt.linear) {
    assemble(ckt, c, asm);
    const f = ws.solver.factor(c.A);
    if (!f.ok) return fail(ckt, explainSingular(ckt, c.A, f.badColumn), 1);
    ws.solver.solve(c.b, x);
    return { ok: true, x, iterations: 1, strategy: 'linear', issues: ckt.issues, failure: null };
  }

  const reltol = o.reltol ?? 1e-4, vntol = o.vntol ?? 1e-6, abstol = o.abstol ?? 1e-12, maxIter = o.maxIter ?? 150;
  const xNew = ws.xNew;
  for (let it = 1; it <= maxIter; it++) {
    c.x.set(x);
    assemble(ckt, c, asm);
    const f = ws.solver.factor(c.A);
    if (!f.ok) return fail(ckt, explainSingular(ckt, c.A, f.badColumn), it);
    ws.solver.solve(c.b, xNew);
    for (const e of ckt.elements) e.dev.limit?.(e, xNew, x);
    let conv = true;
    for (let i = 0; i < ckt.dim; i++) {
      if (!Number.isFinite(xNew[i])) return fail(ckt, { code: 'noConverge', key: 'solve.noConverge', vars: {}, nodes: [], elements: [] }, it);
      const tol = reltol * Math.max(Math.abs(xNew[i]), Math.abs(x[i])) + (i < ckt.n + ckt.nInternal ? vntol : abstol);
      if (Math.abs(xNew[i] - x[i]) > tol) conv = false;
    }
    x.set(xNew);
    if (conv && it > 1) return { ok: true, x, iterations: it, strategy: 'newton', issues: ckt.issues, failure: null };
  }
  return fail(ckt, { code: 'noConverge', key: 'solve.noConverge', vars: {}, nodes: [], elements: [] }, maxIter);
}

export { nodeVoltage };
