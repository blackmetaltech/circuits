import { describe, it } from 'vitest';
import { near, solveCards } from './util';
describe('NC-10 [NCERT XII ch3 style, director-corrected] 4-section ladder terminated in phi', () => {
  it('Req = phi, I = 6.18034 A', () => {
    let cards = 'V1 n0 0 10\n';
    for (let k = 1; k <= 4; k++) cards += `Rs${k} n${k - 1} n${k} 1\nRp${k} n${k} 0 1\n`;
    cards += 'Rphi n4 0 1.6180339887\n';
    const s = solveCards(cards);
    near(10 / -s.i('V1'), 1.618034, 1e-6); near(-s.i('V1'), 6.18034, 1e-6);
  });
});
