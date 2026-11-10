import { describe, expect, it } from 'vitest';
import { near, solveCards } from './util';
import { dcAmp } from './oaUtil';
describe('OA-03 summing amplifier 1 V/10k, 2 V/5k, −0.5 V/20k, Rf 10k (ideal macro)', () => {
  it('Vout −4.750 V', () => {
    near(solveCards(dcAmp('V1 a 0 1\nV2 b 0 2\nV3 c 0 -0.5\nRa a inv 10k\nRb b inv 5k\nRc c inv 20k\nRf out inv 10k\nU1 0 inv out vp vn ideal')).v('out'), -4.75, 1e-4);
  });
});
