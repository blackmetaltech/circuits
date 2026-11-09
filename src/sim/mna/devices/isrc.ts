// Ideal independent current source. nodes [a, b]; p.i amps flowing a→b THROUGH the source (leaves a, enters b); scaled by ctx.lambda.
// Optional p.ac = AC magnitude. Voltage across it is free (decided by the circuit), so p = (va − vb)·i.
import type { Device, Element } from '../types';

export const I: Device = {
  kind: 'I', terminals: 2, isLinear: true,
  branches: () => 0, internalNodes: () => 0,
  validate: (el: Element) => (Number.isFinite(el.p.i) ? null : `${el.id}: source value is not a number`),
  stampDC(e, c) { c.i(e.nodes[0], e.nodes[1], e.el.p.i * c.lambda); },
  stampAC(e, c) { const I = e.el.p.ac ?? 0; c.r(e.nodes[0], -I); c.r(e.nodes[1], I); },
  terminalCurrents(e) { return [e.el.p.i, -e.el.p.i]; },
  topo: () => ({ dc: [], ideal: [], forced: [[0, 1]] }),
};
