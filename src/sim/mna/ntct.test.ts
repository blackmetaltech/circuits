// The time-programmed NTC (6-5's probe) and the quasi-static rescue of the transient stepper (a comparator with positive feedback switching inside one step).
import { describe, expect, it } from 'vitest';
import { parseNetlist } from './netlist';
import { pwl, waveValue } from './waveforms';
import { ntcResistance } from './devices/ntc';
import { tranNetlist } from '../oracles/tranUtil';
import { partModel } from '../oracles/oaUtil';
import { lm393 } from '../../data/parts/ics';
import { heatWave } from '../rig';

describe('NTCT: an NTC whose temperature follows a program', () => {
  it('a divider with the probe swept 25 -> 85 C follows R(T) of the static NTC at every time', () => {
    const nl = parseNetlist('V1 a 0 5\nRb s 0 10k\nV2 b 0 0');
    nl.elements.push({ id: 'T1', kind: 'NTCT', owner: 'T1', nodes: [nl.nodeNames.indexOf('a'), nl.nodeNames.indexOf('s')], p: { r25: 10e3, b: 3950, t0: 298.15 }, wave: pwl([[0, 25], [1e-3, 85]]) });
    const r = tranNetlist(nl, { h: 1e-5, tStop: 1e-3, probes: ['v(s)'] });
    for (const t of [2.5e-4, 5e-4, 7.5e-4, 1e-3])   // (t = 0 is inside the sources' power-on ramp)
      { const R = ntcResistance(10e3, 3950, 25 + 60 * (t / 1e-3)); expect(r.at('v(s)', t)).toBeCloseTo((5 * 10e3) / (10e3 + R), 4); }   // (Newton reltol 1e-4: the element is time-varying, so it is iterated)
  });
  it('heatWave: the program plus seeded noise of at most +-noiseK, the same wave every time, exact end points', () => {
    const h = { part: 'f1', pts: [[0, 40], [0.02, 60], [0.04, 40]] as [number, number][], noiseK: 0.42, noiseDt: 1e-4, seed: 6005 };
    const a = heatWave(h), b = heatWave(h);
    expect(a).toEqual(b);
    for (let k = 0; k <= 400; k++) { const t = k * 1e-4, base = t <= 0.02 ? 40 + 1000 * t : 60 - 1000 * (t - 0.02); expect(Math.abs(waveValue(a, t) - base)).toBeLessThanOrEqual(0.42 + 1e-9); }
    expect(waveValue(a, 0)).toBe(40); expect(waveValue(a, 0.04)).toBeCloseTo(40, 9);
    expect(heatWave({ ...h, seed: 7 })).not.toEqual(a);
  });
});

describe('quasi-static rescue: a comparator Schmitt trigger in transient', () => {
  // in- = a slow ramp 2 -> 3 -> 2 V; in+ = 10k / 10k from 5 V with Rh from OUT; 4.7k pull-up. Before the rescue every Rh failed with tran.noConverge at the first switch.
  const run = (rh: string) => {
    const nl = parseNetlist(`Vcc vcc 0 5\nVs s 0 0\nR1 vcc p 10k\nR2 p 0 10k\nRh out p ${rh}\nRp vcc out 4.7k\nU1 p s out vcc 0 c` + partModel(lm393, 'c'));
    nl.elements = nl.elements.map((e) => (e.id === 'Vs' ? { ...e, wave: pwl([[0, 2.0], [0.01, 3.0], [0.02, 2.0]]) } : e));
    return tranNetlist(nl, { h: 2e-5, tStop: 0.02, probes: ['v(out)', 'v(s)'] });
  };
  it('82k: switches low on the way up at the high threshold (2.636 V, as the DC analysis of OA-14) and high on the way down at the low one (2.359 V)', () => {
    const r = run('82k'), y = r.y('v(out)'), s = r.y('v(s)');
    const kHigh = y.findIndex((v) => v > 4), kDown = y.findIndex((v, k) => k > kHigh && v < 2.5), kUp = y.findIndex((v, k) => k > kDown && v > 2.5);
    expect(kHigh).toBeGreaterThanOrEqual(0); expect(kDown).toBeGreaterThan(kHigh); expect(kUp).toBeGreaterThan(kDown);
    expect(s[kDown]!).toBeCloseTo(2.6363, 2); expect(s[kUp]!).toBeCloseTo(2.3594, 2);
    expect(Math.max(...y)).toBeCloseTo(4.872, 2); expect(Math.min(...y)).toBeLessThan(0.1);
  });
  it('10 Mohm (a narrow window) also runs through', () => { const y = run('10meg').y('v(out)'); expect(Math.max(...y)).toBeGreaterThan(4.9); expect(Math.min(...y)).toBeLessThan(0.1); });
});
