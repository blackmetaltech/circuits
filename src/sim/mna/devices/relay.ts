// Relay macro (DESIGN §3.7). Kind 'RLY'. Terminals [C1, C2, COM, NO, NC]; one branch unknown i = coil current C1→C2; state [i, vL, f]
// (coil current and inductive voltage after the last accepted step, armature f: 0 = released (NC–COM closed), 1 = operated (NO–COM closed)).
//   coil     C1 − C2 = R·i + L·di/dt   (inductor companion as in l.ts with the series R)
//   contacts COM–NO and COM–NC are switches: Ron (50 mΩ) closed, Roff (1e9) open, chosen by f
//   events   g = Ipull − |i| while released, g = |i| − Idrop while operated  (pull-in / drop-out hysteresis, crossing located by tran.ts)
// The OP / initial state is always "released" (no event is evaluated at DC); transient runs find the operate time from the coil current.
import type { Device, Element } from '../types';

const vOf = (x: ArrayLike<number>, k: number): number => (k < 0 ? 0 : x[k]);
const [C1, C2, COM, NO, NC] = [0, 1, 2, 3, 4];

export const RLY: Device = {
  kind: 'RLY', terminals: 5, isLinear: false,
  branches: () => 1, internalNodes: () => 0, stateSize: () => 3,
  validate(el: Element) { const p = el.p; return p.rcoil > 0 && p.lcoil >= 0 && p.ipull > p.idrop && p.idrop >= 0 && p.ron > 0 && p.roff > 0 ? null : `${el.id}: relay parameters are not usable`; },
  stampDC(e, c) { stamp(e, c, 0, 0); },
  stampTran(e, c, method, h) {
    const req = (method === 'TRAP' ? 2 : 1) * e.el.p.lcoil / h, i0 = c.state[e.so], vl = c.state[e.so + 1];
    stamp(e, c, req, method === 'TRAP' ? -req * i0 - vl : -req * i0);
  },
  stampAC(e, c, omega) {
    const n = e.nodes, k = e.branch[0], p = e.el.p;
    c.m(n[C1], k, 1); c.m(n[C2], k, -1); c.m(k, n[C1], 1); c.m(k, n[C2], -1); c.m(k, k, -p.rcoil, -omega * p.lcoil);
    const go = 1 / p.ron, gf = 1 / p.roff;
    c.y(n[COM], n[NC], go); c.y(n[COM], n[NO], gf);   // AC analysis is taken at the released state
  },
  update(e, x, state) { const i = x[e.branch[0]]; state[e.so] = i; state[e.so + 1] = vOf(x, e.nodes[C1]) - vOf(x, e.nodes[C2]) - e.el.p.rcoil * i; },
  initState(e, x, state) { state[e.so] = x[e.branch[0]]; state[e.so + 1] = 0; },
  eventValue(e, x, state) { const i = Math.abs(x[e.branch[0]]), p = e.el.p; return state[e.so + 2] >= 0.5 ? i - p.idrop : p.ipull - i; },
  fire(e, _x, state) { state[e.so + 2] = state[e.so + 2] >= 0.5 ? 0 : 1; },
  terminalCurrents(e, x, state) {
    const n = e.nodes, p = e.el.p, i = x[e.branch[0]], f = (state[e.so + 2] ?? 0) >= 0.5;
    const gno = f ? 1 / p.ron : 1 / p.roff, gnc = f ? 1 / p.roff : 1 / p.ron;
    const ino = gno * (vOf(x, n[COM]) - vOf(x, n[NO])), inc = gnc * (vOf(x, n[COM]) - vOf(x, n[NC]));
    return [i, -i, ino + inc, -ino, -inc];
  },
  topo: () => ({ dc: [[C1, C2], [COM, NO], [COM, NC]], ideal: [], forced: [] }),
};

function stamp(e: Parameters<NonNullable<Device['stampTran']>>[0], c: Parameters<Device['stampDC']>[1], req: number, rhs: number): void {
  const n = e.nodes, k = e.branch[0], p = e.el.p, f = c.state[e.so + 2] >= 0.5;
  c.m(n[C1], k, 1); c.m(n[C2], k, -1); c.m(k, n[C1], 1); c.m(k, n[C2], -1); c.m(k, k, -(p.rcoil + req)); c.r(k, rhs);
  c.g(n[COM], n[NO], f ? 1 / p.ron : 1 / p.roff);
  c.g(n[COM], n[NC], f ? 1 / p.roff : 1 / p.ron);
}
