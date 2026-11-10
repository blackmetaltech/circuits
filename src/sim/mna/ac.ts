// AC small-signal analysis (DESIGN §3.6). Solve the DC OP once, then for each frequency assemble the complex system
// Y(jω)·x = b from every device's `stampAC` (linearised at the OP) and solve it with core complex LU (`cLuDecompose` / `cLuSolve`).
// The unknown vector is the same as DC/transient (types.ts): node voltages, internal nodes, branch currents.
// Excitation: every independent source's `p.ac` (V: volts, I: amps, phase 0). A ticket normally has one AC source of magnitude 1,
// so H = V(out)/V(in) is also V(out) when the input is 1 V; `transfer` divides explicitly so any magnitude works.
// Devices without `stampAC` fall back to their DC conductance part (real) — all current devices define stampAC.
// Not covered yet (no such devices exist): the "clipped at DC" op-amp / saturated-BJT warning of §3.6.
import { cLuDecompose, cLuSolve, cx, abs, arg, dmath, SingularMatrixError, type Complex } from '@core/numerics';
import { solveOp, type Failure, type OpOptions } from './op';
import { AcCtx, StampCtx } from './stamp';
import type { Circuit } from './types';

export interface AcSolution {
  f: number;
  omega: number;
  /** Full complex unknown vector (same layout as the DC x). */
  x: Complex[];
  /** Node voltage phasor ('0' / 'gnd' = 0). */
  v(node: string): Complex;
  /** V(a) − V(b). */
  vd(a: string, b: string): Complex;
  /** Current phasor a→b through an element (branch devices; R and C also). Throws for other kinds. */
  i(elementId: string): Complex;
  /** V(out)/V(in). */
  transfer(out: string, inp: string): Complex;
}

export interface AcAnalysis {
  ok: boolean;
  failure: Failure | null;
  /** The DC operating point everything is linearised at. */
  op: Float64Array;
  /** Complex solution at f hertz. Throws if the matrix is singular at that frequency (use `trySolve` to get null). */
  solve(f: number): AcSolution;
  trySolve(f: number): AcSolution | null;
}

export interface AcOptions { op?: Float64Array; opOptions?: OpOptions; gmin?: number }

const csub = (a: Complex, b: Complex): Complex => cx(a.re - b.re, a.im - b.im);
const cdiv = (a: Complex, b: Complex): Complex => { const d = b.re * b.re + b.im * b.im; return cx((a.re * b.re + a.im * b.im) / d, (a.im * b.re - a.re * b.im) / d); };

