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

// Driver 4 V + rheostat 10 ohm + wire 10 ohm / 100 cm. Wire low end at ground; jockey at l cm: Rlow = 0.1 l, Rhigh = 10 - 0.1 l.
const wire = (l: number, extra = '') => solveCards(`V1 d 0 4\nRh d A 10\nRw1 A J ${(10 - 0.1 * l).toFixed(6)}\nRw2 J 0 ${(0.1 * l).toFixed(6)}\n${extra}`);
describe('NC-08 [NCERT XII ch3 style] potentiometer', () => {
  it('potential gradient 0.02 V/cm', () => { near(wire(50).v('J'), 1.0); near(wire(75).v('J'), 1.5); });
  it('(b) test cell E 1.5 V, r 0.5 Ω shunted by 4.5 Ω: 1.35 V, null at 67.5 cm, r = 0.5 Ω', () => {
    const cell = 'Vc e 0 1.5\nrc e out 0.5\nRsh out 0 4.5\n';
    near(solveCards(cell).v('out'), 1.35, 1e-4);
    const s = wire(67.5, cell + 'Rgal out J 100');
    expect(Math.abs(s.i('Rgal'))).toBeLessThan(1e-9);
    near(s.v('J'), 1.35, 1e-4);
    const r = 4.5 * (1.5 / s.v('out') - 1);
    near(r, 0.5, 1e-3);
  });
});
describe('NC-08 slide-wire variant (SLIDEWIRE part as the potentiometer wire)', () => {
  const rest = (extra = ''): string => `V1 d 0 4\nRh d A 10\n${extra}`;
  it('gradient 0.02 V/cm: pos 0.5 → 1.000 V, pos 0.25 → 1.500 V', () => { near(swSolve(rest('Rj J 0 1e12'), 0.5).v('J'), 1.0); near(swSolve(rest('Rj J 0 1e12'), 0.25).v('J'), 1.5); });
  it('(b) cell 1.5 V, r 0.5 Ω shunted by 4.5 Ω: null at 67.5 cm (pos 0.325), r = 0.5000 Ω', () => {
    const s = swSolve(rest('Vc e 0 1.5\nrc e out 0.5\nRsh out 0 4.5\nRgal out J 100'), 0.325);
    expect(Math.abs(s.i('Rgal'))).toBeLessThan(1e-9);
    near(s.v('J'), 1.35, 1e-4);
    near(4.5 * (1.5 / s.v('out') - 1), 0.5, 1e-3);
  });
});
