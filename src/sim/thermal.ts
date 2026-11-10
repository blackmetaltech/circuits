// Power and lumped thermal model (DESIGN §3.8-§3.9). Pure functions only: no wall clock, no module state, no transcendentals.
//
// Per part: C_th dT/dt = P - (T - Ta)/theta, tau = theta*C_th. The bench never waits: steady state T = Ta + P*theta. Live/time-stepped
// use advances T by a FIXED step per call (`stepThermal`), driven by a power trace, so a replay of the same trace is bit-identical.
// The step is backward Euler, T' = T + (Tss - T)*dt/(tau + dt): unconditionally stable and monotone for any dt (no exp needed).
//
// Signals: the rating/smoke checks read a measured `Window` of named probe series (the names runTran/runBench record):
//   p(el) absorbed power, i(el) current into terminal 0, v(a,b) = V(a) - V(b), with a/b = terminals 0/1 of a two-terminal part,
//   and for 3-terminal transistors v(n0,n2) (Vce / Vds) and v(n1,n2) (Vbe / Vgs). `partProbes` names them.
import type { PartKind, Thermal } from '../data/parts/types';
import type { Element, Netlist, Circuit } from './mna/types';
import { elementPower } from './mna/stamp';

/** What the sim modules need from a compiled circuit (a plain netlist is enough for tests). */
export interface NetLike { netlist: Netlist }

export interface RatedPart {
  /** Placed-part uid: matches Element.owner (or Element.id when the owner is empty). */
  id: string;
  kind: PartKind;
  /** The catalogue variant's ratings (P, Vrated, VRRM, IFAV, Vceo...). */
  ratings: Record<string, number>;
  thermal: Thermal;
  /** Heatsink (heatsinkable parts only): replaces thetaJA by thetaJC + thetaCS + thetaSA. */
  heatsink?: { thetaCS: number; thetaSA: number };
}

export interface Window { t: number[]; series: Record<string, number[]>; t0?: number; t1?: number }

export type ThermalState = 'normal' | 'warm' | 'hot' | 'smoke';

export const THREE_TERMINAL_KINDS: readonly PartKind[] = ['NPN', 'PNP', 'DARLINGTON', 'NMOS'];
export const SEMI_KINDS: readonly PartKind[] = ['D', 'LED', 'Z', 'SCHOTTKY', 'NPN', 'PNP', 'DARLINGTON', 'NMOS', 'OPAMP', 'CMP', '555', 'REG'];

// ---------------------------------------------------------------- thermal RC
/** Total junction-to-ambient resistance, C/W. */
export function thetaTotal(th: Thermal, sink?: { thetaCS: number; thetaSA: number }): number {
  if (sink && th.heatsinkable && th.thetaJC !== undefined) return th.thetaJC + sink.thetaCS + sink.thetaSA;
  return th.thetaJA;
}
/** Steady state temperature, C. */
export const steadyT = (ta: number, p: number, theta: number): number => ta + p * theta;

/** One backward-Euler step of the first-order RC. */
export function stepThermal(T: number, p: number, dt: number, th: Thermal, ta: number, theta: number = th.thetaJA): number {
  const tss = steadyT(ta, p, theta);
  return T + ((tss - T) * dt) / (th.tauS + dt);
}

/** Integrate a power trace [{dt, P}]; returns T after every step. */
export function integrateThermal(trace: readonly { dt: number; P: number }[], th: Thermal, ta: number, T0: number = ta, theta: number = th.thetaJA): { T: number[] } {
  const T: number[] = []; let x = T0;
  for (const s of trace) { x = stepThermal(x, s.P, s.dt, th, ta, theta); T.push(x); }
  return { T };
}

/** The power rating of a part (W) where it has one. */
export const ratedPower = (part: RatedPart): number | undefined => part.ratings.P ?? part.ratings.Pd ?? part.ratings.PD ?? part.ratings.Ptot;

/** Normal -> Warm (P over rating or T > 0.9 Tmax) -> Hot (T > Tmax) -> Smoke (T > Tfail). */
export function thermalState(part: RatedPart, p: number, T: number): ThermalState {
  const th = part.thermal;
  if (T > th.tFail) return 'smoke';
  if (T > th.tMax) return 'hot';
  const pr = ratedPower(part);
  if ((pr !== undefined && p > pr) || T > 0.9 * th.tMax) return 'warm';
  return 'normal';
}

// ---------------------------------------------------------------- power from a solution
/** Absorbed power per owner (element id when the owner is empty) at solution x. Sources delivering give p < 0. */
export function elementPowers(ckt: Circuit, x: Float64Array, state: number[] = []): Record<string, number> {
  const out: Record<string, number> = {};
  for (const e of ckt.elements) { const key = e.el.owner || e.el.id; out[key] = (out[key] ?? 0) + elementPower(ckt, x, e.el.id, state); }
  return out;
}

// ---------------------------------------------------------------- signals of a part
export const ownerOf = (e: Element): string => e.owner || e.id;
export const partElements = (ckt: NetLike, part: RatedPart): Element[] => ckt.netlist.elements.filter((e) => ownerOf(e) === part.id);
const nn = (ckt: NetLike, id: number): string => ckt.netlist.nodeNames[id] ?? String(id);

