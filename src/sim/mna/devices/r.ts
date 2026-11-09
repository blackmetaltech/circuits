// Resistor. nodes [a, b]; p.r Ω (> 0, finite). i = (va − vb)/r from a to b.
import type { Device, Element } from '../types';

export const R: Device = {
  kind: 'R', terminals: 2, isLinear: true,
  branches: () => 0, internalNodes: () => 0,
  validate: (el: Element) => (el.p.r > 0 && Number.isFinite(el.p.r) ? null : `${el.id}: resistance must be a positive number (got ${el.p.r})`),
  stampDC(e, c) { c.g(e.nodes[0], e.nodes[1], 1 / e.el.p.r); },
  stampAC(e, c) { c.y(e.nodes[0], e.nodes[1], 1 / e.el.p.r); },
  terminalCurrents(e, x) {
    const v0 = e.nodes[0] < 0 ? 0 : x[e.nodes[0]], v1 = e.nodes[1] < 0 ? 0 : x[e.nodes[1]];
    const i = (v0 - v1) / e.el.p.r; return [i, -i];
  },
  topo: () => ({ dc: [[0, 1]], ideal: [], forced: [] }),
};
