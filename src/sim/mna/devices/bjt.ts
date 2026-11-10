// Bipolar transistors (DESIGN §3.3): kind 'Q' (NPN/PNP, EM-lite) and kind 'DAR' (Darlington macro). nodes [C, B, E].
//
// EM-lite (Ebers-Moll transport form, optional Early effect; vbe, vbc are the NPN-sense junction voltages):
//   Ic = Is(e^(vbe/Vt) − e^(vbc/Vt))·(1 + vce/Vaf) − (Is/Br)(e^(vbc/Vt) − 1)         vce = vbe − vbc, factor floored at 0.01
//   Ib = (Is/Bf)(e^(vbe/Vt) − 1) + (Is/Br)(e^(vbc/Vt) − 1)           Ie = −(Ic + Ib)
//   PNP: pol = −1, all junction voltages negated and all currents negated (exact mirror). gmin (ctx.gmin) shunts both junctions.
//   Currents are "into the terminal" (passive sign): NPN active has ic, ib > 0 and ie < 0.
// Textbook (p.ideal = 1): constant Vbe = vf (0.7 V, through ron 1 mΩ) when ON; collector current β·Ib; saturation clamps Vce at
//   vcesat (0.2 V) through ronc (1 mΩ). The region comes from the Newton iterate (like the ideal diode). Small-signal: gm = Ic/Vt, rπ = β/gm.
// Parameters (Element.p): is (1e-14), bf (100), br (1), vaf (absent = no Early), pol (1 | −1), ideal, vf, ron, vcesat, ronc.
// Darlington 'DAR' (TIP120): Q1(C,B,M) drives Q2(C,M,E); R1 = p.rb (8 kΩ) across B–M, R2 = p.re (120 Ω) across M–E; M is one internal node.
//   Per-stage is / bf are shared (the catalogue derives bf from the composite hFE: bf·(bf + 1) = hFE).
// Limiting: pnjlim on each junction, applied by scaling the whole Newton step (see diode.ts for why).
import { dmath } from '@core/numerics';
import { LAWS } from '../../laws';
import type { CElem, Device, Element, Params } from '../types';
import { pnjlim, vcritOf } from '../limit';
import { expg } from './diode';

const VT = LAWS.vtAt300K;
const E80 = dmath.exp(80);
const dexpg = (x: number): number => (x > 80 ? E80 : dmath.exp(x));
const GMIN_FIXED = 1e-12;
const vOf = (x: ArrayLike<number>, k: number): number => (k < 0 ? 0 : x[k]);

export interface BjtEval { ic: number; ib: number; icbe: number; icbc: number; ibbe: number; ibbc: number }

/** NPN-sense model: collector / base currents and their derivatives w.r.t. vbe, vbc (gmin shunts included). */
export function bjtEval(p: Params, vbe: number, vbc: number, gmin: number): BjtEval {
  let ic: number, ib: number, icbe: number, icbc: number, ibbe: number, ibbc: number;
  if (p.ideal === 1) {
    const vf = p.vf ?? 0.7, ron = p.ron ?? 1e-3, bf = p.bf ?? 100, vcs = p.vcesat ?? 0.2, ronc = p.ronc ?? 1e-3;
    const on = vbe >= vf, gb = on ? 1 / ron : 0;
    ib = on ? (vbe - vf) / ron : 0; ibbe = gb; ibbc = 0;
    ic = bf * ib; icbe = bf * gb; icbc = 0;
    const vce = vbe - vbc;
    if (on && vce < vcs) { ic += (vce - vcs) / ronc; icbe += 1 / ronc; icbc -= 1 / ronc; }
  } else {
    const is = p.is ?? 1e-14, bf = p.bf ?? 100, br = p.br ?? 1, a = vbe / VT, b = vbc / VT;
    const ef = expg(a), er = expg(b), def = (is * dexpg(a)) / VT, der = (is * dexpg(b)) / VT;
    let f = 1, df = 0;
    if (p.vaf !== undefined) { const raw = 1 + (vbe - vbc) / p.vaf; if (raw > 0.01) { f = raw; df = 1 / p.vaf; } else f = 0.01; }
    const t = is * (ef - er);
    ic = t * f - (is / br) * (er - 1);
    icbe = def * f + t * df;
    icbc = -der * f - t * df - der / br;
    ib = (is / bf) * (ef - 1) + (is / br) * (er - 1);
    ibbe = def / bf; ibbc = der / br;
  }
  ib += gmin * (vbe + vbc); ibbe += gmin; ibbc += gmin;
  ic -= gmin * vbc; icbc -= gmin;
  return { ic, ib, icbe, icbc, ibbe, ibbc };
}

