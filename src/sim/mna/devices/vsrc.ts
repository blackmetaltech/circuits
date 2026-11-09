// Ideal independent voltage source. nodes [a(+), b(−)]; p.v volts (scaled by ctx.lambda); optional p.ac = AC magnitude (phase 0).
// One branch unknown i = current a→b through the source (into the + terminal), so p = v·i < 0 when the source delivers.
// `stampVBranch` is shared by every "EMF + series r" device (battery, bench supply, ammeter, VCVS...):
//     va − vb − rs·i = E        (E = 0 and rs = 0 is a short; rs = 0 is an ideal source)
import type { CElem, Device, Element } from '../types';
import type { StampCtx } from '../stamp';

export function stampVBranch(e: CElem, c: StampCtx, E: number, rs: number): void {
  const [a, b] = e.nodes, k = e.branch[0];
  c.m(a, k, 1); c.m(b, k, -1); c.m(k, a, 1); c.m(k, b, -1);
  if (rs !== 0) c.m(k, k, -rs);
  c.r(k, E);
}
export function branchCurrents(e: CElem, x: Float64Array): number[] { const i = x[e.branch[0]]; return [i, -i]; }

export const V: Device = {
  kind: 'V', terminals: 2, isLinear: true,
  branches: () => 1, internalNodes: () => 0,
  validate: (el: Element) => (Number.isFinite(el.p.v) ? null : `${el.id}: source value is not a number`),
  stampDC(e, c) { stampVBranch(e, c, e.el.p.v * c.lambda, 0); },
  stampAC(e, c) { const [a, b] = e.nodes, k = e.branch[0]; c.m(a, k, 1); c.m(b, k, -1); c.m(k, a, 1); c.m(k, b, -1); c.r(k, e.el.p.ac ?? 0); },
  terminalCurrents: branchCurrents,
  topo: () => ({ dc: [[0, 1]], ideal: [[0, 1]], forced: [], source: [0, 1] }),
};