export interface PartSignals {
  /** Power probes, one per element of the part. */
  p: string[];
  /** Terminal 0 current probe ('' if the part has no element). */
  i: string;
  /** V(n0) - V(n1) (two-terminal) or V(n0) - V(n2) (transistor: Vce / Vds). */
  v: string;
  /** Transistors only: V(n1) - V(n2) (Vbe / Vgs). */
  vc: string;
}
export function partSignals(ckt: NetLike, part: RatedPart): PartSignals {
  const els = partElements(ckt, part), e = els[0];
  const s: PartSignals = { p: els.map((x) => `p(${x.id})`), i: '', v: '', vc: '' };
  if (!e) return s;
  s.i = `i(${e.id})`;
  const n = e.nodes;
  if (THREE_TERMINAL_KINDS.includes(part.kind) && n.length >= 3) { s.v = `v(${nn(ckt, n[0])},${nn(ckt, n[2])})`; s.vc = `v(${nn(ckt, n[1])},${nn(ckt, n[2])})`; }
  else if (n.length >= 2) s.v = `v(${nn(ckt, n[0])},${nn(ckt, n[1])})`;
  return s;
}
/** Every probe a ratings check needs, in a stable order, without duplicates. */
export function ratingProbes(ckt: NetLike, parts: readonly RatedPart[]): string[] {
  const out: string[] = [];
  for (const part of parts) { const s = partSignals(ckt, part); for (const n of [...s.p, s.v, s.vc, s.i]) if (n && !out.includes(n)) out.push(n); }
  return out;
}

// ---------------------------------------------------------------- window statistics
export interface Sig { t: number[]; y: number[] }
/** The samples of a series inside [t0, t1] (default: all). Missing series -> undefined. */
export function sig(w: Window, name: string): Sig | undefined {
  const y = w.series[name]; if (!y || name === '') return undefined;
  const t0 = w.t0 ?? -Infinity, t1 = w.t1 ?? Infinity, t: number[] = [], v: number[] = [];
  for (let k = 0; k < w.t.length && k < y.length; k++) if (w.t[k] >= t0 && w.t[k] <= t1) { t.push(w.t[k]); v.push(y[k]); }
  return t.length > 0 ? { t, y: v } : { t: w.t.slice(0, y.length), y: y.slice() };
}
/** Time average (trapezoid); one sample (a DC operating point) is its own average. */
export function avg(s: Sig | undefined): number {
  if (!s || s.y.length === 0) return 0;
  const n = s.y.length, span = s.t[n - 1] - s.t[0];
  if (n === 1 || !(span > 0)) { let a = 0; for (const v of s.y) a += v; return a / n; }
  let a = 0; for (let k = 1; k < n; k++) a += ((s.t[k] - s.t[k - 1]) * (s.y[k] + s.y[k - 1])) / 2;
  return a / span;
}
export const maxOf = (s: Sig | undefined): number => { let m = -Infinity; for (const v of s?.y ?? []) if (v > m) m = v; return m; };
export const minOf = (s: Sig | undefined): number => { let m = Infinity; for (const v of s?.y ?? []) if (v < m) m = v; return m; };
export const peakAbs = (s: Sig | undefined): number => { let m = 0; for (const v of s?.y ?? []) if (Math.abs(v) > m) m = Math.abs(v); return m; };
/** Longest duration over which pred(sample) holds on consecutive samples (each sample holds until the next). One sample: Infinity if true. */
export function dwell(s: Sig | undefined, pred: (v: number) => boolean): number {
  if (!s) return 0;
  const n = s.y.length; let best = 0;
  if (n === 1) return pred(s.y[0]) ? Infinity : 0;
  for (let i = 0; i < n; i++) {
    if (!pred(s.y[i])) continue;
    let j = i; while (j + 1 < n && pred(s.y[j + 1])) j++;
    const d = (j + 1 < n ? s.t[j + 1] : s.t[j]) - s.t[i];
    if (d > best) best = d;
    i = j;
  }
  return best;
}

/** Power of a part: the p() series summed over its elements; falls back to v*i for a two-terminal part with no p() series. */
export function partPower(ckt: NetLike, part: RatedPart, w: Window): { avg: number; peak: number } {
  const s = partSignals(ckt, part);
  const ps = s.p.map((n) => sig(w, n)).filter((x): x is Sig => x !== undefined);
  if (ps.length > 0) {
    const tot: Sig = { t: ps[0].t, y: ps[0].y.map((_, k) => ps.reduce((a, x) => a + (x.y[k] ?? 0), 0)) };
    return { avg: avg(tot), peak: maxOf(tot) };
  }
  const v = sig(w, s.v), i = sig(w, s.i);
  if (v && i && !s.vc) { const pw: Sig = { t: v.t, y: v.y.map((x, k) => x * (i.y[k] ?? 0)) }; return { avg: avg(pw), peak: maxOf(pw) }; }
  return { avg: 0, peak: 0 };
}
