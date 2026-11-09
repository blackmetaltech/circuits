// Ammeter (DMM current range / ideal textbook ammeter): a series branch va − vb − rb·i = 0. nodes [in, out]; p.r = burden Ω ≥ 0
// (DMM 0.1 Ω; 0 = ideal, which counts as a zero-impedance branch for the loop check). Reading = current in → out = i.
// Voltmeters and scope probes are plain 10 MΩ resistors (kind 'R', see netlist.ts expanders): no device needed.
import type { Device, Element } from '../types';
import { branchCurrents, stampVBranch } from './vsrc';

export const AM: Device = {
  kind: 'AM', terminals: 2, isLinear: true,
  branches: () => 1, internalNodes: () => 0,
  validate: (el: Element) => ((el.p.r ?? 0) >= 0 && Number.isFinite(el.p.r ?? 0) ? null : `${el.id}: burden must be ≥ 0`),
  stampDC(e, c) { stampVBranch(e, c, 0, e.el.p.r ?? 0); },
  stampAC(e, c) { const [a, b] = e.nodes, k = e.branch[0]; c.m(a, k, 1); c.m(b, k, -1); c.m(k, a, 1); c.m(k, b, -1); c.m(k, k, -(e.el.p.r ?? 0)); },
  terminalCurrents: branchCurrents,
  topo: (el) => ({ dc: [[0, 1]], ideal: (el.p.r ?? 0) === 0 ? [[0, 1]] : [], forced: [] }),
};
