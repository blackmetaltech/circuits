import { describe, expect, it } from 'vitest';
import { solveCards, near } from './util';
import { acMatrix, fdGain } from './ssUtil';

// [Sedra/Smith ex. 6.x] voltage-divider bias: 12 V; 47k/10k; RC 2.2k; RE 1k; NPN Is 1e-14, beta 100. DESIGN oracle table SD-02.
const M = '.model Qm npn(is=1e-14 bf=100)';
describe('SD-02 divider-biased CE amplifier', () => {
  const s = solveCards(`V1 vcc 0 12\nR1 vcc b 47k\nR2 b 0 10k\nRC vcc c 2.2k\nRE e 0 1k\nQ1 c b e Qm\n${M}`);
  it('DC: VBE 0.66194, IC 1.3212 mA, VCE 7.7590 V', () => {
    near(s.v('b') - s.v('e'), 0.66194, 5e-3); near(s.i('Q1'), 1.3212e-3, 5e-3); near(s.v('c') - s.v('e'), 7.759, 5e-3);
  });
  it('gain vb -> vc with RE bypassed, no ro: -gm*RC = -112.44 (finite difference of the DC solution; and the stampAC gm)', () => {
    const vb = s.v('b'), ve = s.v('e');
    const fd = fdGain(`VB b 0 {IN}\nVE e 0 ${ve}\nV1 vcc 0 12\nRC vcc c 2.2k\nQ1 c b e Qm\n${M}`, vb, 'c');
    near(fd, -112.44, 0.02);
    const m = acMatrix(s.ckt, s.x, 'Q1'), ix = (n: string) => s.ckt.nodeIndex[n] - 1;
    near(-m.Re[ix('c') * m.dim + ix('b')] * 2.2e3, -112.44, 0.02);
  });
  it('beta sweep 100..300 keeps IC within 15 % (bias stability)', () => {
    for (const bf of [100, 300]) {
      const t = solveCards(`V1 vcc 0 12\nR1 vcc b 47k\nR2 b 0 10k\nRC vcc c 2.2k\nRE e 0 1k\nQ1 c b e Qm\n.model Qm npn(is=1e-14 bf=${bf})`);
      expect(Math.abs(t.i('Q1') / 1.3212e-3 - 1)).toBeLessThan(0.15);
    }
  });
});
