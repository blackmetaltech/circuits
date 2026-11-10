// Diode family device (kind 'D'): diode, LED, Zener, Schottky are all this device with different parameters (DESIGN §3.3, §4.2).
// nodes [A (anode), K (cathode)]; with Rs > 0 one internal node J (junction anode): A –Rs– J –junction– K.
//
// Shockley:   I = Is·(e^(Vd/(N·Vt)) − 1)               Vd = v(J) − v(K), Vt = LAWS.vtAt300K (25.852 mV; T fixed at 300 K in v0.1)
// Breakdown:  if p.bv is given: I −= Ibv·e^(−(Vd + BV)/(Nbv·Vt))      (Ibv = breakdown current AT Vd = −BV; Nbv default 1)
//             Nbv = 1 gives a sharp knee (dynamic resistance Vt/Ibv at the knee); the Zener's slope above the knee is Rs.
// Guard:      e^x for x > 80 continues linearly: e^80·(1 + (x − 80)), so nothing overflows (derivative e^80, continuous).
// gmin:       ctx.gmin (1e-12 S in a settled solution) in parallel with every junction (stamped, and included in terminalCurrents at 1e-12).
// Companion:  gtot = dI/dVd + gmin,  Ieq = I(Vd) + gmin·Vd − gtot·Vd;  stamped between J and K as conductance gtot plus a source Ieq.
//
// Parameters (Element.p, SI): is (1e-14), n (1), rs (0), bv, ibv (1e-3 if bv given), nbv (1);
//   textbook model: p.ideal = 1 → "constant 0.7 V" diode. Piecewise-linear: forward (Vd ≥ vf, vf default 0.7) it is a vf source in
//   series with ron (default 1 mΩ); reverse it is open (gmin only). With bv also given it is an ideal Zener: for Vd ≤ −bv it is a −bv
//   source in series with ron. No internal node, no limiting. State iteration: the region (ON/OFF) is chosen from the current Newton
//   iterate, deterministically; a converged point has the same region as the one it was stamped in. A cycling case falls to the
//   normal homotopy chain in op.ts (it is bounded by iteration counts).
import { dmath } from '@core/numerics';
import { LAWS } from '../../laws';
import type { CElem, Device, Element } from '../types';
import { pnjlim, vcritOf } from '../limit';

const VT = LAWS.vtAt300K;
const E80 = dmath.exp(80);                      // pure constant
const GMIN_FIXED = 1e-12;                       // junction gmin assumed by terminalCurrents (a settled solution uses 1e-12)

/** e^x with the linear continuation above 80. */
export const expg = (x: number): number => (x > 80 ? E80 * (1 + (x - 80)) : dmath.exp(x));
/** d(expg)/dx. */
const dexpg = (x: number): number => (x > 80 ? E80 : dmath.exp(x));

export const hasRs = (p: Element['p']): boolean => (p.rs ?? 0) > 0 && p.ideal !== 1;

export interface Junction { i: number; g: number }
/** Junction current and slope at Vd (model equations, including the shunt `gmin`). */
export function junction(p: Element['p'], vd: number, gmin: number): Junction {
  let i: number, g: number;
  if (p.ideal === 1) {
    const vf = p.vf ?? 0.7, ron = p.ron ?? 1e-3;
    if (p.bv !== undefined && vd <= -p.bv) { i = (vd + p.bv) / ron; g = 1 / ron; }
    else if (vd >= vf) { i = (vd - vf) / ron; g = 1 / ron; }
    else { i = 0; g = 0; }
  } else {
    const is = p.is ?? 1e-14, nVt = (p.n ?? 1) * VT, a = vd / nVt;
    i = is * (expg(a) - 1); g = (is * dexpg(a)) / nVt;
    if (p.bv !== undefined) {
      const bVt = (p.nbv ?? 1) * VT, b = -(vd + p.bv) / bVt, ibv = p.ibv ?? 1e-3;
      i -= ibv * expg(b); g += (ibv * dexpg(b)) / bVt;
    }
  }
  return { i: i + gmin * vd, g: g + gmin };
}

const vOf = (x: ArrayLike<number>, k: number): number => (k < 0 ? 0 : x[k]);
const jIdx = (e: CElem): number => (e.internal.length ? e.internal[0] : e.nodes[0]);

