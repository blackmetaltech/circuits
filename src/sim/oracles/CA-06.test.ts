import { describe, it } from 'vitest';
import { near, solveCards } from './util';
const net = (v1: number, v2: number) => solveCards(`V1 a 0 ${v1}\nR1 a x 1k\nV2 b 0 ${v2}\nR2 b x 2k\nR3 x 0 3k`).v('x');
describe('CA-06 [Hayt & Kemmerly style, adapted] superposition', () => {
  it('V(x) 6.8182 = 5.4545 + 1.3636', () => {
    near(net(10, 5), 6.8182, 1e-4); near(net(10, 0), 5.4545, 1e-4); near(net(0, 5), 1.3636, 1e-4);
  });
});
