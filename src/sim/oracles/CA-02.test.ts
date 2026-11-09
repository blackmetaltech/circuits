import { describe, it } from 'vitest';
import { near, solveCards } from './util';
describe('CA-02 [Hayt & Kemmerly style, adapted] circuit with a VCVS', () => {
  it('V(n2) 6, V(n3) 3, I(R3) 1.5 mA', () => {
    const s = solveCards('V1 in 0 12\nR1 in n2 2k\nR2 n2 0 4k\nE1 n3 0 n2 0 0.5\nR3 n2 n3 2k');
    near(s.v('n2'), 6); near(s.v('n3'), 3); near(s.i('R3'), 1.5e-3);
  });
});
