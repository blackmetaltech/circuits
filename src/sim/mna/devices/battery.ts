// Battery / cell: EMF in series with an internal resistance, as ONE branch row (no internal node): va − vb − r·i = E.
// nodes [+, −]; p.emf volts (scaled by ctx.lambda), p.r Ω ≥ 0 (0 = ideal, textbook bins only). i = current into the + terminal
// (negative while discharging). A battery with r > 0 shorted on itself is legal: i = −E/r, a lot of heat (rating check, later).
import type { Device, Element } from '../types';
import { branchCurrents, stampVBranch } from './vsrc';

export const BAT: Device = {
  kind: 'BAT', terminals: 2, isLinear: true,
  branches: () => 1, internalNodes: () => 0,
  validate: (el: Element) => (Number.isFinite(el.p.emf) && el.p.r >= 0 && Number.isFinite(el.p.r) ? null : `${el.id}: battery needs emf and r ≥ 0`),
  stampDC(e, c) { stampVBranch(e, c, e.el.p.emf * c.lambda, e.el.p.r); },
  stampAC(e, c) { const [a, b] = e.nodes, k = e.branch[0]; c.m(a, k, 1); c.m(b, k, -1); c.m(k, a, 1); c.m(k, b, -1); c.m(k, k, -e.el.p.r); },
  terminalCurrents: branchCurrents,
  topo: (el) => ({ dc: [[0, 1]], ideal: el.p.r === 0 ? [[0, 1]] : [], forced: [], source: [0, 1] }),
};
