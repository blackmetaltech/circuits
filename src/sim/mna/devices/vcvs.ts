// Voltage-controlled voltage source E: nodes [a, b, c, d], p.gain. Branch row: va − vb − gain·(vc − vd) = 0. The control port
// (c, d) draws no current. i = current a→b through the output branch.
import type { Device, Element } from '../types';
import { branchCurrents } from './vsrc';

export const E: Device = {
  kind: 'E', terminals: 4, isLinear: true,
  branches: () => 1, internalNodes: () => 0,
  validate: (el: Element) => (Number.isFinite(el.p.gain) ? null : `${el.id}: gain is not a number`),
  stampDC(e, c) {
    const [a, b, cc, d] = e.nodes, k = e.branch[0], g = e.el.p.gain;
    c.m(a, k, 1); c.m(b, k, -1); c.m(k, a, 1); c.m(k, b, -1); c.m(k, cc, -g); c.m(k, d, g);
  },
  stampAC(e, c) {
    const [a, b, cc, d] = e.nodes, k = e.branch[0], g = e.el.p.gain;
    c.m(a, k, 1); c.m(b, k, -1); c.m(k, a, 1); c.m(k, b, -1); c.m(k, cc, -g); c.m(k, d, g);
  },
  terminalCurrents(e, x) { const i = x[e.branch[0]]; return [i, -i, 0, 0]; },
  topo: () => ({ dc: [[0, 1]], ideal: [[0, 1]], forced: [] }),
};
