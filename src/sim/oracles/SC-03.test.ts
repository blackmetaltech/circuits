import { describe, expect, it } from 'vitest';
import { compileNetlist } from '../mna/compile';
import { parseNetlist } from '../mna/netlist';
import { solveOp } from '../mna/op';
import { elementCurrent, elementPower, nodeVoltage } from '../mna/stamp';
import { near } from './util';

const run = (v: number, model: string) => {
  const r = compileNetlist(parseNetlist(`V1 a 0 ${v}\nR1 a d 1k\nD1 d 0 Dm\n.model Dm ${model}`)); if (!r.ok) throw new Error(JSON.stringify(r.errors));
  const op = solveOp(r.circuit); expect(op.ok).toBe(true);
  return { vd: nodeVoltage(op.x, r.circuit.nodeIndex.d), id: elementCurrent(r.circuit, op.x, 'D1'), pd: elementPower(r.circuit, op.x, 'D1'), op };
};
// [Sedra/Smith / Neamen, silicon diode] 5 V, 1 kOhm: textbook constant-0.7 V and Shockley models; then reversed.
describe('SC-03 [Neamen ch1 / Sedra-Smith ch4] 5 V, 1k, Si diode', () => {
  it('textbook 0.7 V: V 0.7000, I 4.3000 mA, P 3.010 mW', () => {
    const s = run(5, 'D07'); near(s.vd, 0.7, 1e-3); near(s.id, 4.3e-3, 1e-3); near(s.pd, 3.01e-3, 1e-3);
  });
  it('Shockley (Is 1e-14, N 1): Vd 0.69254 V, Id 4.3075 mA', () => {
    const s = run(5, 'D(is=1e-14 n=1)'); near(s.vd, 0.69254, 1e-3); near(s.id, 4.3075e-3, 1e-3);
  });
  it('reversed (-5 V): |I| < 1 uA in both models, diode carries the full 5 V', () => {
    for (const m of ['D07', 'D(is=1e-14 n=1)']) {
      const s = run(-5, m); expect(Math.abs(s.id)).toBeLessThan(1e-6); near(s.vd, -5, 1e-3);
    }
  });
});
