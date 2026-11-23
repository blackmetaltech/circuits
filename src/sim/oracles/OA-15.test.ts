import { describe, expect, it } from 'vitest';
import { parseNetlist } from '../mna/netlist';
import { square } from '../mna/waveforms';
import { integrate, interp, tranNetlist } from './tranUtil';
import { near } from './util';
import { partModel, rails } from './oaUtil';
import { tl072 } from '../../data/parts/ics';
// Chapter 6-6 (Ramp): inverting integrator Rin 11k, C 22 nF, TL072 on ±12 V; input a 1 kHz square ±1 V around a +50 mV offset (−0.95 / +1.05 V).
// With Rf 56k across C the stage is a low-pass of DC gain −Rf/Rin = −5.0909 and corner 1/(2π·56k·22n) = 129.2 Hz, τ = RfC = 1.232 ms.
//   DC: the offset comes out as −0.05·5.0909 = −0.25455 V (DESIGN quotes its size, 0.255 V).
//   Square of amplitude A through a first-order low-pass, steady state: Vpp = 2·A·(Rf/Rin)·tanh(T/(4τ)) = 2·1·5.0909·tanh(0.20292) = 2.0382 V.
//   Steady after 50 ms = 40 τ. The turning points are the samples just before each edge (the 1 ns source edge outruns the GBW and makes a
//   13 mV, few-ns glitch on the output: real, but not part of the triangle; it is why a raw max − min reads 2.064 V).
// Without Rf there is no DC feedback: 50 mV/(11k·22n) = 207 V/s of drift, and the output sits on the lower swing limit, −12 + 1.5 = −10.5 V.
function run(withRf: boolean) {
  const nl = parseNetlist(`V1 in 0 0\nR1 in inv 11k\nC1 out inv 22n\n${withRf ? 'Rf out inv 56k\n' : ''}U1 0 inv out vp vn m` + rails(12) + partModel(tl072));
  nl.elements = nl.elements.map((e) => (e.id === 'V1' ? { ...e, wave: square(-0.95, 1.05, 1e-3) } : e));
  return tranNetlist(nl, { h: 1e-6, tStop: 0.052, probes: ['v(out)'] });
}
describe('OA-15 integrator with Rf across C and a 50 mV input offset, TL072 macro, ±12 V', () => {
  it('Rf 56k: centred at −0.2545 V, 2.038 Vpp at 1 kHz (±0.5 %)', () => {
    const r = run(true), y = r.y('v(out)');
    const top = interp(r.t, y, 0.051 - 1e-6), bottom = interp(r.t, y, 0.0505 - 1e-6);   // high half (+1.05 V) runs 51.000-51.5 ms: output falls
    near(top - bottom, 2.0382, 5e-3);
    const k0 = r.t.findIndex((t) => t >= 0.05), k1 = r.t.findIndex((t) => t >= 0.051);
    near(integrate(r.t.slice(k0, k1 + 1), y.slice(k0, k1 + 1)) / (r.t[k1] - r.t[k0]), -0.25455, 5e-3);
  });
  it('no Rf: the offset drives the output onto the −10.5 V limit', () => {
    const r = run(false), y = r.y('v(out)').filter((_, k) => r.t[k] > 0.05);
    near(Math.min(...y), -10.5, 5e-3);
    expect(y.reduce((s, v) => s + v, 0) / y.length).toBeLessThan(-8.5);
  });
});
