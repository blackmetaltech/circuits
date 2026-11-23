// NTC thermistor whose temperature follows a time program (chapter 6, ticket 6-5: the incubator's probe warmed 40 -> 60 -> 40 C during one bench run).
// nodes [a, b]; p.r25 (ohm at 25 C), p.b (K), p.t0 (K, default 298.15); `el.wave` is the probe temperature in C over time (a PWL that the stepper lands on, point by point).
// R(t) = ntcResistance(r25, b, T(t)), no self-heating (as the static NTC). Not linear: the matrix depends on time, so the factor cache is never reused.
// State [r]: the resistance of the last stamp (that of the accepted step), read by terminalCurrents. The rig builds it from a fixed NTC part and the bench plan's `heat` (rig.ts).
import type { Device, Element } from '../types';
import { waveValue } from '../waveforms';
import { ntcResistance } from './ntc';

const rAt = (el: Element, t: number): number => ntcResistance(el.p.r25, el.p.b, el.wave ? waveValue(el.wave, t) : (el.p.tc ?? 25), el.p.t0 ?? 298.15);

export const NTCT: Device = {
  kind: 'NTCT', terminals: 2, isLinear: false,
  branches: () => 0, internalNodes: () => 0, stateSize: () => 1,
  validate: (el: Element) => (el.p.r25 > 0 && el.p.b > 0 && Number.isFinite(el.p.r25) && Number.isFinite(el.p.b) ? null : `${el.id}: thermistor needs positive r25 and b`),
  stampDC(e, c) { const r = rAt(e.el, c.time); if (c.state.length > e.so) c.state[e.so] = r; c.g(e.nodes[0], e.nodes[1], 1 / r); },
  stampTran(e, c) { const r = rAt(e.el, c.time); if (c.state.length > e.so) c.state[e.so] = r; c.g(e.nodes[0], e.nodes[1], 1 / r); },
  stampAC(e, c) { c.y(e.nodes[0], e.nodes[1], 1 / rAt(e.el, 0)); },
  terminalCurrents(e, x, state) {
    const v0 = e.nodes[0] < 0 ? 0 : x[e.nodes[0]], v1 = e.nodes[1] < 0 ? 0 : x[e.nodes[1]];
    const r = state[e.so] || rAt(e.el, 0), i = (v0 - v1) / r;
    return [i, -i];
  },
  topo: () => ({ dc: [[0, 1]], ideal: [], forced: [] }),
};
