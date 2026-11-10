import { describe, expect, it } from 'vitest';
import { tranCards } from './tranUtil';
import { near } from './util';
import { dcAmp } from './oaUtil';
import { pulse, sine, type Wave } from '../mna/waveforms';
import { parseNetlist } from '../mna/netlist';
import { tranNetlist } from './tranUtil';
const MODEL = '\n.model m opamp (a0=1e5 gbw=10e6 sr=0.5e6)';
const run = (wave: Wave, tStop: number, h: number) => {
  const nl = parseNetlist(dcAmp('V1 in 0 0\nU1 in out out vp vn m' + MODEL));
  nl.elements = nl.elements.map((e) => (e.id === 'V1' ? { ...e, wave } : e));
  return tranNetlist(nl, { h, tStop, probes: ['v(out)', 'v(in)'] });
};
describe('OA-08 follower, macro SR 0.5 V/µs, GBW 10 MHz', () => {
  it('5 V step: slope 0.500 V/µs ±2 %; 0→5 V in 10 µs ±5 %', () => {
    const r = run(pulse(0, 5, 1, { delay: 1e-6, rise: 1e-9 }), 14e-6, 2e-8);
    const y = r.y('v(out)');
    const t = r.t;
    const t1 = t.findIndex((tt, k) => y[k] >= 1), t4 = t.findIndex((tt, k) => y[k] >= 4);
    const slope = (y[t4] - y[t1]) / (t[t4] - t[t1]);
    near(slope, 0.5e6, 0.02);
    const t0 = t.findIndex((tt, k) => y[k] >= 0.05), t5 = t.findIndex((tt, k) => y[k] >= 4.95);
    near(t[t5] - t[t0], 10e-6, 0.05);
  });
  it('5 kHz 10 Vpk undistorted', () => {
    const r = run(sine(10, 5e3), 4e-4, 2e-7);
    const y = r.y('v(out)'), u = r.y('v(in)');
    let pk = 0, err = 0;
    r.t.forEach((tt, k) => { if (tt > 2e-4) { pk = Math.max(pk, Math.abs(y[k])); err = Math.max(err, Math.abs(y[k] - u[k])); } });
    near(pk, 10, 0.01); expect(err).toBeLessThan(0.1);
  });
  it('15 kHz 10 Vpk: triangular, peak 8.33 V ±3 % (SR·T/4)', () => {
    const r = run(sine(10, 15e3), 4e-4, 1e-7);
    let pk = 0;
    r.t.forEach((tt, k) => { if (tt > 2e-4) pk = Math.max(pk, Math.abs(r.y('v(out)')[k])); });
    near(pk, 8.33, 0.03);
  });
});
void tranCards;
