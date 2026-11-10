import { describe, expect, it } from 'vitest';
import { near, solveCards } from './util';
import { dcAmp } from './oaUtil';
describe('OA-01 inverting amplifier 1k/10k, 0.5 V in (ideal macro)', () => {
  it('Vout −5.000 V', () => {
    near(solveCards(dcAmp('V1 in 0 0.5\nR1 in inv 1k\nRf inv out 10k\nU1 0 inv out vp vn ideal')).v('out'), -5, 1e-4);
  });
});
