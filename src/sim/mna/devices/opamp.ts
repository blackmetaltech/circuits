// Op-amp macro (DESIGN §3.7). Kind 'OA'. Terminals [in+, in−, out, V+, V−]; one internal node x; one branch unknown io (current OUT of the
// device into the out node); state [vx, ix] (history of the x-node capacitor, like a C).
//
//   input    Rin between in+ and in−  (no bias current, no offset in v0.1: flagged by the part's simplification key)
//   gain     i1 = Imax·tanh(gm·vd/Imax) into x, vd = v(in+) − v(in−); x sits on R1 = 1 MΩ ∥ C1 to the internal reference (ground):
//            gm = A0/R1, C1 = A0/(2π·GBW·R1) (dominant pole GBW/A0), Imax = SR·C1 (slew SR). No pole / no slew when GBW / SR are 0 (textbook).
//   clamps   x is held inside [V− + headLo − XM, V+ − headHi + XM] by soft one-sided conductances Gc = Imax/1 V (≤ 1 V of x overshoot, no
//            integrator windup); the output y = sclamp(x, V− + headLo, V+ − headHi), corner 20 mV (the soft-diode clamp of the spec)
//   output   Ro > 0: io = Isc·tanh((y − v_out)/(Isc·Ro))  (short-circuit limit);  Ro = 0: v_out = y (textbook, no limit)
//   supply   Iq·tanh((V+ − V−)/1 V) from V+ to V− always; the output current is drawn from V+ when sourcing and V− when sinking
//            (blend w = ½(1 + tanh(io/1 mA))), so Σ v·i over the terminals is the package power.
// Parameters (el.p, SI): a0, gbw, sr (V/s), rin, ro, isc, iq, headhi, headlo. `opampParams` (macros.ts) fills the defaults.
// Linearised (AC) at the OP: the same Jacobian + jω·C1 at x (stampAC).
import type { CElem, Device, Element } from '../types';
import { sclamp, sg, sp, th } from './smooth';

export const OA_R1 = 1e6;
const S_CLAMP = 0.02, S_X = 0.05, XM = 0.25, I_W = 1e-3;

interface Dv { gm: number; c1: number; imax: number; gc: number; gin: number }
const derive = (p: Element['p']): Dv => {
  const gm = p.a0 / OA_R1, c1 = p.gbw > 0 ? p.a0 / (2 * Math.PI * p.gbw * OA_R1) : 0;
  const imax = p.sr > 0 && c1 > 0 ? p.sr * c1 : gm * 50;
  return { gm, c1, imax, gc: imax, gin: 1 / p.rin };
};
const vOf = (x: ArrayLike<number>, k: number): number => (k < 0 ? 0 : x[k]);

/** Rail limits with the headrooms faded out when the supply collapses (so an unpowered / ramping amp rests near 0 V, not at V− + headLo):
 *  hi = V+ − hh·g, lo = V− + hl·g, g = softmin(1, 0.8·(V+ − V−)/(hh + hl)) (= 1 exactly once the supply exceeds 3.4·(hh + hl)). Partials w.r.t. V+ and V−. */
function rails(p: Element['p'], vp: number, vn: number): { hi: number; lo: number; hiP: number; hiN: number; loP: number; loN: number } {
  const hh = p.headhi, hl = p.headlo, hs = hh + hl;
  if (hs <= 0) return { hi: vp, lo: vn, hiP: 1, hiN: 0, loP: 0, loN: 1 };
  const k = 0.8 / hs, a = k * (vp - vn), z = (1 - a) / 0.05, g = 1 - 0.05 * sp(z), gp = k * sg(z);
  return { hi: vp - hh * g, lo: vn + hl * g, hiP: 1 - hh * gp, hiN: hh * gp, loP: hl * gp, loN: 1 - hl * gp };
}

/** Anything with m(i, j, v) and r(i, v): StampCtx, or AcCtx (real part). */
interface W { m(i: number, j: number, v: number): void; r(i: number, v: number): void }

