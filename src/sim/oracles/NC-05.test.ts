import { describe, expect, it } from 'vitest';
import { near, solveCards } from './util';
describe('NC-05 [NCERT XII ch3 style] balanced Wheatstone bridge', () => {
  it('no galvanometer current', () => {
    const s = solveCards('V1 t 0 9\nR1 t A 10\nR2 A 0 20\nR3 t B 15\nR4 B 0 30\nRg A B 50');
    expect(Math.abs(s.i('Rg'))).toBeLessThan(1e-9); near(s.v('A'), 6); near(s.v('B'), 6); near(-s.i('V1'), 0.5);
  });
});
