// Constant-current LOAD (the customer's equipment, chapter 4). Kind 'CCL'. nodes [a, b]; p.i amps (a waveform on the element may scale it in time, e.g. its switch-on ramp) flow a -> b through the load, but only while a has
// voltage above b: i(v) = I0 x clamp(v / VK, 0, 1) with VK = 1 V (smooth corners), so it is exactly I0 above about 1 V, a resistor of VK / I0 below that (a real gadget stops drawing when its supply collapses) and nothing at 0 V. An ideal current
// sink would pull the node to minus infinity the moment a regulator shuts down, and a flat sink gives Newton nothing to hold on to. Nonlinear: companion conductance g = di/dv and a source i - g v, re-stamped every Newton iteration (like a diode).
import type { Device, Element } from '../types';
import { sourceValue } from '../waveforms';
import { sclamp } from './smooth';

const VK = 1, GLEAK = 1e-6;   // GLEAK: the equipment's own leakage (1 Mohm): it keeps a node that nothing drives at about 0 V
const vOf = (x: ArrayLike<number>, k: number): number => (k < 0 ? 0 : x[k]);
function law(i0: number, v: number): { i: number; g: number } {
  const c = sclamp(v / VK, 0, 1, 0.03);
  return { i: i0 * c.y + GLEAK * v, g: (i0 * c.dx) / VK + GLEAK };
}

export const CCL: Device = {
  kind: 'CCL', terminals: 2, isLinear: false,
  branches: () => 0, internalNodes: () => 0,
  validate: (el: Element) => (Number.isFinite(el.p.i) && el.p.i >= 0 ? null : `${el.id}: load current must be >= 0`),
  stateSize: (el: Element) => (el.wave ? 1 : 0),
  stampDC(e, c) {
    const i0 = sourceValue(e.el, 'i', c.time) * c.lambda;
    if (e.el.wave) c.state[e.so] = i0;
    const v = c.v(e.nodes[0]) - c.v(e.nodes[1]), q = law(i0, v);
    c.g(e.nodes[0], e.nodes[1], q.g);
    c.i(e.nodes[0], e.nodes[1], q.i - q.g * v);
  },
  stampAC() { /* small-signal: the load is open (its slope is ignored) */ },
  terminalCurrents(e, x, state) {
    const i0 = e.el.wave ? (state[e.so] ?? e.el.p.i) : e.el.p.i, q = law(i0, vOf(x, e.nodes[0]) - vOf(x, e.nodes[1]));
    return [q.i, -q.i];
  },
  topo: () => ({ dc: [], ideal: [], forced: [] }),
};
