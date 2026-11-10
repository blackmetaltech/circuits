// Ideal independent current source. nodes [a, b]; p.i amps flowing a→b THROUGH the source (leaves a, enters b); scaled by ctx.lambda.
// Optional p.ac = AC magnitude. Voltage across it is free (decided by the circuit), so p = (va − vb)·i.
import type { Device, Element } from '../types';
import { sourceValue } from '../waveforms';

export const I: Device = {
  kind: 'I', terminals: 2, isLinear: true,
  branches: () => 0, internalNodes: () => 0,
  validate: (el: Element) => (Number.isFinite(el.p.i) ? null : `${el.id}: source value is not a number`),
  // A waveform source keeps its delivered value (incl. ramp scale) in state[so] so terminalCurrents can report it (no time there).
  stateSize: (el: Element) => (el.wave ? 1 : 0),
  stampDC(e, c) { const i = sourceValue(e.el, 'i', c.time) * c.lambda; if (e.el.wave) c.state[e.so] = i; c.i(e.nodes[0], e.nodes[1], i); },
  stampAC(e, c) { const I = e.el.p.ac ?? 0; c.r(e.nodes[0], -I); c.r(e.nodes[1], I); },
  terminalCurrents(e, _x, state) { const i = e.el.wave ? (state[e.so] ?? e.el.p.i) : e.el.p.i; return [i, -i]; },
  topo: () => ({ dc: [], ideal: [], forced: [[0, 1]] }),
};
