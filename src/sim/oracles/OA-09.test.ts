import { describe, expect, it } from 'vitest';
import { parseNetlist } from '../mna/netlist';
import { compileNetlist } from '../mna/compile';
import { solveOp } from '../mna/op';
import { nodeVoltage } from '../mna/stamp';
import { near } from './util';
// Schmitt trigger: − = in; Rfb 15k out→+; Rg 10k +→GND; ±12 V saturation. Thresholds found by DC continuation (hysteresis: the previous OP seeds the next).
const cards = (vin: number): string => `V1 in 0 ${vin}\nRfb out ip 15k\nRg ip 0 10k\nU1 ip in out vp vn m\n.model m opamp (a0=1e5 gbw=1e8 ro=1 headhi=0 headlo=0)\nVp vp 0 12\nVn vn 0 -12`;
function sweep(from: number, to: number, step: number): { vin: number; out: number } {
  let x0: Float64Array | undefined, prevOut = NaN;
  for (let v = from; step > 0 ? v <= to : v >= to; v += step) {
    const c = compileNetlist(parseNetlist(cards(v)));
    if (!c.ok) throw new Error('compile');
    const op = solveOp(c.circuit, { x0 });
    if (!op.ok) throw new Error('OP failed at ' + v);
    x0 = op.x;
    const out = nodeVoltage(op.x, c.circuit.nodeIndex.out);
    if (!Number.isNaN(prevOut) && Math.sign(out) !== Math.sign(prevOut)) return { vin: v, out };
    prevOut = out;
  }
  throw new Error('no flip');
}
describe('OA-09 Schmitt trigger, macro A0 1e5, fast, ±12 V', () => {
  it('thresholds +4.800 / −4.800 V ±1 %', () => {
    const up = sweep(-8, 8, 0.01), dn = sweep(8, -8, -0.01);
    expect(up.out).toBeLessThan(0); expect(dn.out).toBeGreaterThan(0);
    near(up.vin, 4.8, 0.01); near(dn.vin, -4.8, 0.01);
  });
});