/** Small-signal (hybrid-π) terms for AC: textbook devices use gm = Ic/Vt, gπ = gm/β in the active region. */
function acEval(p: Params, vbe: number, vbc: number): BjtEval {
  const q = bjtEval(p, vbe, vbc, GMIN_FIXED);
  if (p.ideal !== 1) return q;
  const bf = p.bf ?? 100, vcs = p.vcesat ?? 0.2;
  const active = vbe >= (p.vf ?? 0.7) && vbe - vbc >= vcs, gm = active ? q.ic / VT : 0;
  return { ic: q.ic, ib: q.ib, icbe: gm + GMIN_FIXED, icbc: -GMIN_FIXED, ibbe: gm / bf + GMIN_FIXED, ibbc: GMIN_FIXED };
}

type Node3 = readonly [number, number, number];
const pol = (p: Params): number => (p.pol === -1 ? -1 : 1);

/** One transistor's currents (into C, B, E) and 3×3 Jacobian [row t][col s] at node voltages (vc, vb, ve). */
function lin(p: Params, vc: number, vb: number, ve: number, gmin: number, ac = false) {
  const s = pol(p), q = ac ? acEval(p, s * (vb - ve), s * (vb - vc)) : bjtEval(p, s * (vb - ve), s * (vb - vc), gmin);
  const ic = s * q.ic, ib = s * q.ib;
  const J = [[-q.icbc, q.icbe + q.icbc, -q.icbe], [-q.ibbc, q.ibbe + q.ibbc, -q.ibbe], [0, 0, 0]];
  for (let k = 0; k < 3; k++) J[2][k] = -(J[0][k] + J[1][k]);
  return { i: [ic, ib, -(ic + ib)], J };
}

function stampQ(c: import('../stamp').StampCtx, n: Node3, p: Params): void {
  const v = [c.v(n[0]), c.v(n[1]), c.v(n[2])], { i, J } = lin(p, v[0], v[1], v[2], c.gmin);
  for (let t = 0; t < 3; t++) {
    let ieq = i[t];
    for (let s = 0; s < 3; s++) { c.m(n[t], n[s], J[t][s]); ieq -= J[t][s] * v[s]; }
    c.r(n[t], -ieq);
  }
}
function stampQac(c: import('../stamp').AcCtx, n: Node3, p: Params): void {
  const { J } = lin(p, vOf(c.x, n[0]), vOf(c.x, n[1]), vOf(c.x, n[2]), GMIN_FIXED, true);
  for (let t = 0; t < 3; t++) for (let s = 0; s < 3; s++) c.m(n[t], n[s], J[t][s]);
}

/** Limit the junctions of one or more transistors by scaling the whole Newton step; true when changed. */
function limitQ(xNew: Float64Array, xOld: Float64Array, subs: { n: Node3; p: Params }[]): boolean {
  let alpha = 1;
  for (const { n, p } of subs) {
    if (p.ideal === 1) continue;
    const s = pol(p), nVt = VT, vcrit = vcritOf(nVt, p.is ?? 1e-14);
    for (const k of [2, 0]) {                                      // BE then BC junction: (base − other terminal)
      const vn = s * (vOf(xNew, n[1]) - vOf(xNew, n[k])), vo = s * (vOf(xOld, n[1]) - vOf(xOld, n[k]));
      const v = pnjlim(vn, vo, nVt, vcrit);
      if (v !== vn) { const a = (v - vo) / (vn - vo); alpha = Math.min(alpha, Math.abs(vn - vo) < 4 * nVt ? Math.max(a, 0.5) : Math.max(a, 0.02)); }
    }
  }
  if (alpha === 1) return false;
  for (let i = 0; i < xNew.length; i++) xNew[i] = xOld[i] + alpha * (xNew[i] - xOld[i]);
  return true;
}

