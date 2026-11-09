import { describe, it } from 'vitest';
import { near, solveCards } from './util';
const base = (tail: string, v = 20, i = '4m') => `V1 in 0 ${v}\nR1 in a 2k\nR2 a 0 3k\nI1 0 a ${i}\n${tail}`;
describe('CA-04 [Hayt & Kemmerly style, adapted] Norton equivalent', () => {
  it('Isc 14 mA, Rn 1.2 kΩ, Voc 16.8 V', () => {
    near(-solveCards(base('Vs a 0 0')).i('Vs') * -1, 14e-3, 1e-4);
    const voc = solveCards(base('')).v('a'); near(voc, 16.8);
    const t = solveCards(base('It 0 a 1m', 0, '0')); near(t.v('a') / 1e-3, 1200, 1e-4);
  });
});
