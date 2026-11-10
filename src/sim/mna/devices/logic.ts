// Logic pin / PWM driver output (DESIGN §3.7). Kind 'LOGIC'. Terminals [pin, ref]; p.v volts (or a waveform on the element, like a V source) behind
// Ro (25 Ω): a Thevenin source stamped as its Norton equivalent (no branch unknown). i = current into the pin from the circuit = (v_pin − v_ref − v)/Ro.
// Abs-max current is a rating check (sim/ratings, M1-C2), read from terminalCurrents. The floating-gate PWM driver is a v0.1 simplification, flagged.
import type { Device, Element } from '../types';
import { sourceValue } from '../waveforms';

const vOf = (x: ArrayLike<number>, k: number): number => (k < 0 ? 0 : x[k]);
export const LOGIC: Device = {
  kind: 'LOGIC', terminals: 2, isLinear: true,
  branches: () => 0, internalNodes: () => 0,
  validate: (el: Element) => (Number.isFinite(el.p.v) && el.p.ro > 0 ? null : `${el.id}: logic pin needs a voltage and Ro > 0`),
  stampDC(e, c) { const g = 1 / e.el.p.ro; c.g(e.nodes[0], e.nodes[1], g); c.i(e.nodes[1], e.nodes[0], g * sourceValue(e.el, 'v', c.time) * c.lambda); },
  stampAC(e, c) { c.y(e.nodes[0], e.nodes[1], 1 / e.el.p.ro); },
  terminalCurrents(e, x) {
    // uses the DC value p.v (a waveform's instantaneous value is not available here)
    const i = (vOf(x, e.nodes[0]) - vOf(x, e.nodes[1]) - e.el.p.v) / e.el.p.ro;
    return [i, -i];
  },
  topo: () => ({ dc: [[0, 1]], ideal: [], forced: [], source: [0, 1] }),
};