/** Junction voltage at x. */
export const junctionVoltage = (e: CElem, x: ArrayLike<number>): number => vOf(x, jIdx(e)) - vOf(x, e.nodes[1]);

/** Initial-guess hook (op.ts): put the junction ON-ish at 0.6 V above its cathode where the anode side is still at 0. */
export function seedDiode(e: CElem, x: Float64Array): void {
  if (e.el.p.ideal === 1) return;
  const j = jIdx(e), k = e.nodes[1];
  if (e.internal.length && e.nodes[0] >= 0 && x[e.nodes[0]] === 0) x[e.nodes[0]] = vOf(x, k) + 0.6;
  if (j >= 0 && x[j] === 0) x[j] = vOf(x, k) + 0.6;
}

export const D: Device = {
  kind: 'D', terminals: 2, isLinear: false,
  branches: () => 0,
  internalNodes: (el) => (hasRs(el.p) ? 1 : 0),
  validate(el) {
    const p = el.p;
    if (!(p.is === undefined || (p.is > 0 && Number.isFinite(p.is)))) return `${el.id}: Is must be positive`;
    if (!(p.n === undefined || (p.n > 0 && Number.isFinite(p.n)))) return `${el.id}: N must be positive`;
    if (!(p.rs === undefined || (p.rs >= 0 && Number.isFinite(p.rs)))) return `${el.id}: Rs must be >= 0`;
    if (!(p.bv === undefined || (p.bv > 0 && Number.isFinite(p.bv)))) return `${el.id}: BV must be positive`;
    if (!(p.ibv === undefined || p.ibv > 0)) return `${el.id}: Ibv must be positive`;
    if (!(p.nbv === undefined || p.nbv > 0)) return `${el.id}: Nbv must be positive`;
    if (!(p.ron === undefined || p.ron > 0)) return `${el.id}: Ron must be positive`;
    return null;
  },
  stampDC(e, c) {
    const p = e.el.p, a = e.nodes[0], k = e.nodes[1], j = jIdx(e);
    if (e.internal.length) c.g(a, j, 1 / p.rs);
    const vd = c.v(j) - c.v(k), q = junction(p, vd, c.gmin);
    c.g(j, k, q.g);
    c.i(j, k, q.i - q.g * vd);
  },
  stampAC(e, c) {
    const p = e.el.p, a = e.nodes[0], k = e.nodes[1], j = jIdx(e);
    if (e.internal.length) c.y(a, j, 1 / p.rs);
    c.y(j, k, junction(p, vOf(c.x, j) - vOf(c.x, k), GMIN_FIXED).g);
  },
  limit(e, xNew, xOld) {
    const p = e.el.p;
    if (p.ideal === 1) return false;
    const j = jIdx(e), k = e.nodes[1];
    const vnew = vOf(xNew, j) - vOf(xNew, k), vold = vOf(xOld, j) - vOf(xOld, k);
    const nVt = (p.n ?? 1) * VT, vcrit = vcritOf(nVt, p.is ?? 1e-14);
    let v = vnew;
    if (p.bv !== undefined && vnew < Math.min(0, -p.bv + 10 * (p.nbv ?? 1) * VT)) {
      // reflected junction: limit the breakdown excursion exactly like a forward one (SPICE3 dioload)
      const bVt = (p.nbv ?? 1) * VT;
      v = -(pnjlim(-(vnew + p.bv), -(vold + p.bv), bVt, vcrit) + p.bv);
    } else v = pnjlim(vnew, vold, nVt, vcrit);
    if (v === vnew) return false;
    // Scale the WHOLE step (x = xOld + α·Δ) so the junction lands on its limited voltage. Moving a single node instead (what a
    // per-device clamp would do) lets parallel / chained junctions on shared nodes undo each other and blow up another junction.
    let alpha = (v - vold) / (vnew - vold);
    alpha = Math.abs(vnew - vold) < 4 * nVt ? Math.max(alpha, 0.5) : Math.max(alpha, 0.02);
    for (let i = 0; i < xNew.length; i++) xNew[i] = xOld[i] + alpha * (xNew[i] - xOld[i]);
    return true;
  },
  terminalCurrents(e, x) {
    const i = junction(e.el.p, junctionVoltage(e, x), GMIN_FIXED).i;
    return [i, -i];
  },
  topo: () => ({ dc: [[0, 1]], ideal: [], forced: [] }),
};
