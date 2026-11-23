import { describe, expect, it } from 'vitest';
import { parseNetlist } from '../mna/netlist';
import { compileNetlist } from '../mna/compile';
import { solveOp } from '../mna/op';
import { nodeVoltage } from '../mna/stamp';
import { ntcResistance } from '../mna/devices/ntc';
import { near } from './util';
import { partModel } from './oaUtil';
import { lm393 } from '../../data/parts/ics';
// Chapter 6-5 (Thermostat), the DESIGN reference: 5 V; NTC 10k at 25 °C, B 3950 on top, 3.6k to GND, sensor to the − input; 10k / 10k from 5 V to
// the + input, 82k from OUT to +, 4.7k pull-up on the LM393's open-collector OUT. OUT high = heater on (cold: sensor below the reference).
// NTC: R(47 °C) = 4023.6 Ω, R(50) = 3588.2, R(53) = 3206.6 (DESIGN: 4.02k / 3.59k / 3.21k).
// Heater ON, warming: the output transistor is off; nodal analysis of + (a) and OUT (o):
//   (5 − a)/10k − a/10k + (o − a)/82k = 0,  (5 − o)/4.7k − (o − a)/82k = 0  →  a = 2.63631 V, o = 4.87186 V.
//   Trip when the sensor reaches a: R_ntc = 3.6k·(5/a − 1) = 3227.7 Ω → T = 1/(1/298.15 + ln(0.32277)/3950) − 273.15 = 52.823 °C.
// Heater OFF, cooling: the switch sinks the pull-up current through Ron 50 Ω (DESIGN §3.7) → o = 0.05402 V, a = 2.35943 V,
//   R_ntc = 4029.0 Ω → T = 46.966 °C (46.901 °C if VOL were 0: the 50 Ω estimate moves it 0.07 K). Comparator offset is not modelled; A0 2e5 adds < 0.01 K.
// Without the pull-up nothing lifts OUT: the open collector can only sink, so OUT sits at the + node through 82k (≈ 2.5 V) and never reads high.
const cards = (tC: number, pullUp: boolean): string =>
  `Vcc vcc 0 5\nRntc vcc s ${ntcResistance(10e3, 3950, tC)}\nRb s 0 3.6k\nR1 vcc p 10k\nR2 p 0 10k\nRh out p 82k\n${pullUp ? 'Rp vcc out 4.7k\n' : ''}U1 p s out vcc 0 c` + partModel(lm393, 'c');
function sweep(from: number, to: number, step: number, pullUp = true): { flip: number; outs: number[] } {
  let x0: Float64Array | undefined, prev = NaN, flip = NaN;
  const outs: number[] = [];
  for (let k = 0; ; k++) {
    const t = from + k * step;
    if (step > 0 ? t > to + 1e-9 : t < to - 1e-9) break;
    const c = compileNetlist(parseNetlist(cards(t, pullUp)));
    if (!c.ok) throw new Error('compile');
    const op = solveOp(c.circuit, { x0 });
    if (!op.ok) throw new Error('OP failed at ' + t);
    x0 = op.x;
    const out = nodeVoltage(op.x, c.circuit.nodeIndex.out);
    outs.push(out);
    if (Number.isNaN(flip) && !Number.isNaN(prev) && (out > 2.5) !== (prev > 2.5)) flip = t;
    prev = out;
  }
  return { flip, outs };
}
describe('OA-14 LM393 thermostat (6-5 reference), NTC B 3950, 5 V', () => {
  it('NTC R(47) 4023.6, R(50) 3588.2, R(53) 3206.6 Ω', () => {
    near(ntcResistance(10e3, 3950, 47), 4023.6, 1e-4); near(ntcResistance(10e3, 3950, 50), 3588.2, 1e-4); near(ntcResistance(10e3, 3950, 53), 3206.6, 1e-4);
  });
  it('heater off at 52.82 °C rising, on at 46.97 °C falling (±0.02 K, 0.01 K steps); levels 4.872 V / 0.054 V', () => {
    const up = sweep(40, 60, 0.01), dn = sweep(60, 40, -0.01);
    expect(Math.abs(up.flip - 52.823)).toBeLessThan(0.02);
    expect(Math.abs(dn.flip - 46.966)).toBeLessThan(0.02);
    near(up.outs[0], 4.87186, 1e-3);
    near(dn.outs[0], 0.05402, 0.02);
  });
  it('no pull-up: OUT never rises above the + node (about 2.5 V) on a cold sensor, so it never reads high', () => {
    const r = sweep(40, 60, 0.5, false);
    expect(Math.max(...r.outs)).toBeLessThan(2.6);
  });
});
