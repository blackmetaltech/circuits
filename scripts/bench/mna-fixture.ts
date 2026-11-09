// Benchmark fixture only (NOT the game's solver): a minimal MNA stamper + DC Newton + fixed-step TRAP engine, built on the flat LU.
// Node index -1 is ground. Unknown vector = [node voltages..., branch currents...].
import { luWork, luFactor, luSolve, type LuWork } from '../../src/sim/mna/lu.ts';
import { exp, log, sin } from '../../core/ts/numerics/dmath.ts';

const E80 = exp(80);
/** e^x with the exponential guard: linear continuation above 80. */
export function gexp(x: number): number { return x > 80 ? E80 * (1 + (x - 80)) : exp(x); }

export interface Diode { a: number; k: number; is: number; nvt: number; vcrit: number; vd: number }
export interface Res { a: number; b: number; g: number }
export interface Cap { a: number; b: number; c: number; v: number; i: number }
export interface Ind { a: number; b: number; l: number; br: number; v: number; j: number }
export interface Vsrc { p: number; n: number; br: number; f: (t: number) => number }

export interface Ckt {
  nodes: number; n: number; nbr: number;
  res: Res[]; caps: Cap[]; inds: Ind[]; vs: Vsrc[]; diodes: Diode[];
}

export const VT = 0.02585;
const JGMIN = 1e-9;
export function newCkt(nodes: number): Ckt { return { nodes, n: nodes, nbr: 0, res: [], caps: [], inds: [], vs: [], diodes: [] }; }
export const addRes = (c: Ckt, a: number, b: number, r: number): void => { c.res.push({ a, b, g: 1 / r }); };
export const addCap = (c: Ckt, a: number, b: number, cap: number): void => { c.caps.push({ a, b, c: cap, v: 0, i: 0 }); };
export function addInd(c: Ckt, a: number, b: number, l: number): void { c.inds.push({ a, b, l, br: c.nodes + c.nbr++, v: 0, j: 0 }); c.n++; }
export function addVsrc(c: Ckt, p: number, n: number, f: (t: number) => number): void { c.vs.push({ p, n, br: c.nodes + c.nbr++, f }); c.n++; }
export function addDiode(c: Ckt, a: number, k: number, is: number, nn: number): void {
  const nvt = nn * VT;
  c.diodes.push({ a, k, is, nvt, vcrit: nvt * log(nvt / (1.4142135623730951 * is)), vd: 0 });
}
export const sineSrc = (amp: number, hz: number) => (t: number): number => amp * sin(6.283185307179586 * hz * t);

function g(A: Float64Array, n: number, a: number, b: number, v: number): void {
  if (a >= 0) A[a * n + a] += v;
  if (b >= 0) A[b * n + b] += v;
  if (a >= 0 && b >= 0) { A[a * n + b] -= v; A[b * n + a] -= v; }
}
function cur(z: Float64Array, a: number, b: number, i: number): void { if (a >= 0) z[a] += i; if (b >= 0) z[b] -= i; } // i flows into a, out of b
function pnjlim(vnew: number, vold: number, nvt: number, vcrit: number): number {
  if (vnew > vcrit && Math.abs(vnew - vold) > 2 * nvt) {
    if (vold > 0) {
      const arg = (vnew - vold) / nvt;
      return arg > 0 ? vold + nvt * (2 + log(arg - 2 > 1e-3 ? arg - 2 : 1e-3)) : vold - nvt * (2 + log(2 - arg));
    }
    return nvt * log(vnew / nvt);
  }
  return vnew;
}

export interface Engine {
  c: Ckt; n: number; w: LuWork;
  Alin: Float64Array; A: Float64Array; z: Float64Array; zb: Float64Array; x: Float64Array; xo: Float64Array;
  dt: number; t: number; factored: boolean; gmin: number;
}

export function makeEngine(c: Ckt, dt: number): Engine {
  const n = c.n;
  const e: Engine = { c, n, w: luWork(n), Alin: new Float64Array(n * n), A: new Float64Array(n * n), z: new Float64Array(n), zb: new Float64Array(n),
    x: new Float64Array(n), xo: new Float64Array(n), dt, t: 0, factored: false, gmin: 1e-12 };
  stampLinear(e, dt > 0);
  return e;
}

