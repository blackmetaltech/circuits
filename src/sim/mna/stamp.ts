// Stamping context and result accessors (see types.ts for the conventions). Matrices are row-major Float64Array dim×dim.
import type { Circuit, CElem } from './types';

export class StampCtx {
  readonly dim: number;
  A: Float64Array;
  b: Float64Array;
  /** Current Newton iterate (read by nonlinear devices). */
  x: Float64Array;
  /** Per-element history (plain numbers; stored in the game state). */
  state: number[];
  /** Source scale for source stepping (independent sources multiply their value by it). */
  lambda = 1;
  /** Junction shunt conductance for devices (the node-to-ground gmin is added by `assemble`). */
  gmin = 1e-12;
  /** Simulation time, s (time-varying sources, later). */
  time = 0;
  constructor(dim: number, state: number[] = []) {
    this.dim = dim; this.A = new Float64Array(dim * dim); this.b = new Float64Array(dim); this.x = new Float64Array(dim); this.state = state;
  }
  clear(): void { this.A.fill(0); this.b.fill(0); }
  /** A[i][j] += v (ignored when either index is ground, −1). */
  m(i: number, j: number, v: number): void { if (i >= 0 && j >= 0) this.A[i * this.dim + j] += v; }
  /** b[i] += v. */
  r(i: number, v: number): void { if (i >= 0) this.b[i] += v; }
  /** Conductance g between a and b. */
  g(a: number, b: number, g: number): void { this.m(a, a, g); this.m(b, b, g); this.m(a, b, -g); this.m(b, a, -g); }
  /** Independent current I flowing a→b THROUGH the element (leaves node a, enters node b). */
  i(a: number, b: number, I: number): void { this.r(a, -I); this.r(b, I); }
  /** Voltage of an index (0 for ground). */
  v(i: number): number { return i < 0 ? 0 : this.x[i]; }
}

/** Complex system for AC analysis (§3.6): separate real / imaginary planes. */
export class AcCtx {
  readonly dim: number;
  Re: Float64Array; Im: Float64Array; bRe: Float64Array; bIm: Float64Array;
  /** DC operating point the devices linearise at. */
  x: Float64Array;
  constructor(dim: number) { this.dim = dim; this.Re = new Float64Array(dim * dim); this.Im = new Float64Array(dim * dim); this.bRe = new Float64Array(dim); this.bIm = new Float64Array(dim); this.x = new Float64Array(dim); }
  /** A[i][j] += re + j·im. */
  m(i: number, j: number, re: number, im = 0): void { if (i >= 0 && j >= 0) { this.Re[i * this.dim + j] += re; this.Im[i * this.dim + j] += im; } }
  r(i: number, re: number, im = 0): void { if (i >= 0) { this.bRe[i] += re; this.bIm[i] += im; } }
  y(a: number, b: number, re: number, im = 0): void { this.m(a, a, re, im); this.m(b, b, re, im); this.m(a, b, -re, -im); this.m(b, a, -re, -im); }
}

export interface AssembleOpts { gmin: number; lambda?: number; time?: number; mode?: 'dc' | 'tran'; method?: 'BE' | 'TRAP'; h?: number }

/** Clear and stamp every element at c.x, then add gmin from every node (external and internal) to ground. */
export function assemble(ckt: Circuit, c: StampCtx, o: AssembleOpts): void {
  c.clear(); c.lambda = o.lambda ?? 1; c.time = o.time ?? 0; c.gmin = o.gmin;
  for (const e of ckt.elements) {
    if (o.mode === 'tran' && e.dev.stampTran) e.dev.stampTran(e, c, o.method ?? 'BE', o.h ?? 0);
    else e.dev.stampDC(e, c);
  }
  const nn = ckt.n + ckt.nInternal;
  for (let i = 0; i < nn; i++) c.A[i * c.dim + i] += o.gmin;
}

/** Voltage of node id (netlist id) at x. */
export const nodeVoltage = (x: ArrayLike<number>, id: number): number => (id <= 0 ? 0 : x[id - 1]);

/** Terminal voltages of an element. */
export function terminalVoltages(e: CElem, x: ArrayLike<number>): number[] { return e.nodes.map((i) => (i < 0 ? 0 : x[i])); }

/** Current INTO the element at each terminal (passive sign). */
export function terminalCurrents(e: CElem, x: Float64Array, state: number[] = []): number[] { return e.dev.terminalCurrents(e, x, state); }

/** Element current a→b through a two-terminal element (first terminal's inflow). Throws on an unknown element id. */
export function elementCurrent(ckt: Circuit, x: Float64Array, id: string, state: number[] = []): number {
  const k = ckt.elementIndex[id]; if (k === undefined) throw new Error(`unknown element ${id}`);
  return terminalCurrents(ckt.elements[k], x, state)[0];
}
/** Absorbed power p = Σ v_k·i_k (W, > 0 dissipated; sources delivering give p < 0). */
export function elementPower(ckt: Circuit, x: Float64Array, id: string, state: number[] = []): number {
  const k = ckt.elementIndex[id]; if (k === undefined) throw new Error(`unknown element ${id}`);
  const e = ckt.elements[k], v = terminalVoltages(e, x), i = terminalCurrents(e, x, state);
  let p = 0; for (let t = 0; t < v.length; t++) p += v[t] * i[t];
  return p;
}
