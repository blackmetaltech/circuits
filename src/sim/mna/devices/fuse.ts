// Fuse (DESIGN §3.7). Kind 'FUSE'. Terminals [a, b]; state [acc, blown]. A resistor R_cold until it blows, then Roff (1e9 Ω).
// I²t accumulator over a window τ = 50 ms: acc ← acc·e^(−h/τ) + i²·h (a leaky integral of i², steady value ≈ i²·τ). EVENT: the fuse blows when
// acc exceeds the rated I²t = Irated²·τ (g = rated − acc ≤ 0), i.e. a steady current above Irated eventually blows it, 10× Irated in ≈ 0.5 ms.
// ("fuse blown" FX is read from state[so + 1] by the game layer.) `p.irated` and `p.window` come from the catalogue variant / model.
import { dmath } from '@core/numerics';
import type { CElem, Device, Element } from '../types';

const vOf = (x: ArrayLike<number>, k: number): number => (k < 0 ? 0 : x[k]);
const gOf = (e: CElem, state: number[]): number => 1 / ((state[e.so + 1] ?? 0) >= 0.5 ? e.el.p.roff : e.el.p.r);
const accAfter = (e: CElem, x: ArrayLike<number>, state: number[], h: number): number => {
  const i = gOf(e, state) * (vOf(x, e.nodes[0]) - vOf(x, e.nodes[1])), d = h <= 0 ? 1 : dmath.exp(-h / e.el.p.window);
  return (state[e.so] ?? 0) * d + i * i * h;
};

export const FUSE: Device = {
  kind: 'FUSE', terminals: 2, isLinear: false,
  branches: () => 0, internalNodes: () => 0, stateSize: () => 2,
  validate(el: Element) { const p = el.p; return p.r > 0 && p.irated > 0 && p.window > 0 && p.roff > 0 ? null : `${el.id}: fuse parameters are not usable`; },
  stampDC(e, c) { c.g(e.nodes[0], e.nodes[1], gOf(e, c.state)); },
  stampAC(e, c) { c.y(e.nodes[0], e.nodes[1], gOf(e, new Array(e.so + 2).fill(0))); },
  update(e, x, state, _m, h) { if (state[e.so + 1] < 0.5) state[e.so] = accAfter(e, x, state, h); },
  eventValue(e, x, state, h) { return state[e.so + 1] >= 0.5 ? 1 : e.el.p.irated * e.el.p.irated * e.el.p.window - accAfter(e, x, state, h); },
  fire(e, _x, state) { state[e.so + 1] = 1; },
  terminalCurrents(e, x, state) { const i = gOf(e, state) * (vOf(x, e.nodes[0]) - vOf(x, e.nodes[1])); return [i, -i]; },
  topo: () => ({ dc: [[0, 1]], ideal: [], forced: [] }),
};
