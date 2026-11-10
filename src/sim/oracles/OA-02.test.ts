import { describe, expect, it } from 'vitest';
import { near, solveCards } from './util';
import { dcAmp } from './oaUtil';
describe('OA-02 non-inverting 10k/47k, 0.2 V (ideal macro)', () => {
  it('Vout 1.1400 V', () => {
    near(solveCards(dcAmp('V1 in 0 0.2\nR1 inv 0 10k\nRf out inv 47k\nU1 in inv out vp vn ideal')).v('out'), 1.14, 1e-4);
  });
});
