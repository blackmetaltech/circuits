// Bench supply, constant-voltage mode. nodes [+, −]; p.v volts (the set voltage), p.ilim A (current limit, UNUSED until the CC
// task: DESIGN §3.7 "regulates the set voltage until the current reaches the limit, then holds the current (smooth min)").
// For now it behaves as an ideal source, so a shorted bench is reported as an ideal-source short (the CC task relaxes it).
import type { Device, Element } from '../types';
import { branchCurrents, stampVBranch } from './vsrc';

export const BENCH: Device = {
  kind: 'BENCH', terminals: 2, isLinear: true,
  branches: () => 1, internalNodes: () => 0,
  validate: (el: Element) => (Number.isFinite(el.p.v) ? null : `${el.id}: set voltage is not a number`),
  stampDC(e, c) { stampVBranch(e, c, e.el.p.v * c.lambda, 0); },
  stampAC(e, c) { const [a, b] = e.nodes, k = e.branch[0]; c.m(a, k, 1); c.m(b, k, -1); c.m(k, a, 1); c.m(k, b, -1); },
  terminalCurrents: branchCurrents,
  topo: () => ({ dc: [[0, 1]], ideal: [[0, 1]], forced: [], source: [0, 1] }),
};