function validateQ(el: Element): string | null {
  const p = el.p;
  if (!(p.is === undefined || (p.is > 0 && Number.isFinite(p.is)))) return `${el.id}: Is must be positive`;
  if (!(p.bf === undefined || (p.bf > 0 && Number.isFinite(p.bf)))) return `${el.id}: Bf must be positive`;
  if (!(p.br === undefined || (p.br > 0 && Number.isFinite(p.br)))) return `${el.id}: Br must be positive`;
  if (!(p.vaf === undefined || (p.vaf > 0 && Number.isFinite(p.vaf)))) return `${el.id}: Vaf must be positive`;
  if (!(p.pol === undefined || p.pol === 1 || p.pol === -1)) return `${el.id}: pol must be 1 or -1`;
  if (!(p.ron === undefined || p.ron > 0) || !(p.ronc === undefined || p.ronc > 0)) return `${el.id}: Ron must be positive`;
  return null;
}
const nodes3 = (e: CElem): Node3 => [e.nodes[0], e.nodes[1], e.nodes[2]];

export const Q: Device = {
  kind: 'Q', terminals: 3, isLinear: false,
  branches: () => 0, internalNodes: () => 0,
  validate: validateQ,
  stampDC(e, c) { stampQ(c, nodes3(e), e.el.p); },
  stampAC(e, c) { stampQac(c, nodes3(e), e.el.p); },
  limit: (e, xNew, xOld) => limitQ(xNew, xOld, [{ n: nodes3(e), p: e.el.p }]),
  terminalCurrents(e, x) { const [c, b, em] = e.nodes; return lin(e.el.p, vOf(x, c), vOf(x, b), vOf(x, em), GMIN_FIXED).i; },
  topo: () => ({ dc: [[0, 1], [1, 2], [0, 2]], ideal: [], forced: [] }),
};

// ---- Darlington
const rbOf = (p: Params): number => p.rb ?? 8000, reOf = (p: Params): number => p.re ?? 120;
const stages = (e: CElem): { n: Node3; p: Params }[] => { const m = e.internal[0]; return [{ n: [e.nodes[0], e.nodes[1], m], p: e.el.p }, { n: [e.nodes[0], m, e.nodes[2]], p: e.el.p }]; };

export const DAR: Device = {
  kind: 'DAR', terminals: 3, isLinear: false,
  branches: () => 0, internalNodes: () => 1,
  validate(el) { return validateQ(el) ?? (rbOf(el.p) > 0 && reOf(el.p) > 0 ? null : `${el.id}: internal resistors must be positive`); },
  stampDC(e, c) {
    const [s1, s2] = stages(e), m = e.internal[0];
    stampQ(c, s1.n, s1.p); stampQ(c, s2.n, s2.p);
    c.g(e.nodes[1], m, 1 / rbOf(e.el.p)); c.g(m, e.nodes[2], 1 / reOf(e.el.p));
  },
  stampAC(e, c) {
    const [s1, s2] = stages(e), m = e.internal[0];
    stampQac(c, s1.n, s1.p); stampQac(c, s2.n, s2.p);
    c.y(e.nodes[1], m, 1 / rbOf(e.el.p)); c.y(m, e.nodes[2], 1 / reOf(e.el.p));
  },
  limit: (e, xNew, xOld) => limitQ(xNew, xOld, stages(e)),
  terminalCurrents(e, x) {
    const m = e.internal[0], [s1, s2] = stages(e);
    const a = lin(s1.p, vOf(x, s1.n[0]), vOf(x, s1.n[1]), vOf(x, s1.n[2]), GMIN_FIXED).i, b = lin(s2.p, vOf(x, s2.n[0]), vOf(x, s2.n[1]), vOf(x, s2.n[2]), GMIN_FIXED).i;
    const ic = a[0] + b[0], ib = a[1] + (vOf(x, e.nodes[1]) - vOf(x, m)) / rbOf(e.el.p);
    return [ic, ib, -(ic + ib)];
  },
  topo: () => ({ dc: [[0, 1], [1, 2], [0, 2]], ideal: [], forced: [] }),
};
