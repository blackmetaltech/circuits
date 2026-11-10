// Comparator macro (LM393 family, DESIGN §3.7). Kind 'CMP'. Terminals [in+, in−, out, V+, V−(GND)]; internal node x; no branch; state [vx, ix].
// Same input stage as the op-amp (A0 2e5) with a fast single pole (time constant tresp/ln 2, so the output reaches 50 % tresp after a large step),
// x clamped to ±1.5 V, and an OPEN-COLLECTOR output: an NPN switch from out to V− that conducts when x < −0.5 V:
//   S = σ((−x − 0.5)/0.1),   i_sink = S·Isink·tanh((v_out − V−)/(Ron·Isink))   (Ron 50 Ω, sink limit Isink). It needs a pull-up.
// The macro is continuous (no event surface): hysteresis is made by the external positive feedback, which the Newton loop resolves.
import type { CElem, Device, Element } from '../types';
import { sg, sp, th } from './smooth';
import { OA_R1 } from './opamp';

const LN2 = 0.6931471805599453, XC = 1.5, S_X = 0.05;
interface Dv { gm: number; c1: number; imax: number; gc: number; gin: number }
const derive = (p: Element['p']): Dv => {
  const gm = p.a0 / OA_R1, c1 = p.tresp / LN2 / OA_R1, imax = gm * 0.1;
  return { gm, c1, imax, gc: 10 * imax, gin: 1e-12 };
};
const vOf = (x: ArrayLike<number>, k: number): number => (k < 0 ? 0 : x[k]);
interface W { m(i: number, j: number, v: number): void; r(i: number, v: number): void }

function stampCmp(e: CElem, w: W, x: ArrayLike<number>, b: boolean, geq: number, ieq: number): void {
  const p = e.el.p, d = derive(p), [ip, im, out, vp, vn] = e.nodes, xi = e.internal[0];
  const v = (j: number): number => vOf(x, j);
  const row = (r: number, F0: number, cols: number[], ds: number[]): void => {
    let s = 0;
    for (let j = 0; j < cols.length; j++) { w.m(r, cols[j], ds[j]); s += ds[j] * v(cols[j]); }
    if (b) w.r(r, s - F0);
  };
  const vd = v(ip) - v(im), tg = th((d.gm * vd) / d.imax), i1 = d.imax * tg.t, gd = d.gm * tg.d, vx = v(xi);
  const za = (vx - XC) / S_X, zb = (-XC - vx) / S_X, ic = d.gc * S_X * (sp(za) - sp(zb));
  w.m(xi, xi, 1 / OA_R1 + geq);
  if (b) w.r(xi, -ieq);
  row(xi, ic - i1, [xi, ip, im], [d.gc * (sg(za) + sg(zb)), -gd, gd]);
  // open-collector switch out → V−
  const zs = (-vx - 0.5) / 0.1, S = sg(zs), dS = (-S * (1 - S)) / 0.1, vds = v(out) - v(vn), tt = th(vds / (p.ron * p.isink));
  const is = S * p.isink * tt.t, gs = (S * tt.d) / p.ron, gx = dS * p.isink * tt.t;
  row(out, is, [out, vn, xi], [gs, -gs, gx]);
  row(vn, -is, [out, vn, xi], [-gs, gs, -gx]);
  // quiescent current
  const tq = th(v(vp) - v(vn)), iq = p.iq * tq.t, diq = p.iq * tq.d;
  row(vp, iq, [vp, vn], [diq, -diq]);
  row(vn, -iq, [vp, vn], [-diq, diq]);
}

export const CMP: Device = {
  kind: 'CMP', terminals: 5, isLinear: false,
  branches: () => 0, internalNodes: () => 1, stateSize: () => 2,
  validate(el: Element) { const p = el.p; return p.a0 > 0 && p.tresp > 0 && p.isink > 0 && p.ron > 0 && p.iq >= 0 ? null : `${el.id}: comparator parameters are not usable`; },
  stampDC(e, c) { stampCmp(e, c, c.x, true, 0, 0); },
  stampTran(e, c, method, h) {
    const g = (method === 'TRAP' ? 2 : 1) * derive(e.el.p).c1 / h, vn = c.state[e.so], i0 = c.state[e.so + 1];
    stampCmp(e, c, c.x, true, g, method === 'TRAP' ? -g * vn - i0 : -g * vn);
  },
  stampAC(e, c, omega) {
    stampCmp(e, { m: (i, j, v) => c.m(i, j, v), r: () => undefined }, c.x, false, 0, 0);
    c.m(e.internal[0], e.internal[0], 0, omega * derive(e.el.p).c1);
  },
  update(e, x, state, method, h) {
    const v = x[e.internal[0]], g = (method === 'TRAP' ? 2 : 1) * derive(e.el.p).c1 / h;
    state[e.so + 1] = method === 'TRAP' ? g * (v - state[e.so]) - state[e.so + 1] : g * (v - state[e.so]);
    state[e.so] = v;
  },
  initState(e, x, state) { state[e.so] = x[e.internal[0]]; state[e.so + 1] = 0; },
  terminalCurrents(e, x) {
    const p = e.el.p, [, , out, vp, vn] = e.nodes, vx = x[e.internal[0]], S = sg((-vx - 0.5) / 0.1);
    const is = S * p.isink * th((vOf(x, out) - vOf(x, vn)) / (p.ron * p.isink)).t, iq = p.iq * th(vOf(x, vp) - vOf(x, vn)).t;
    const gi = 1e-12 * (vOf(x, e.nodes[0]) - vOf(x, e.nodes[1]));
    return [gi, -gi, is, iq, -is - iq];
  },
  topo: () => ({ dc: [[0, 1], [2, 4], [3, 4]], ideal: [], forced: [] }),
};
