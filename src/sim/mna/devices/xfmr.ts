// Ideal transformer with optional winding resistances and magnetising inductance (DESIGN §3.7 macro row, §4.1 xfmr, oracle AC-07).
// Kind 'T'. nodes [p1, p2, s1, s2]; p.n = turns ratio Np/Ns (> 0); optional p.rp, p.rs winding resistances Ω (default 0), p.lm
// magnetising inductance H referred to the PRIMARY (default 0 = none, a perfect ratio that also passes DC).
// POLARITY: dots at p1 and s1 — a positive voltage p1→p2 produces a positive voltage s1→s2 of 1/n times it.
// Branch unknowns: ip (into p1, out of p2), is (into s1, out of s2), and im (magnetising current, only when lm > 0).
// With vwp = vp − rp·ip the voltage across the ideal primary winding and vws = vs − rs·is across the ideal secondary winding:
//   row ip :  vp − rp·ip − n·(vs − rs·is) = 0                 (vwp = n·vws)
//   row is :  n·(ip − im) + is = 0                            (ampere-turns; im = 0 without lm)
//   row im :  vwp − lm·dim/dt = 0                             (DC: short; transient: L companion as in l.ts; AC: jωlm)
// Terminal currents are passive-sign, so Σ v·i = rp·ip² + rs·is² + (magnetising energy rate) ≥ 0 and an ideal xfmr absorbs 0.
// State (lm > 0 only): [im, vwp] after the last accepted step.
import type { CElem, Device, Element } from '../types';
import type { StampCtx } from '../stamp';

const lmOf = (el: Element): number => el.p.lm ?? 0;

function stampRows(e: CElem, c: StampCtx, req: number, rhs: number): void {
  const [p1, p2, s1, s2] = e.nodes, [kp, ks] = e.branch, n = e.el.p.n, rp = e.el.p.rp ?? 0, rs = e.el.p.rs ?? 0;
  c.m(p1, kp, 1); c.m(p2, kp, -1); c.m(s1, ks, 1); c.m(s2, ks, -1);
  c.m(kp, p1, 1); c.m(kp, p2, -1); c.m(kp, s1, -n); c.m(kp, s2, n);
  if (rp !== 0) c.m(kp, kp, -rp);
  if (rs !== 0) c.m(kp, ks, n * rs);
  c.m(ks, kp, n); c.m(ks, ks, 1);
  if (lmOf(e.el) > 0) {
    const km = e.branch[2];
    c.m(ks, km, -n);
    c.m(km, p1, 1); c.m(km, p2, -1);
    if (rp !== 0) c.m(km, kp, -rp);
    if (req !== 0) c.m(km, km, -req);
    c.r(km, rhs);
  }
}
const vwpOf = (e: CElem, x: Float64Array): number =>
  (e.nodes[0] < 0 ? 0 : x[e.nodes[0]]) - (e.nodes[1] < 0 ? 0 : x[e.nodes[1]]) - (e.el.p.rp ?? 0) * x[e.branch[0]];

export const T: Device = {
  kind: 'T', terminals: 4, isLinear: true,
  branches: (el) => (lmOf(el) > 0 ? 3 : 2), internalNodes: () => 0, stateSize: (el) => (lmOf(el) > 0 ? 2 : 0),
  validate(el) {
    const { n, rp = 0, rs = 0, lm = 0 } = el.p;
    if (!(n > 0 && Number.isFinite(n))) return `${el.id}: turns ratio must be a positive number (got ${n})`;
    for (const [k, v] of [['rp', rp], ['rs', rs], ['lm', lm]] as const) if (!(v >= 0 && Number.isFinite(v))) return `${el.id}: ${k} must be >= 0 (got ${v})`;
    return null;
  },
  stampDC(e, c) { stampRows(e, c, 0, 0); },
  stampTran(e, c, method, h) {
    const lm = lmOf(e.el);
    if (!(lm > 0)) { stampRows(e, c, 0, 0); return; }
    const req = (method === 'TRAP' ? 2 : 1) * lm / h, i0 = c.state[e.so], v0 = c.state[e.so + 1];
    stampRows(e, c, req, method === 'TRAP' ? -v0 - req * i0 : -req * i0);
  },
  update(e, x, state) { if (lmOf(e.el) > 0) { state[e.so] = x[e.branch[2]]; state[e.so + 1] = vwpOf(e, x); } },
  initState(e, x, state) { if (lmOf(e.el) > 0) { state[e.so] = x[e.branch[2]]; state[e.so + 1] = 0; } },
  stampAC(e, c, omega) {
    const [p1, p2, s1, s2] = e.nodes, [kp, ks] = e.branch, n = e.el.p.n, rp = e.el.p.rp ?? 0, rs = e.el.p.rs ?? 0, lm = lmOf(e.el);
    c.m(p1, kp, 1); c.m(p2, kp, -1); c.m(s1, ks, 1); c.m(s2, ks, -1);
    c.m(kp, p1, 1); c.m(kp, p2, -1); c.m(kp, s1, -n); c.m(kp, s2, n);
    c.m(kp, kp, -rp); c.m(kp, ks, n * rs);
    c.m(ks, kp, n); c.m(ks, ks, 1);
    if (lm > 0) {
      const km = e.branch[2];
      c.m(ks, km, -n);
      c.m(km, p1, 1); c.m(km, p2, -1); c.m(km, kp, -rp); c.m(km, km, 0, -omega * lm);
    }
  },
  terminalCurrents(e, x) { const ip = x[e.branch[0]], is = x[e.branch[1]]; return [ip, -ip, is, -is]; },
  topo: () => ({ dc: [[0, 1], [2, 3]], ideal: [], forced: [] }),
};