/** Stamp the linearisation at x. `b` false (AC): matrix only. Capacitor companion (geq, ieq) is added by the caller. */
function stampOa(e: CElem, w: W, x: ArrayLike<number>, b: boolean, geq: number, ieq: number): void {
  const p = e.el.p, d = derive(p), [ip, im, out, vp, vn] = e.nodes, xi = e.internal[0], k = e.branch[0];
  const v = (j: number): number => vOf(x, j);
  const row = (r: number, F0: number, cols: number[], ds: number[]): void => {
    let s = 0;
    for (let j = 0; j < cols.length; j++) { w.m(r, cols[j], ds[j]); s += ds[j] * v(cols[j]); }
    if (b) w.r(r, s - F0);
  };
  // input
  w.m(ip, ip, d.gin); w.m(im, im, d.gin); w.m(ip, im, -d.gin); w.m(im, ip, -d.gin);
  // x node: linear (R1 + C1 companion) + nonlinear (clamp − gain current)
  const vd = v(ip) - v(im), tg = th((d.gm * vd) / d.imax), i1 = d.imax * tg.t, gd = d.gm * tg.d;
  const rl = rails(p, v(vp), v(vn));
  const xhi = rl.hi + XM, xlo = rl.lo - XM, vx = v(xi);
  const za = (vx - xhi) / S_X, zb = (xlo - vx) / S_X, sa = sg(za), sb = sg(zb);
  const ic = d.gc * S_X * (sp(za) - sp(zb));
  w.m(xi, xi, 1 / OA_R1 + geq);
  if (b) w.r(xi, -ieq);
  row(xi, ic - i1, [xi, vp, vn, ip, im], [d.gc * (sa + sb), -d.gc * (sa * rl.hiP + sb * rl.loP), -d.gc * (sa * rl.hiN + sb * rl.loN), -gd, gd]);
  // output stage
  const cl0 = sclamp(vx, rl.lo, rl.hi, S_CLAMP), vo = v(out), io = vOf(x, k);
  const cl = { y: cl0.y, dx: cl0.dx, dhi: cl0.dhi * rl.hiP + cl0.dlo * rl.loP, dlo: cl0.dhi * rl.hiN + cl0.dlo * rl.loN };
  if (p.ro > 0) {
    const a = (cl.y - vo) / (p.isc * p.ro), tt = th(a), f = tt.d / p.ro;
    row(k, io - p.isc * tt.t, [k, out, xi, vp, vn], [1, f, -f * cl.dx, -f * cl.dhi, -f * cl.dlo]);
  } else row(k, vo - cl.y, [out, xi, vp, vn], [1, -cl.dx, -cl.dhi, -cl.dlo]);
  w.m(out, k, -1);
  // supplies
  const tq = th(v(vp) - v(vn)), iq = p.iq * tq.t, diq = p.iq * tq.d;
  const wt = th(io / I_W), wb = 0.5 * (1 + wt.t), dwb = (0.5 * wt.d) / I_W;
  row(vp, io * wb + iq, [k, vp, vn], [wb + io * dwb, diq, -diq]);
  row(vn, io * (1 - wb) - iq, [k, vp, vn], [1 - wb - io * dwb, -diq, diq]);
}

export const OA: Device = {
  kind: 'OA', terminals: 5, isLinear: false,
  branches: () => 1, internalNodes: () => 1, stateSize: () => 2,
  validate(el: Element) {
    const p = el.p;
    if (!(p.a0 > 0 && p.rin > 0 && p.ro >= 0 && p.iq >= 0 && p.headhi >= 0 && p.headlo >= 0 && (p.ro === 0 || p.isc > 0))) return `${el.id}: op-amp parameters are not usable`;
    return null;
  },
  stampDC(e, c) { stampOa(e, c, c.x, true, 0, 0); },
  stampTran(e, c, method, h) {
    const d = derive(e.el.p);
    if (d.c1 === 0) { stampOa(e, c, c.x, true, 0, 0); return; }
    const g = (method === 'TRAP' ? 2 : 1) * d.c1 / h, vn = c.state[e.so], i0 = c.state[e.so + 1];
    stampOa(e, c, c.x, true, g, method === 'TRAP' ? -g * vn - i0 : -g * vn);
  },
  stampAC(e, c, omega) {
    stampOa(e, { m: (i, j, v) => c.m(i, j, v), r: () => undefined }, c.x, false, 0, 0);
    c.m(e.internal[0], e.internal[0], 0, omega * derive(e.el.p).c1);
  },
  update(e, x, state, method, h) {
    const c1 = derive(e.el.p).c1;
    if (c1 === 0) return;
    const v = x[e.internal[0]], g = (method === 'TRAP' ? 2 : 1) * c1 / h;
    state[e.so + 1] = method === 'TRAP' ? g * (v - state[e.so]) - state[e.so + 1] : g * (v - state[e.so]);
    state[e.so] = v;
  },
  initState(e, x, state) { state[e.so] = x[e.internal[0]]; state[e.so + 1] = 0; },
  terminalCurrents(e, x) {
    const p = e.el.p, d = derive(p), [ip, im, , vp, vn] = e.nodes, io = x[e.branch[0]];
    const gi = d.gin * (vOf(x, ip) - vOf(x, im)), iq = p.iq * th(vOf(x, vp) - vOf(x, vn)).t, wb = 0.5 * (1 + th(io / I_W).t);
    return [gi, -gi, -io, io * wb + iq, io * (1 - wb) - iq];
  },
  topo: () => ({ dc: [[0, 1], [2, 3], [3, 4]], ideal: [], forced: [] }),
};
