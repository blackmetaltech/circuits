// Capacitor. nodes [a, b]; p.c farads (> 0). Optional p.ic = initial voltage va − vb (power-on from zero uses it; default 0).
// State [vₙ, iₙ] = voltage and current (a→b) after the last accepted step (state[so] is the "primary" history variable, like L's current).
// DC: open (the per-node gmin keeps the matrix regular). Transient companion i = Geq·v + Ieq:
//   TRAP Geq = 2C/h, Ieq = −Geq·vₙ − iₙ     BE Geq = C/h, Ieq = −Geq·vₙ        (DESIGN §3.5)
// AC: admittance jωC.
import type { Device, Element } from '../types';

const geq = (C: number, method: 'BE' | 'TRAP', h: number): number => (method === 'TRAP' ? 2 * C / h : C / h);

export const C: Device = {
  kind: 'C', terminals: 2, isLinear: true,
  branches: () => 0, internalNodes: () => 0, stateSize: () => 2,
  validate: (el: Element) => (el.p.c > 0 && Number.isFinite(el.p.c) ? null : `${el.id}: capacitance must be a positive number (got ${el.p.c})`),
  stampDC() { /* open */ },
  stampTran(e, c, method, h) {
    const [a, b] = e.nodes, g = geq(e.el.p.c, method, h), vn = c.state[e.so], i0 = c.state[e.so + 1];
    c.g(a, b, g);
    c.i(a, b, method === 'TRAP' ? -g * vn - i0 : -g * vn);
  },
  update(e, x, state, method, h) {
    const [a, b] = e.nodes, v = (a < 0 ? 0 : x[a]) - (b < 0 ? 0 : x[b]), g = geq(e.el.p.c, method, h);
    state[e.so + 1] = method === 'TRAP' ? g * (v - state[e.so]) - state[e.so + 1] : g * (v - state[e.so]);
    state[e.so] = v;
  },
  initState(e, x, state) { const [a, b] = e.nodes; state[e.so] = (a < 0 ? 0 : x[a]) - (b < 0 ? 0 : x[b]); state[e.so + 1] = 0; },
  stampAC(e, c, omega) { c.y(e.nodes[0], e.nodes[1], 0, omega * e.el.p.c); },
  terminalCurrents(e, _x, state) { const i = state[e.so + 1] ?? 0; return [i, -i]; },
  topo: () => ({ dc: [], ideal: [], forced: [] }),
};
