import { describe, it } from 'vitest';
import { near, solveCards } from './util';
describe('NC-04 [NCERT XII ch3 style, Kirchhoff] two cells on one node', () => {
  it('V(A) and branch currents', () => {
    const s = solveCards('V1 e1 0 10\nR1 e1 A 2\nV2 e2 0 5\nR2 e2 A 3\nR3 A 0 6');
    near(s.v('A'), 6.6667, 1e-4); near(s.i('R1'), 1.6667, 1e-3); near(s.i('R2'), -0.55556, 1e-3); near(s.i('R3'), 1.1111, 1e-3);
  });
});
