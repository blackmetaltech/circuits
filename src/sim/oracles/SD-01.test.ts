import { describe, expect, it } from 'vitest';
import { compileNetlist } from '../mna/compile';
import { parseNetlist } from '../mna/netlist';
import { solveOp } from '../mna/op';
import { elementCurrent, nodeVoltage } from '../mna/stamp';
import { near } from './util';

// [Sedra/Smith ch4 style] Shockley diode in series with 1 kOhm from 5 V: Is 1e-14, N 1, gmin <= 1e-15.
describe('SD-01 [Sedra-Smith ch4] 5 V - 1k - diode (Is 1e-14, N 1)', () => {
  const nl = parseNetlist('V1 a 0 5\nR1 a d 1k\nD1 d 0 Dx\n.model Dx D(is=1e-14 n=1)');
  const r = compileNetlist(nl); if (!r.ok) throw new Error(JSON.stringify(r.errors));
  const op = solveOp(r.circuit, { gmin: 1e-15 });
  it('converges with plain Newton', () => { expect(op).toMatchObject({ ok: true, strategy: 'newton' }); });
  it('Vd 0.69254 V, Id 4.3075 mA (0.1 %)', () => {
    near(nodeVoltage(op.x, r.circuit.nodeIndex.d), 0.69254, 1e-3);
    near(elementCurrent(r.circuit, op.x, 'D1'), 4.3075e-3, 1e-3);
  });
  it('the same answer at the default gmin 1e-12', () => {
    const o2 = solveOp(r.circuit);
    near(nodeVoltage(o2.x, r.circuit.nodeIndex.d), 0.69254, 1e-3);
  });
});
