// MOSFET Level 1 (Shichman-Hodges, DESIGN §3.3): kind 'M', nodes [D, G, S]. Body tied to the source; N or P by p.pol (1 | −1).
//
// Equivalent N-channel voltages: vgs = pol·(vG − vS), vds = pol·(vD − vS). With vov = vgs − Vt (Vt = p.vt, the magnitude for both polarities):
//   cutoff  (vov ≤ 0):            Id = 0
//   triode  (0 < vds < vov):      Id = Kp[vov·vds − vds²/2](1 + λ·vds)
//   saturation (vds ≥ vov):       Id = (Kp/2)·vov²·(1 + λ·vds)
// Id flows D→S through the channel (equivalent sense); the actual terminal current is pol·Id. The channel is symmetric: for vds < 0
// the roles of D and S swap (Id = −f(vgd, −vds)), so the model is continuous and C1 through vds = 0. No subthreshold, no capacitances.
// Body diode: Shockley, anode S, cathode D for N (D→S reverse), I = dis·(e^(v/(dn·Vt)) − 1) with v = pol·(vS − vD); defaults dis 1e-12 A,
//   dn 1 (ESTIMATE: the catalogue gives no body-diode data; ~0.7 V at 1 A). Set p.dis = 0 to remove it.
// gmin (ctx.gmin) is a D–S shunt. The gate draws no DC current (topology treats the gate as open).
// Limiting (SPICE3): fetlim on vgs and limvds on vds in the frame of the OLD operating mode (swapped frame uses vgd, −vds), pnjlim on
//   the body diode; the whole Newton step is scaled so the limited quantity lands on its limited value.
// Parameters: kp (A/V²), vt (V), lambda (1/V, default 0), dis, dn, pol.
import { LAWS } from '../../laws';
import type { CElem, Device, Params } from '../types';
import { fetlim, limvds, pnjlim, vcritOf } from '../limit';
import { expg } from './diode';

const VT = LAWS.vtAt300K;
const GMIN_FIXED = 1e-12;
const vOf = (x: ArrayLike<number>, k: number): number => (k < 0 ? 0 : x[k]);
const pol = (p: Params): number => (p.pol === -1 ? -1 : 1);

interface Ch { i: number; gm: number; gds: number }
/** Forward-mode (vds ≥ 0) channel current and slopes. */
function fwd(p: Params, vgs: number, vds: number): Ch {
  const vov = vgs - p.vt, kp = p.kp, lam = p.lambda ?? 0;
  if (vov <= 0) return { i: 0, gm: 0, gds: 0 };
  const cl = 1 + lam * vds;
  if (vds < vov) {
    const core = vov * vds - (vds * vds) / 2;
    return { i: kp * core * cl, gm: kp * vds * cl, gds: kp * (vov - vds) * cl + kp * core * lam };
  }
  return { i: 0.5 * kp * vov * vov * cl, gm: kp * vov * cl, gds: 0.5 * kp * vov * vov * lam };
}
/** Channel current D→S in the equivalent N sense with ∂/∂vgs, ∂/∂vds (symmetric swap for vds < 0). */
function chan(p: Params, vgs: number, vds: number): Ch {
  if (vds >= 0) return fwd(p, vgs, vds);
  const f = fwd(p, vgs - vds, -vds);
  return { i: -f.i, gm: -f.gm, gds: f.gm + f.gds };
}
const dIs = (p: Params): number => p.dis ?? 1e-12;
const dNVt = (p: Params): number => (p.dn ?? 1) * VT;

/** Currents into D, G, S and the Jacobian [row][col] over (vD, vG, vS). */
function lin(p: Params, vd: number, vg: number, vs: number, gmin: number) {
  const s = pol(p), q = chan(p, s * (vg - vs), s * (vd - vs));
  const bd = dIs(p) > 0, a = s * (vs - vd) / dNVt(p);
  const ibd = bd ? dIs(p) * (expg(a) - 1) : 0, gbd = bd ? (dIs(p) * (a > 80 ? expg(80) : expg(a))) / dNVt(p) : 0;
  const jd = [q.gds + gmin + gbd, q.gm, -(q.gm + q.gds) - gmin - gbd];
  const id = s * q.i + gmin * (vd - vs) - s * ibd;
  return { i: [id, 0, -id], J: [jd, [0, 0, 0], jd.map((v) => -v)] };
}

