import { describe, it } from 'vitest';
import { near, solveCards } from './util';
describe('NC-09 [NCERT XII ch3 style] cube of 12 x 6 ohm, opposite corners (cross-checked)', () => {
  it('Req 5 Ω, I 2 A', () => {
    const name = (k: number) => (k === 7 ? '0' : 'n' + k);
    let cards = 'V1 n0 0 10\n', id = 1;
    for (let a = 0; a < 8; a++) for (const bit of [1, 2, 4]) { const b = a ^ bit; if (a < b) cards += `R${id++} ${name(a)} ${name(b)} 6\n`; }
    const s = solveCards(cards);
    near(-s.i('V1'), 2); near(10 / -s.i('V1'), 5);
  });
});
