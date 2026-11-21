// Time-controlled switch (a bench-driven contact, chapter 3: the arcade button of ticket 3-2 and its bounce, the charge-sharing switch of 3-4).
// nodes [a, b]; p.ron (closed, ohm), p.roff (open, ohm); `el.wave` is a PWL "closedness" in 0..1 (>= 0.5 = closed). Not linear: the matrix depends on time,
// so the factor cache must never be reused. The transient stepper lands on every PWL point (waveBreakpoints), so a state change is always at a step edge.
// State [closed]: written by the stamp (the last stamp of an accepted step is that step's), read by terminalCurrents and the live frame ("the contact is closed").
import type { Device, Element } from '../types';
import { waveValue } from '../waveforms';

const isClosed = (el: Element, t: number): boolean => (el.wave ? waveValue(el.wave, t) >= 0.5 : (el.p.closed ?? 0) >= 0.5);

export const SWT: Device = {
  kind: 'SWT', terminals: 2, isLinear: false,
  branches: () => 0, internalNodes: () => 0, stateSize: () => 1,
  validate: (el: Element) => (el.p.ron > 0 && el.p.roff > 0 && Number.isFinite(el.p.ron) && Number.isFinite(el.p.roff) ? null : `${el.id}: switch resistances must be positive numbers`),
  stampDC(e, c) { const cl = isClosed(e.el, c.time); if (c.state.length > e.so) c.state[e.so] = cl ? 1 : 0; c.g(e.nodes[0], e.nodes[1], 1 / (cl ? e.el.p.ron : e.el.p.roff)); },
  stampTran(e, c) { const cl = isClosed(e.el, c.time); if (c.state.length > e.so) c.state[e.so] = cl ? 1 : 0; c.g(e.nodes[0], e.nodes[1], 1 / (cl ? e.el.p.ron : e.el.p.roff)); },
  stampAC(e, c) { c.y(e.nodes[0], e.nodes[1], 1 / (isClosed(e.el, 0) ? e.el.p.ron : e.el.p.roff)); },
  terminalCurrents(e, x, state) {
    const v0 = e.nodes[0] < 0 ? 0 : x[e.nodes[0]], v1 = e.nodes[1] < 0 ? 0 : x[e.nodes[1]];
    const i = (v0 - v1) / ((state[e.so] ?? 0) >= 0.5 ? e.el.p.ron : e.el.p.roff);
    return [i, -i];
  },
  topo: () => ({ dc: [[0, 1]], ideal: [], forced: [] }),
};
