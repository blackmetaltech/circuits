import { describe, expect, it } from 'vitest';
import { compileNetlist } from '../mna/compile';
import { parseNetlist } from '../mna/netlist';
import { solveOp } from '../mna/op';
import { elementCurrent, elementPower, nodeVoltage } from '../mna/stamp';
import { near } from './util';

// Ideal Zener (textbook piecewise: breakdown at exactly BV, ron 1 mOhm) shunt regulator: 12 V, Rs 300, 6 V Zener, load RL.
const reg = (rl: number | null, model = 'DZ ideal(bv=6)') => {
  const r = compileNetlist(parseNetlist(`V1 in 0 12\nRs in out 300\nD1 0 out DZ\n${rl === null ? '' : `RL out 0 ${rl}`}\n.model ${model}`));
  if (!r.ok) throw new Error(JSON.stringify(r.errors));
  const op = solveOp(r.circuit); expect(op.ok).toBe(true);
  return { iRs: elementCurrent(r.circuit, op.x, 'Rs'), iz: -elementCurrent(r.circuit, op.x, 'D1'), vout: nodeVoltage(op.x, r.circuit.nodeIndex.out), pz: elementPower(r.circuit, op.x, 'D1') };
};
describe('SC-02 [Floyd / Boylestad ch2] 12 V, Rs 300, 6 V Zener', () => {
  it('RL 1k: IRs 20.000 mA, Iz 14.000 mA', () => { const s = reg(1000); near(s.iRs, 20e-3, 1e-2); near(s.iz, 14e-3, 1e-2); near(s.vout, 6, 1e-3); });
  it('RL 333.33 (the minimum load): Iz 2.000 mA', () => { near(reg(333.33).iz, 2e-3, 1e-2); });
  it('RL open: Iz 20.000 mA, Pz 120.00 mW', () => { const s = reg(null); near(s.iz, 20e-3, 1e-2); near(s.pz, 0.12, 1e-2); });
  it('Zener model with real exponentials (BV 6, Ibv 5 mA, Nbv 1) agrees within 2 % on the currents', () => {
    const s = reg(1000, 'DZ zener(bv=6 ibv=5m is=1e-14)'); near(s.iRs, 20e-3, 2e-2); near(s.iz, 14e-3, 2e-2);
  });
});
