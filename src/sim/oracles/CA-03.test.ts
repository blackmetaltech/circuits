import { describe, it } from 'vitest';
import { near, solveCards } from './util';
const br = (tail: string, v = 10) => `V1 t 0 ${v}\nR1 t a 1k\nR2 a 0 2k\nR3 t b 3k\nR4 b 0 4k\n${tail}`;
describe('CA-03 [Hayt & Kemmerly style, adapted] bridge Thevenin / load current', () => {
  it('Vth 0.95238 V, Rth 2.3810 kΩ by 1 mA injection, I(5k) 0.12903 mA', () => {
    const s = solveCards(br(''));
    near(s.v('a') - s.v('b'), 0.95238, 1e-4);
    const t = solveCards(br('I1 b a 1m', 0));
    near((t.v('a') - t.v('b')) / 1e-3, 2380.95, 1e-4);
    near(solveCards(br('RL a b 5k')).i('RL'), 0.12903e-3, 1e-3);
  });
});
