import { describe, it } from 'vitest';
import { near, solveCards } from './util';
describe('CA-01 [Hayt & Kemmerly style, adapted] two-node circuit with a current source', () => {
  it('V(n1) 8.8 V, V(n2) 6.6 V', () => {
    const s = solveCards('V1 in 0 12\nR1 in n1 2k\nR2 n1 0 2k\nR3 n1 n2 1k\nR4 n2 0 3k\nI1 0 n1 5m');
    near(s.v('n1'), 8.8); near(s.v('n2'), 6.6);
  });
});