/** Linear (time-invariant) part of the matrix. transient=false: caps open, inductors shorted (DC). */
function stampLinear(e: Engine, transient: boolean): void {
  const { c, n, Alin: A } = e; A.fill(0);
  for (const r of c.res) g(A, n, r.a, r.b, r.g);
  for (let i = 0; i < c.nodes; i++) A[i * n + i] += e.gmin;
  if (transient) for (const k of c.caps) g(A, n, k.a, k.b, 2 * k.c / e.dt);
  for (const l of c.inds) {
    const r = transient ? 2 * l.l / e.dt : 0;
    if (l.a >= 0) { A[l.a * n + l.br] += 1; A[l.br * n + l.a] += 1; }
    if (l.b >= 0) { A[l.b * n + l.br] -= 1; A[l.br * n + l.b] -= 1; }
    A[l.br * n + l.br] -= r;
  }
  for (const v of c.vs) {
    if (v.p >= 0) { A[v.p * n + v.br] += 1; A[v.br * n + v.p] += 1; }
    if (v.n >= 0) { A[v.n * n + v.br] -= 1; A[v.br * n + v.n] -= 1; }
  }
}

function rhsStatic(e: Engine, t: number, transient: boolean): void {
  const { c, z } = e; z.fill(0);
  for (const k of c.caps) if (transient) { const ge = 2 * k.c / e.dt; cur(z, k.a, k.b, ge * k.v + k.i); }
  for (const l of c.inds) if (transient) z[l.br] -= 2 * l.l / e.dt * l.j + l.v;
  for (const v of c.vs) z[v.br] += v.f(t);
}

/** Solve the (possibly nonlinear) system at time t. Returns Newton iterations used, or -1 if not converged. */
function solveAt(e: Engine, t: number, transient: boolean): number {
  const { c, n, A, Alin, z, x, w } = e;
  rhsStatic(e, t, transient);
  if (c.diodes.length === 0) {
    if (!e.factored) { luFactor(w, Alin); e.factored = true; } // linear, fixed step: factor once
    luSolve(w, z, x); return 1;
  }
  const zb = e.zb;
  zb.set(z);
  for (let it = 1; it <= 100; it++) {
    A.set(Alin);
    z.set(zb);
    let limited = false;
    for (const d of c.diodes) {
      const va = d.a >= 0 ? x[d.a]! : 0, vk = d.k >= 0 ? x[d.k]! : 0;
      const raw = va - vk;
      const vd = pnjlim(raw, d.vd, d.nvt, d.vcrit);
      if (vd !== raw) limited = true;
      d.vd = vd;
      const ex = gexp(vd / d.nvt);
      const gd = d.is / d.nvt * ex + JGMIN; // junction shunt keeps floating bridge nodes well-conditioned (cf. SPICE gmin)
      const id = d.is * (ex - 1) + JGMIN * vd;
      g(A, n, d.a, d.k, gd);
      cur(z, d.a, d.k, -(id - gd * vd));
    }
    if (!luFactor(w, A).ok) return -1;
    // x_new -> xo diff check
    e.xo.set(x);
    luSolve(w, z, x);
    let ok = !limited;
    for (let i = 0; i < n && ok; i++) {
      const d = Math.abs(x[i]! - e.xo[i]!);
      if (d > (i < c.nodes ? 1e-6 : 1e-9) + 1e-3 * Math.abs(x[i]!)) ok = false; // SPICE-style vntol/abstol + reltol
    }
    if (ok) return it;
  }
  return -1;
}

/** DC operating point (caps open, inductors shorted). */
export function dcSolve(e: Engine): number {
  stampLinear(e, false);
  for (const d of e.c.diodes) d.vd = 0;
  e.x.fill(0);
  const it = solveAt(e, 0, false);
  stampLinear(e, e.dt > 0); e.factored = false;
  return it;
}

