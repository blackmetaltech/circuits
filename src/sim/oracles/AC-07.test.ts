import { describe, it, expect } from 'vitest';
import { near } from './util';
import { acCards, mag } from './acUtil';

// DESIGN §9.1 AC-07. Source magnitudes are RMS phasors (the AC solve is linear), so every result is an rms value.
const deck = (xf: string): string => `V1 in 0 0 ac 220\nR1 s 0 4.4\n${xf}`;

describe('AC-07 220 V rms; ideal transformer 10:1; 4.4 Ω', () => {
  it('ideal primitive: Vs 22.000 V; Is 5.0000 A; Ip 0.50000 A; P 110.00 W (0.1 %)', () => {
    const sol = acCards(deck('T1 in 0 s 0 10')).solve(50);
    const vs = mag(sol.v('s')), is = vs / 4.4, ip = mag(sol.i('T1'));
    near(vs, 22, 1e-3); near(is, 5, 1e-3); near(ip, 0.5, 1e-3); near(vs * is, 110, 1e-3);
    near(220 * ip, 110, 1e-3); // primary power = secondary power (lossless)
  });
  it('coupled-L variant, Lm 1000 H at 50 Hz (1 %)', () => {
    const sol = acCards(deck('T1 in 0 s 0 10 lm=1000')).solve(50);
    const vs = mag(sol.v('s')), is = vs / 4.4, ip = mag(sol.i('T1'));
    near(vs, 22, 1e-2); near(is, 5, 1e-2); near(ip, 0.5, 1e-2); near(vs * is, 110, 1e-2);
    expect(ip).toBeGreaterThan(0.5); // magnetising current only adds
  });
});
