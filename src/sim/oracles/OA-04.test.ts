import { describe, expect, it } from 'vitest';
import { near, solveCards } from './util';
import { dcAmp } from './oaUtil';
describe('OA-04 difference amplifier 10k/100k, V1 1.0 V inverting side, V2 1.2 V non-inverting (ideal macro)', () => {
  it('Vout 2.000 V', () => {
    near(solveCards(dcAmp('V1 a 0 1.0\nV2 b 0 1.2\nR1 a inv 10k\nRf out inv 100k\nR2 b ip 10k\nR3 ip 0 100k\nU1 ip inv out vp vn ideal')).v('out'), 2, 1e-4);
  });
});
