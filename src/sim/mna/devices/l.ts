// Inductor as an MNA branch. nodes [a, b]; p.l henries (> 0). Optional p.ic = initial current a→b (default 0), optional p.rs = series winding resistance, ohm (a motor / fan winding: chapter 5). One branch unknown i (a→b).
// State [iₙ, vₙ] = current and voltage after the last accepted step.
// DC: a 0 V short (v − 0·i = 0). Transient: v − Req·i = rhs with
//   TRAP Req = 2L/h, rhs = −vₙ − Req·iₙ      BE Req = L/h, rhs = −Req·iₙ        (DESIGN §3.5)
// AC: v − jωL·i = 0.
import type { CElem, Device, Element } from '../types';
import type { StampCtx } from '../stamp';

function branchRow(e: CElem, c: StampCtx, req: number, rhs: number): void {
  const [a, b] = e.nodes, k = e.branch[0];
  c.m(a, k, 1); c.m(b, k, -1); c.m(k, a, 1); c.m(k, b, -1);
  const rs = e.el.p.rs ?? 0;
  if (req + rs !== 0) c.m(k, k, -(req + rs));
  c.r(k, rhs);
}
const vOf = (e: CElem, x: Float64Array): number => (e.nodes[0] < 0 ? 0 : x[e.nodes[0]]) - (e.nodes[1] < 0 ? 0 : x[e.nodes[1]]);

export const L: Device = {
  kind: 'L', terminals: 2, isLinear: true,
  branches: () => 1, internalNodes: () => 0, stateSize: () => 2,
  validate: (el: Element) => (el.p.l > 0 && Number.isFinite(el.p.l) ? null : `${el.id}: inductance must be a positive number (got ${el.p.l})`),
  stampDC(e, c) { branchRow(e, c, 0, 0); },
  stampTran(e, c, method, h) {
    const req = (method === 'TRAP' ? 2 : 1) * e.el.p.l / h, i0 = c.state[e.so], v0 = c.state[e.so + 1];
    branchRow(e, c, req, method === 'TRAP' ? -v0 - req * i0 : -req * i0);
  },
  update(e, x, state) { state[e.so] = x[e.branch[0]]; state[e.so + 1] = vOf(e, x) - (e.el.p.rs ?? 0) * x[e.branch[0]]; },   // the stored voltage is the inductor's own (the winding resistance drop is not part of it)
  initState(e, x, state) { state[e.so] = x[e.branch[0]]; state[e.so + 1] = 0; },
  stampAC(e, c, omega) {
    const [a, b] = e.nodes, k = e.branch[0];
    c.m(a, k, 1); c.m(b, k, -1); c.m(k, a, 1); c.m(k, b, -1); c.m(k, k, -(e.el.p.rs ?? 0), -omega * e.el.p.l);
  },
  terminalCurrents(e, x) { const i = x[e.branch[0]]; return [i, -i]; },
  topo: (el: Element) => ((el.p.rs ?? 0) > 0 ? { dc: [[0, 1]], ideal: [], forced: [] } : { dc: [[0, 1]], ideal: [[0, 1]], forced: [] }),
};
