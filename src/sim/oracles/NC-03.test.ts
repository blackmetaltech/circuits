import { describe, expect, it } from 'vitest';
import { near, solveCards } from './util';
const P = (rl: number) => solveCards(`V1 a 0 10\nR1 a b 5\nRL b 0 ${rl}`);
describe('NC-03 [NCERT XII ch3 style] maximum power transfer, E 10 V, r 5 Ω', () => {
  it('powers and efficiency', () => {
    near(P(5).p('RL'), 5); near(P(2).p('RL'), 4.0816, 1e-4); near(P(10).p('RL'), 4.4444, 1e-4);
    const s = P(5); near(s.p('RL') / -s.p('V1'), 0.5);
  });
  it('sweep argmax at RL = r ± 1 %', () => {
    let best = 0, arg = 0;
    for (let rl = 1; rl <= 20; rl += 0.01) { const p = P(rl).p('RL'); if (p > best) { best = p; arg = rl; } }
    expect(Math.abs(arg - 5) / 5).toBeLessThanOrEqual(0.01);
  });
});
