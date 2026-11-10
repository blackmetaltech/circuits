import { describe, expect, it } from 'vitest';
import { near, solveCards } from './util';
// Slide-wire variants: the same circuits with the wire from the catalogue SLIDEWIRE part through its netlist expander (Rtotal 10 Ω, jockey pos from end A).
import { EXPANDERS } from '../mna/netlist';
import { compileNetlist } from '../mna/compile';
import { solveOp } from '../mna/op';
import { elementCurrent, nodeVoltage } from '../mna/stamp';
import { parseNetlist } from '../mna/netlist';
import { slidewire } from '../../data/parts/misc';
import type { PlacedPart } from '../board/types';
const swSolve = (rest: string, pos: number) => {
  const nl = parseNetlist(rest), id = (n: string): number => (n === '0' ? 0 : nl.nodeNames.indexOf(n.toLowerCase()));
  const part = { uid: 'w', partId: 'slidewire', value: null, variant: '100cm', x: 0, y: 0, rot: 0, flip: false, pos } as PlacedPart;
  nl.elements.push(...EXPANDERS.SLIDEWIRE!({ part, def: slidewire, nodes: [id('A'), id('J'), 0] }));
  const c = compileNetlist(nl);
  if (!c.ok) throw new Error(JSON.stringify(c.errors));
  const op = solveOp(c.circuit);
  if (!op.ok) throw new Error('OP failed');
  return { v: (n: string): number => nodeVoltage(op.x, c.circuit.nodeIndex[n.toLowerCase()]), i: (e: string): number => elementCurrent(c.circuit, op.x, e) };
};

// Slide wire as two resistors rho*l and rho*(L-l) at the jockey J; galvanometer 100 ohm J -> K (current J->K positive).
const bridge = (S: number, galv = true) => solveCards(`V1 A 0 6\nRw1 A J 4\nRw2 J 0 6\nR A K 5\nRs K 0 ${S}\n${galv ? 'Rg J K 100' : ''}`);
describe('NC-07 [NCERT XII ch3 style] metre bridge, jockey at 40 cm, R 5, S 7.5, 6 V', () => {
  it('balanced: no current, V(J) = V(K) = 3.6 V', () => {
    const s = bridge(7.5);
    expect(Math.abs(s.i('Rg'))).toBeLessThan(1e-9); near(s.v('J'), 3.6); near(s.v('K'), 3.6);
  });
  it('S = 8.5: unloaded V(K) 3.778 V, Ig flows K to J', () => {
    near(bridge(8.5, false).v('K'), 3.778, 1e-3);
    const ig = bridge(8.5).i('Rg');
    expect(ig).toBeLessThan(0);
    near(ig, -(6 * 8.5 / 13.5 - 3.6) / (100 + 2.4 + 5 * 8.5 / 13.5), 1e-6);   // Thevenin hand calculation
  });
});
describe('NC-07 slide-wire variant (SLIDEWIRE part, jockey at pos 0.4)', () => {
  const rest = (S: number): string => `V1 A 0 6\nR A K 5\nRs K 0 ${S}\nRg J K 100`;
  it('balanced: |Ig| < 1 nA, V(J) = V(K) = 3.600 V', () => {
    const s = swSolve(rest(7.5), 0.4);
    expect(Math.abs(s.i('Rg'))).toBeLessThan(1e-9); near(s.v('J'), 3.6); near(s.v('K'), 3.6);
  });
  it('S = 8.5: Ig flows K to J with the Thevenin magnitude', () => {
    const ig = swSolve(rest(8.5), 0.4).i('Rg');
    expect(ig).toBeLessThan(0);
    near(ig, -(6 * 8.5 / 13.5 - 3.6) / (100 + 2.4 + 5 * 8.5 / 13.5), 1e-6);
  });
});