/** One TRAP step: t -> t+dt. Returns Newton iterations (or -1). */
export function trapStep(e: Engine): number {
  const { c, x } = e;
  const t1 = e.t + e.dt;
  const it = solveAt(e, t1, true);
  for (const k of c.caps) {
    const va = k.a >= 0 ? x[k.a]! : 0, vb = k.b >= 0 ? x[k.b]! : 0, vn = va - vb;
    k.i = 2 * k.c / e.dt * (vn - k.v) - k.i; k.v = vn;
  }
  for (const l of c.inds) {
    const va = l.a >= 0 ? x[l.a]! : 0, vb = l.b >= 0 ? x[l.b]! : 0;
    l.v = va - vb; l.j = x[l.br]!;
  }
  e.t = t1;
  return it;
}

// ---------------------------------------------------------------- fixtures

/** 3 diodes in series from a 5 V source through 1 k, with a 10 k shunt. n = 4. */
export function diode3(): Engine {
  const c = newCkt(4); // 0 src, 1 a, 2 b, 3 c
  addVsrc(c, 0, -1, () => 5);
  addRes(c, 0, 1, 1e3); addRes(c, 1, -1, 1e4);
  addDiode(c, 1, 2, 1e-14, 1); addDiode(c, 2, 3, 1e-14, 1); addDiode(c, 3, -1, 1e-14, 1);
  return makeEngine(c, 0);
}

/** RC ladder, MNA dimension n = stages + 2 (nodes: source + stages; one vsrc branch) => stages = 22 gives n = 24. */
export function rcLadder(n = 24, dt = 1e-6): Engine {
  const stages = n - 2;
  const c = newCkt(stages + 1);
  addVsrc(c, 0, -1, (t) => (t >= 0 ? 1 : 0));
  for (let i = 0; i < stages; i++) { addRes(c, i, i + 1, 1e3); addCap(c, i + 1, -1, 1e-9); }
  return makeEngine(c, dt);
}

export interface Bridge { e: Engine; outp: number; a: number; b: number; vOut: Float64Array; vIn: Float64Array }

/**
 * Full-wave bridge: 17 V pk 50 Hz source -> 1.5 ohm -> 10 uH line inductance -> 4x 1N4007-like (Is 76.9e-12, N 1.45, Rs 0.042)
 * -> 1000 uF (ESR 0.05) || 120 ohm. Nodes: 0 src+, 1 after R, 2 a, 3 b, 4 outp, 5 cap-ESR node, 6..9 diode internals; gnd = out-.
 * Branches: source, inductor. n = 12.
 */
export function bridge(dt = 20e-3 / 200): Bridge {
  const c = newCkt(10);
  const [S, R1, A, B, OP, CE] = [0, 1, 2, 3, 4, 5];
  addVsrc(c, S, B, sineSrc(17, 50));
  addRes(c, S, R1, 1.5); addInd(c, R1, A, 10e-6);
  const dio = (an: number, ka: number, internal: number): void => {
    addDiode(c, an, internal, 76.9e-12, 1.45); addRes(c, internal, ka, 0.042);
  };
  dio(A, OP, 6); dio(B, OP, 7); dio(-1, A, 8); dio(-1, B, 9);
  addRes(c, OP, CE, 0.05); addCap(c, CE, -1, 1e-3);
  addRes(c, OP, -1, 120);
  const e = makeEngine(c, dt);
  return { e, outp: OP, a: A, b: B, vOut: new Float64Array(512), vIn: new Float64Array(512) };
}

export interface FrameResult { vOut: Float64Array; vIn: Float64Array; iters: number; t: number }
/** Advance the bridge by k steps and return a 512-point decimated window (point i = step floor(i*k/512)) of V(out) and V(a)-V(b). */
export function liveFrame(s: Bridge, k: number): FrameResult {
  const { e } = s; let next = 0, iters = 0;
  for (let st = 0; st < k; st++) {
    iters += trapStep(e);
    while (next < 512 && Math.floor(next * k / 512) <= st) {
      s.vOut[next] = e.x[s.outp]!; s.vIn[next] = e.x[s.a]! - e.x[s.b]!; next++;
    }
  }
  return { vOut: s.vOut, vIn: s.vIn, iters, t: e.t };
}
