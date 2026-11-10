import { describe, expect, it } from 'vitest';
import { solveCards, near } from './util';
import { acMatrix, fdGain } from './ssUtil';

// [Sedra/Smith ex. 5.x] NMOS common-source: 9 V; 200k/100k divider; RD 2k; Vt 1, Kp 1 mA/V^2, lambda 0. DESIGN oracle table SD-03.
const M = '.model N nmos(vt=1 kp=1m lambda=0)';
describe('SD-03 NMOS common-source amplifier', () => {
  const s = solveCards(`V1 vcc 0 9\nR1 vcc g 200k\nR2 g 0 100k\nRD vcc d 2k\nM1 d g 0 N\n${M}`);
  it('DC: ID 2.000 mA, VD 5.000 V', () => { near(s.i('M1'), 2e-3, 1e-3); near(s.v('d'), 5, 1e-3); });
  it('gm 2.000 mS (stampAC) and Av -4.000 (finite difference of the DC solution)', () => {
    const m = acMatrix(s.ckt, s.x, 'M1'), ix = (n: string) => s.ckt.nodeIndex[n] - 1;
    const gm = m.Re[ix('d') * m.dim + ix('g')];
    near(gm, 2e-3, 1e-3); near(-gm * 2e3, -4, 1e-3);
    near(fdGain(`VG g 0 {IN}\nV1 vcc 0 9\nRD vcc d 2k\nM1 d g 0 N\n${M}`, 3, 'd'), -4, 1e-3);
  });
  it('triode and cutoff sanity: gate at 0 V -> cutoff (VD = 9), gate at 9 V -> triode with Rds = 1/(Kp(Vgs-Vt))', () => {
    near(solveCards(`V1 vcc 0 9\nVG g 0 0\nRD vcc d 2k\nM1 d g 0 N\n${M}`).v('d'), 9, 1e-6);
    const t = solveCards(`V1 vcc 0 9\nVG g 0 9\nRD vcc d 2k\nM1 d g 0 N\n${M}`);
    expect(t.v('d')).toBeLessThan(0.6);
    near(t.v('d') / t.i('M1'), 1 / (1e-3 * (9 - 1 - t.v('d') / 2)), 1e-6);
  });
});