export const M: Device = {
  kind: 'M', terminals: 3, isLinear: false,
  branches: () => 0, internalNodes: () => 0,
  validate(el) {
    const p = el.p;
    if (!(p.kp > 0 && Number.isFinite(p.kp))) return `${el.id}: Kp must be positive`;
    if (!Number.isFinite(p.vt)) return `${el.id}: Vt must be a number`;
    if (!(p.lambda === undefined || (p.lambda >= 0 && Number.isFinite(p.lambda)))) return `${el.id}: lambda must be >= 0`;
    if (!(p.dis === undefined || p.dis >= 0)) return `${el.id}: body-diode Is must be >= 0`;
    if (!(p.dn === undefined || p.dn > 0)) return `${el.id}: body-diode N must be positive`;
    if (!(p.pol === undefined || p.pol === 1 || p.pol === -1)) return `${el.id}: pol must be 1 or -1`;
    return null;
  },
  stampDC(e, c) {
    const n = e.nodes, v = [c.v(n[0]), c.v(n[1]), c.v(n[2])], { i, J } = lin(e.el.p, v[0], v[1], v[2], c.gmin);
    for (let t = 0; t < 3; t++) {
      let ieq = i[t];
      for (let s = 0; s < 3; s++) { c.m(n[t], n[s], J[t][s]); ieq -= J[t][s] * v[s]; }
      c.r(n[t], -ieq);
    }
  },
  stampAC(e, c) {
    const n = e.nodes, { J } = lin(e.el.p, vOf(c.x, n[0]), vOf(c.x, n[1]), vOf(c.x, n[2]), GMIN_FIXED);
    for (let t = 0; t < 3; t++) for (let s = 0; s < 3; s++) c.m(n[t], n[s], J[t][s]);
  },
  limit(e: CElem, xNew, xOld) {
    const p = e.el.p, s = pol(p), [d, g, so] = e.nodes;
    const frame = (x: Float64Array) => ({ vgs: s * (vOf(x, g) - vOf(x, so)), vds: s * (vOf(x, d) - vOf(x, so)) });
    const o = frame(xOld), n = frame(xNew), swapped = o.vds < 0;
    // work in the old mode's frame: normal (vgs, vds) or swapped (vgd, −vds)
    const gn = swapped ? n.vgs - n.vds : n.vgs, go = swapped ? o.vgs - o.vds : o.vgs;
    const dn = swapped ? -n.vds : n.vds, dold = swapped ? -o.vds : o.vds;
    const gl = fetlim(gn, go, p.vt), dl = limvds(dn, dold);
    let alpha = 1, any = false;
    const note = (vn: number, vl: number, vo: number) => { if (vl !== vn) { any = true; alpha = Math.min(alpha, Math.max((vl - vo) / (vn - vo), 0.02)); } };
    note(gn, gl, go); note(dn, dl, dold);
    if (dIs(p) > 0) {
      const bn = s * (vOf(xNew, so) - vOf(xNew, d)), bo = s * (vOf(xOld, so) - vOf(xOld, d));
      const bl = pnjlim(bn, bo, dNVt(p), vcritOf(dNVt(p), dIs(p)));
      if (bl !== bn) { any = true; alpha = Math.min(alpha, Math.max((bl - bo) / (bn - bo), Math.abs(bn - bo) < 4 * dNVt(p) ? 0.5 : 0.02)); }
    }
    if (!any) return false;
    for (let i = 0; i < xNew.length; i++) xNew[i] = xOld[i] + alpha * (xNew[i] - xOld[i]);
    return true;
  },
  terminalCurrents(e, x) {
    const [d, g, s] = e.nodes;
    return lin(e.el.p, vOf(x, d), vOf(x, g), vOf(x, s), GMIN_FIXED).i;
  },
  topo: () => ({ dc: [[0, 2]], ideal: [], forced: [] }),
};
