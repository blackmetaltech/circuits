// Voltage-controlled current source G: nodes [a, b, c, d], p.gm siemens. Current gm·(vc − vd) flows a→b THROUGH the element.
// The control port (c, d) draws no current.
import type { Device, Element } from '../types';

const v = (x: Float64Array, i: number): number => (i < 0 ? 0 : x[i]);

export const G: Device = {
  kind: 'G', terminals: 4, isLinear: true,
  branches: () => 0, internalNodes: () => 0,
  validate: (el: Element) => (Number.isFinite(el.p.gm) ? null : `${el.id}: transconductance is not a number`),
  stampDC(e, c) { const [a, b, cc, d] = e.nodes, gm = e.el.p.gm; c.m(a, cc, gm); c.m(a, d, -gm); c.m(b, cc, -gm); c.m(b, d, gm); },
  stampAC(e, c) { const [a, b, cc, d] = e.nodes, gm = e.el.p.gm; c.m(a, cc, gm); c.m(a, d, -gm); c.m(b, cc, -gm); c.m(b, d, gm); },
  terminalCurrents(e, x) { const i = e.el.p.gm * (v(x, e.nodes[2]) - v(x, e.nodes[3])); return [i, -i, 0, 0]; },
  topo: () => ({ dc: [], ideal: [], forced: [[0, 1]] }),
};
