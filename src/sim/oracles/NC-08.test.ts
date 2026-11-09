import { describe, expect, it } from 'vitest';
import { near, solveCards } from './util';
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
