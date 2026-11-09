import { describe, it } from 'vitest';
import { near, solveCards } from './util';
describe('NC-02 [NCERT XII ch3 style] three 1.5 V / 0.5 Ω cells into 2 Ω: series and parallel', () => {
  it('(a) series', () => {
    const s = solveCards('V1 a 0 1.5\nR1 a b 0.5\nV2 c b 1.5\nR2 c d 0.5\nV3 e d 1.5\nR3 e f 0.5\nRL f 0 2');
    near(Math.abs(s.i('RL')), 1.2857, 1e-3); near(Math.abs(s.v('f')), 2.5714, 1e-3);
  });
  it('(b) parallel', () => {
    const s = solveCards('V1 a1 0 1.5\nR1 a1 n 0.5\nV2 a2 0 1.5\nR2 a2 n 0.5\nV3 a3 0 1.5\nR3 a3 n 0.5\nRL n 0 2');
    near(s.i('RL'), 0.69231, 1e-3); near(s.v('n'), 1.3846, 1e-3);
  });
});
