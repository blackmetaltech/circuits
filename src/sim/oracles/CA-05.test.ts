import { describe, expect, it } from 'vitest';
import { near, solveCards } from './util';
const P = (rl: number) => solveCards(`V1 in 0 20\nR1 in a 2k\nR2 a 0 3k\nI1 0 a 4m\nRL a 0 ${rl}`).p('RL');
describe('CA-05 [Hayt & Kemmerly style, adapted] CA-04 plus a load sweep', () => {
  it('P(1.2k) 58.8 mW, P(1k) 58.314 mW, argmax 1.2k ± 1 %', () => {
    near(P(1200), 58.8e-3, 1e-4); near(P(1000), 58.314e-3, 1e-3);
    let best = 0, arg = 0;
    for (let r = 500; r <= 3000; r += 1) { const p = P(r); if (p > best) { best = p; arg = r; } }
    expect(Math.abs(arg - 1200) / 1200).toBeLessThanOrEqual(0.01);
  });
});
