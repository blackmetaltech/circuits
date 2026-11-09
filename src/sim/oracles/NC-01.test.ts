import { describe, it } from 'vitest';
import { near, solveCards } from './util';
describe('NC-01 [NCERT XII ch3 style] series-parallel: I, V(a), P(R1)', () => {
  it('matches the textbook', () => {
    const s = solveCards('V1 in 0 12\nR1 in a 4\nR2 a 0 6\nR3 a 0 12');
    near(-s.i('V1'), 1.5); near(s.v('a'), 6); near(s.p('R1'), 9);
  });
});
