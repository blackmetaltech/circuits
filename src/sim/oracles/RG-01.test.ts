// Regulator behaviour (DESIGN §3.7 linear regulator, ticket 4-4 "Bench Supply"): LM317 reference design, minimum-load emergence, 7805 regulation,
// dropout, current limit. Thermal-shutdown cycling is in mna/macros.test.ts (uses the device's own lumped thermal state; the §3.9 part model is M1-C2).
import { describe, expect, it } from 'vitest';
import { near, solveCards } from './util';
const LM317 = '.model lm317 reg (vref=1.25 iadj=50u iqout=3.5m ilim=1.5 vdo=2)';
const bench = (r1: string, r2: string, iload: number, vin = 9): string =>
  `Vin in 0 ${vin}\nU1 in adj out lm317\nR1 out adj ${r1}\nR2 adj 0 ${r2}\n${iload > 0 ? `Iload out 0 ${iload}\n` : ''}${LM317}`;
describe('RG-01 [ticket 4-4] LM317 set to 3.3 V from 9 V', () => {
  it('R1 240 / R2 390: Vout = 1.25(1 + R2/R1) + Iadj·R2 = 3.3008 V at 0, 10 and 500 mA', () => {
    for (const il of [0, 0.01, 0.5]) {
      const v = solveCards(bench('240', '390', il)).v('out');
      near(v, 3.3008, 0.01);                                   // spec: 3.30 V ±1 %
      expect(Math.abs(v - 3.3008)).toBeLessThan(il === 0.5 ? 0.02 : 0.0015);   // load regulation: 10 mΩ output resistance, amplified ×2.6 by the divider
    }
  });
  it('the Iadj term matters: without it the large-R2 design misses by ~0.6 %', () => {
    near(1.25 * (1 + 3900 / 2400), 3.28125, 1e-9);
    expect(Math.abs(1.25 * (1 + 390 / 240) - 3.3008) / 3.3008).toBeGreaterThan(0.005);
  });
  it('large resistors 2.4k/3.9k: the injected quiescent current cannot be sunk, so OUT rises at 0 mA (minimum load emerges)', () => {
    const v0 = solveCards(bench('2400', '3900', 0)).v('out');
    expect(v0).toBeGreaterThan(3.3 * 1.05);
    // a load of 5 mA takes the excess away and the output returns to the set value
    near(solveCards(bench('2400', '3900', 0.005)).v('out'), 1.25 * (1 + 3900 / 2400) + 50e-6 * 3900, 0.01);
  });
});
const REG5 = '.model r5 reg (vreg=5 vdo=2 ilim=2.1 iqgnd=5m)';
describe('RG-01 7805 (pass element, 5 mA Iq to GND, dropout 2 V, 2.1 A limit)', () => {
  const reg = (vin: number, load: string): ReturnType<typeof solveCards> => solveCards(`Vin in 0 ${vin}\nU1 in 0 out r5\n${load}\n${REG5}`);
  it('regulates 5.000 V from 9 V at 0 and 0.5 A (can only source: a 0 A load is fine)', () => {
    near(reg(9, 'Rl out 0 1meg').v('out'), 5, 1e-3);
    near(reg(9, 'Rl out 0 10').v('out'), 5, 5e-3);
  });
  it('input current = load + Iq (5 mA)', () => {
    const s = reg(9, 'Rl out 0 10');
    near(-s.i('Vin'), 0.5 + 5e-3, 5e-3);
  });
  it('dropout: from 6 V the output follows Vin − 2 V', () => { near(reg(6, 'Rl out 0 10').v('out'), 4, 0.02); });
  it('current limit: a 1 Ω load at 9 V is limited to 2.1 A', () => { near(reg(9, 'Rl out 0 1').i('Rl'), 2.1, 0.02); });
});
