import { describe, expect, it } from 'vitest';
import { dmath } from '@core/numerics';
import { compileNetlist } from '../mna/compile';
import { parseNetlist } from '../mna/netlist';
import { solveOp } from '../mna/op';
import { nodeVoltage } from '../mna/stamp';
import { near } from './util';

// Rectifier into a 1 kOhm resistive load, 10 V peak 50 Hz. A resistive load is memoryless, so the waveform is the DC OP swept over
// one mains cycle (source scale lambda = sin(theta), bit-reproducible dmath.sin). The time-domain (transient) version waits for tran.ts.
const N = 2000;
function sweep(cards: string, out = 'o') {
  const r = compileNetlist(parseNetlist(cards)); if (!r.ok) throw new Error(JSON.stringify(r.errors));
  const v: number[] = [];
  let x: Float64Array | undefined;
  for (let k = 0; k < N; k++) {
    const op = solveOp(r.circuit, { lambda: dmath.sin((2 * Math.PI * k) / N), x0: x }); expect(op.ok).toBe(true);
    x = op.x; v.push(nodeVoltage(op.x, r.circuit.nodeIndex[out]));
  }
  const peak = Math.max(...v), avg = v.reduce((a, b) => a + b, 0) / N;
  let peaks = 0; for (let k = 0; k < N; k++) if (v[k] > v[(k + N - 1) % N] && v[k] >= v[(k + 1) % N] && v[k] > 0.5 * peak) peaks++;
  return { peak, avg, peaks, f: 50 * peaks };
}
const half = (m: string) => `V1 a 0 10\nD1 a o ${m}\nRL o 0 1k\n.model ${m} ${m === 'D07' ? 'D07' : 'D(is=76.9p n=1.45 rs=0.042)'}`;
const bridge = (m: string) => `V1 p q 10\nD1 p o ${m}\nD2 q o ${m}\nD3 0 p ${m}\nD4 0 q ${m}\nRL o 0 1k\n.model ${m} ${m === 'D07' ? 'D07' : 'D(is=76.9p n=1.45 rs=0.042)'}`;

describe('SC-01 [Neamen ch2 / Sedra-Smith ch4] rectifiers, 10 V pk 50 Hz, 1 kOhm', () => {
  it('(a) half-wave, textbook 0.7 V: f 50 Hz, Vpk 9.300, Vavg 2.8409 (1 % peak, 2 % avg)', () => {
    const s = sweep(half('D07')); expect(s.f).toBe(50); near(s.peak, 9.3, 1e-2); near(s.avg, 2.8409, 2e-2);
  });
  it('(b) bridge, textbook 0.7 V: f 100 Hz, Vpk 8.600, Vavg 5.0287 (1 % peak, 2 % avg)', () => {
    const s = sweep(bridge('D07'), 'o'); expect(s.f).toBe(100); near(s.peak, 8.6, 1e-2); near(s.avg, 5.0287, 2e-2);
  });
  it('(a) half-wave, real 1N4007-class diode: peak within 5 %, average within 8 %', () => {
    const s = sweep(half('D1N4007')); near(s.peak, 9.3, 5e-2); near(s.avg, 2.8409, 8e-2);
  });
  it('(b) bridge, real diodes: peak within 5 %, average within 8 %', () => {
    const s = sweep(bridge('D1N4007')); near(s.peak, 8.6, 5e-2); near(s.avg, 5.0287, 8e-2);
  });
  it.todo('time-domain version with a sine source and a filter capacitor (needs tran.ts + waveforms.ts): ripple and conduction angle');
});
