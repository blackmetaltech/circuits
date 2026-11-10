import { describe, expect, it } from 'vitest';
import { solveCards, near } from './util';
import { acMatrix, fdGain } from './ssUtil';

// [Sedra/Smith ch6 / Neamen] fixed-bias CE stage: VCC 12, RB 565k, RC 3k, beta 100. DESIGN oracle table SC-04.
const deck = (model: string) => `V1 vcc 0 12\nRB vcc b 565k\nRC vcc c 3k\nQ1 c b 0 Qm\n.model Qm ${model}`;
const gm = (s: ReturnType<typeof solveCards>) => { const m = acMatrix(s.ckt, s.x, 'Q1'); return m.Re[(s.ckt.nodeIndex.c - 1) * m.dim + (s.ckt.nodeIndex.b - 1)]; };
describe('SC-04 CE amplifier, beta 100', () => {
  it('textbook (fixed 0.7 V): IB 20.000 uA, IC 2.000 mA, VCE 6.000 V, Av = -gm*RC = -232.1', () => {
    const s = solveCards(deck('npn(bf=100 ideal=1)'));
    near(s.v('b'), 0.7, 1e-3); near(s.i('Q1'), 2e-3, 5e-3);
    near((12 - s.v('b')) / 565e3, 20e-6, 5e-3); near(s.v('c'), 6, 5e-3);
    near(-gm(s) * 3e3, -232.1, 0.02);
  });
  it('Ebers-Moll (Is 1e-14): VBE 0.67277, IB 20.048 uA, IC 2.0048 mA, VCE 5.9855 V, Av -232.67 (finite difference AND stampAC gm)', () => {
    const s = solveCards(deck('npn(is=1e-14 bf=100)'));
    near(s.v('b'), 0.67277, 5e-3); near((12 - s.v('b')) / 565e3, 20.048e-6, 5e-3);
    near(s.i('Q1'), 2.0048e-3, 5e-3); near(s.v('c'), 5.9855, 5e-3);
    near(-gm(s) * 3e3, -232.67, 0.02);
    const fd = fdGain(`VB b 0 {IN}\nV1 vcc 0 12\nRC vcc c 3k\nQ1 c b 0 Qm\n.model Qm npn(is=1e-14 bf=100)`, s.v('b'), 'c');
    near(fd, -232.67, 0.02);
  });
  it('beta 300 saturates the textbook transistor (fixed bias is fragile)', () => {
    const s = solveCards(deck('npn(bf=300 ideal=1)'));
    expect(s.v('c')).toBeLessThan(0.3); expect(s.i('Q1')).toBeLessThan(300 * 20e-6);
  });
});
