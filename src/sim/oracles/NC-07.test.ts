import { describe, expect, it } from 'vitest';
import { near, solveCards } from './util';
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