export function makeAc(ckt: Circuit, o: AcOptions = {}): AcAnalysis {
  let op = o.op;
  // A linear circuit's small-signal response does not depend on the OP (stampAC never reads x), so DC problems such as an ideal
  // source straight across an inductor do not block AC; only nonlinear circuits need the solved OP.
  if (!op && ckt.linear) op = new Float64Array(ckt.dim);
  if (!op) {
    const r = solveOp(ckt, o.opOptions);
    if (!r.ok) return { ok: false, failure: r.failure, op: r.x, solve: () => { throw new Error('AC: no operating point'); }, trySolve: () => null };
    op = r.x;
  }
  const x0 = op, gmin = o.gmin ?? 1e-12, dim = ckt.dim, nn = ckt.n + ckt.nInternal;
  const ctx = new AcCtx(dim); ctx.x = x0;
  const fb = new StampCtx(dim, new Array(ckt.stateSize).fill(0)); fb.x = x0;
  const nodeId = (name: string): number => {
    const k = name.toLowerCase();
    if (k === '0' || k === 'gnd') return 0;
    const id = ckt.nodeIndex[k]; if (id === undefined) throw new Error(`AC: no node ${name}`);
    return id;
  };

  const trySolve = (f: number): AcSolution | null => {
    const omega = 2 * Math.PI * f;
    ctx.Re.fill(0); ctx.Im.fill(0); ctx.bRe.fill(0); ctx.bIm.fill(0);
    for (const e of ckt.elements) {
      if (e.dev.stampAC) e.dev.stampAC(e, ctx, omega);
      else { fb.clear(); e.dev.stampDC(e, fb); for (let k = 0; k < ctx.Re.length; k++) ctx.Re[k] += fb.A[k]; }
    }
    for (let i = 0; i < nn; i++) ctx.Re[i * dim + i] += gmin;
    const A: Complex[][] = [];
    for (let i = 0; i < dim; i++) { const row: Complex[] = []; for (let j = 0; j < dim; j++) row.push(cx(ctx.Re[i * dim + j], ctx.Im[i * dim + j])); A.push(row); }
    const b: Complex[] = []; for (let i = 0; i < dim; i++) b.push(cx(ctx.bRe[i], ctx.bIm[i]));
    let x: Complex[];
    try { x = cLuSolve(cLuDecompose(A), b); } catch (err) { if (err instanceof SingularMatrixError) return null; throw err; }
    const vOf = (id: number): Complex => (id <= 0 ? cx(0) : x[id - 1]);
    const sol: AcSolution = {
      f, omega, x,
      v: (n) => vOf(nodeId(n)),
      vd: (a, b2) => csub(vOf(nodeId(a)), vOf(nodeId(b2))),
      i(id) {
        const k = ckt.elementIndex[id]; if (k === undefined) throw new Error(`AC: unknown element ${id}`);
        const e = ckt.elements[k];
        if (e.branch.length > 0) return x[e.branch[0]];
        const va = e.nodes[0] < 0 ? cx(0) : x[e.nodes[0]], vb = e.nodes[1] < 0 ? cx(0) : x[e.nodes[1]], dv = csub(va, vb);
        if (e.el.kind === 'R') return cx(dv.re / e.el.p.r, dv.im / e.el.p.r);
        if (e.el.kind === 'C') return cx(-omega * e.el.p.c * dv.im, omega * e.el.p.c * dv.re);
        throw new Error(`AC: current of ${e.el.kind} element ${id} is not available`);
      },
      transfer: (out, inp) => cdiv(vOf(nodeId(out)), vOf(nodeId(inp))),
    };
    return sol;
  };
  return {
    ok: true, failure: null, op: x0, trySolve,
    solve(f) { const s = trySolve(f); if (!s) throw new Error(`AC: singular system at ${f} Hz`); return s; },
  };
}

// ------------------------------------------------------------------------------------------------ sweep (Bode instrument support)

/** Log-spaced frequencies fStart…fStop (both included), `perDecade` points per decade (the count rounds up, endpoints exact). */
export function logFreqs(fStart: number, fStop: number, perDecade = 20): number[] {
  const decades = dmath.log10(fStop / fStart), n = Math.max(1, Math.ceil(decades * perDecade - 1e-9));
  const out: number[] = [];
  for (let k = 0; k < n; k++) out.push(fStart * dmath.pow(10, (k * decades) / n));
  out.push(fStop);
  return out;
}

export interface BodeData {
  f: number[];
  /** 20·log10 |H|, dB. */
  magDb: number[];
  /** Unwrapped phase, degrees (starts in (−180, 180]). */
  phaseDeg: number[];
  h: Complex[];
}

/** H(f) = V(out)/V(in) over `freqs`. Singular points are skipped (NaN-free output). */
export function bode(ac: AcAnalysis, out: string, inp: string, freqs: number[]): BodeData {
  const r: BodeData = { f: [], magDb: [], phaseDeg: [], h: [] };
  let prev = 0;
  for (const f of freqs) {
    const s = ac.trySolve(f); if (!s) continue;
    const h = s.transfer(out, inp), m = abs(h);
    let ph = (arg(h) * 180) / Math.PI;
    if (r.f.length) ph -= 360 * dmath.round((ph - prev) / 360);
    prev = ph;
    r.f.push(f); r.h.push(h); r.magDb.push(m > 0 ? 20 * dmath.log10(m) : -Infinity); r.phaseDeg.push(ph);
  }
  return r;
}

/** Maximise a unimodal fn on [lo, hi] by golden-section search (the §3.6 peak refinement; default relative width 1e-9 on x). */
export function findPeak(fn: (x: number) => number, lo: number, hi: number, relTol = 1e-9): { x: number; y: number } {
  const g = (Math.sqrt(5) - 1) / 2;
  let a = lo, b = hi, c = b - g * (b - a), d = a + g * (b - a), fc = fn(c), fd = fn(d);
  for (let k = 0; k < 200 && b - a > relTol * Math.abs(b); k++) {
    if (fc > fd) { b = d; d = c; fd = fc; c = b - g * (b - a); fc = fn(c); } else { a = c; c = d; fc = fd; d = a + g * (b - a); fd = fn(d); }
  }
  const x = 0.5 * (a + b); return { x, y: fn(x) };
}
