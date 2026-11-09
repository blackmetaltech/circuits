import { describe, it } from 'vitest';
import { near, solveCards } from './util';
describe('NC-06 [NCERT XII ch3 style] unbalanced bridge (cross-checked)', () => {
  it('node voltages and currents', () => {
    const s = solveCards('V1 t 0 10\nR1 t A 10\nR2 A 0 20\nR3 t B 10\nR4 B 0 10\nRg A B 10');
    near(s.v('A'), 6.1538); near(s.v('B'), 5.3846); near(s.i('Rg'), 0.076923); near(-s.i('V1'), 0.84615);
  });
});
