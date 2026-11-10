// runBench: periodic settle, specs end to end, mask edges, determinism, purity (DESIGN §3.12).
import { describe, expect, it } from 'vitest';
import { dmath } from '@core/numerics';
import { hashOf } from '@core/kit';
import { parseNetlist } from '../mna/netlist';
import { compileNetlist } from '../mna/compile';
import { square, sine } from '../mna/waveforms';
import type { Circuit, Netlist } from '../mna/types';
import { runBench, type BenchSpec } from './run';

const compile = (nl: Netlist): Circuit => { const r = compileNetlist(nl); if (!r.ok) throw new Error(JSON.stringify(r.errors)); return r.circuit; };
const withWave = (nl: Netlist, id: string, wave: NonNullable<Netlist['elements'][number]['wave']>): Netlist => ({ ...nl, elements: nl.elements.map((e) => (e.id === id ? { ...e, wave } : e)) });
const T = 1e-3;
const rcSquare = (): Circuit => compile(withWave(parseNetlist('V1 in 0 0\nR1 in out 1k\nC1 out 0 0.5u'), 'V1', square(0, 1, T, 0.5, 1e-7)));   // tau = 0.5 ms
const deepFreeze = <X>(o: X): X => { if (o && typeof o === 'object') { Object.freeze(o); for (const v of Object.values(o)) deepFreeze(v); } return o; };

describe('periodic settle on an RC-driven square wave', () => {
  const tau = 0.5e-3, tanh = (x: number): number => { const a = dmath.exp(2 * x); return (a - 1) / (a + 1); };
  it('settles in a handful of periods, then measures the steady state', () => {
    const specs: BenchSpec[] = [
      { kind: 'metric', id: 'vpp', probe: 'v(out)', metric: 'vpp', lo: 0, hi: 1 },
      { kind: 'metric', id: 'mean', probe: 'v(out)', metric: 'mean', lo: 0.498, hi: 0.502 },
    ];
    const r = runBench(rcSquare(), specs, { h: T / 200, period: T, settle: 'periodic', measurePeriods: 2 });
    expect(r.settle.settled).toBe(true);
    expect(r.settle.periods).toBeGreaterThanOrEqual(2); expect(r.settle.periods).toBeLessThan(12);
    expect(r.metrics.vpp).toBeCloseTo(tanh(T / (4 * tau)), 2);
    expect(r.pass).toBe(true);
  });
  it('without settling the first-period mean is wrong (control)', () => {
    const r = runBench(rcSquare(), [{ kind: 'metric', id: 'mean', probe: 'v(out)', metric: 'mean', lo: 0.498, hi: 0.502 }], { h: T / 200, period: T, settle: 0, measurePeriods: 1 });
    expect(r.pass).toBe(false);
    expect(r.failures[0].key).toBe('bench.metric.fail');
    expect(r.failures[0].vars.id).toBe('mean');
  });
  it('a circuit that never settles inside maxPeriods reports bench.settle.fail', () => {
    const r = runBench(rcSquare(), [{ kind: 'level', id: 'v', probe: 'v(out)', lo: 0, hi: 1 }], { h: T / 100, period: T, settle: 'periodic', maxPeriods: 2, settleTol: 1e-9 });
    expect(r.settle.settled).toBe(false);
    expect(r.failures.some((f) => f.key === 'bench.settle.fail')).toBe(true);
  });
  it('band spec on the settled output: a constant 0.5 target needs dv >= Vpp/2', () => {
    const half = tanh(T / (4 * tau)) / 2, band = (dv: number): BenchSpec[] => [{ kind: 'band', id: 'b', probe: 'v(out)', target: { k: 'ref', t: [0, 1], y: [0.5, 0.5] }, dv, dt: 0 }];
    const o = { h: T / 200, period: T, settle: 'periodic' as const };
    expect(runBench(rcSquare(), band(half + 0.01), o).pass).toBe(true);
    const r = runBench(rcSquare(), band(half - 0.05), o);
    expect(r.pass).toBe(false);
    expect(r.failures[0].key).toBe('bench.band.fail');
  });
});

describe('level, rating, safety, predict', () => {
  const divider = (): Circuit => compile(parseNetlist('V1 in 0 10\nR1 in out 1k\nR2 out 0 1k\nR3 in 0 100k'));
  it('level in range passes, out of range fails with key + vars', () => {
    expect(runBench(divider(), [{ kind: 'level', id: 'v', probe: 'v(out)', lo: 4.9, hi: 5.1 }], { h: 1e-4, settle: 1e-3, window: 1e-3 }).pass).toBe(true);
    const r = runBench(divider(), [{ kind: 'level', id: 'v', probe: 'v(out)', lo: 6, hi: 7 }], { h: 1e-4, settle: 1e-3, window: 1e-3, condition: 'nominal' });
    expect(r.pass).toBe(false);
    expect(r.failures[0].key).toBe('bench.level.fail');
    expect(r.failures[0].vars).toMatchObject({ id: 'v', lo: 6, hi: 7, cond: 'nominal' });
    expect(r.failures[0].vars.value as number).toBeCloseTo(5, 3);
  });
  it('rating spec fails on a violation and on smoke, passes when clean', () => {
    const spec: BenchSpec[] = [{ kind: 'rating', id: 'rat' }];
    const o = { h: 1e-4 };
    expect(runBench(divider(), spec, { ...o, ratings: { violations: [], smoked: [] } }).pass).toBe(true);
    const bad = runBench(divider(), spec, { ...o, ratings: { violations: [{ part: 'p1', what: 'power', value: 0.6, limit: 0.25 }], smoked: ['p1'] } });
    expect(bad.pass).toBe(false);
    expect(bad.failures.map((f) => f.key)).toEqual(['bench.rating.violation', 'bench.rating.smoked']);
  });
  it('safety: bleeder resistor across nodes', () => {
    const spec = (maxOhm: number): BenchSpec[] => [{ kind: 'safety', id: 's', rule: { rule: 'resistorAcross', a: 'in', b: '0', maxOhm } }];
    expect(runBench(divider(), spec(200e3), { h: 1e-4 }).pass).toBe(true);
    const r = runBench(divider(), spec(50e3), { h: 1e-4 });
    expect(r.pass).toBe(false);
    expect(r.failures[0].key).toBe('bench.safety.fail');
  });
  it('predict is scored, not pass/fail', () => {
    const r = runBench(divider(), [
      { kind: 'predict', id: 'a', entered: 5.02, of: { probe: 'v(out)', metric: 'mean' } },
      { kind: 'predict', id: 'b', entered: 5.2, of: { probe: 'v(out)', metric: 'mean' } },
      { kind: 'predict', id: 'c', entered: 9, of: { probe: 'v(out)', metric: 'mean' } },
    ], { h: 1e-4, settle: 1e-3, window: 1e-3 });
    expect(r.pass).toBe(true);
    expect(r.predictions.map((p) => p.grade)).toEqual(['exact', 'close', 'miss']);
    expect(r.predictions[0].truth).toBeCloseTo(5, 3);
  });
});

describe('mask (Bode) specs', () => {
  const lp = (): Circuit => compile(parseNetlist('V1 in 0 DC 0 AC 1\nR1 in out 1k\nC1 out 0 159.1549431n'));   // fc = 1 kHz
  const dB = (f: number): number => -10 * dmath.log10(1 + (f / 1000) * (f / 1000));
  it('passes inside, fails outside, with the failing frequency in vars', () => {
    const ok = runBench(lp(), [{ kind: 'mask', id: 'm', out: 'out', inp: 'in', regions: [{ f1: 10, f2: 100, lo: -0.1, hi: 0.01 }, { f1: 900, f2: 1100, lo: -4, hi: -2 }] }], { h: 1e-6 });
    expect(ok.pass).toBe(true);
    const bad = runBench(lp(), [{ kind: 'mask', id: 'm', out: 'out', inp: 'in', regions: [{ f1: 1500, f2: 2000, lo: -2, hi: 0 }] }], { h: 1e-6 });
    expect(bad.pass).toBe(false);
    expect(bad.failures[0].key).toBe('bench.mask.fail');
    expect(bad.failures[0].vars.f as number).toBeGreaterThanOrEqual(1500);
  });
  it('mask edges are always evaluated, even on a coarse grid', () => {
    const f = 1234, mk = (d: number): BenchSpec[] => [{ kind: 'mask', id: 'm', out: 'out', inp: 'in', perDecade: 1, regions: [{ f1: 10, f2: 100, lo: -1, hi: 0.1 }, { f1: f, f2: f, lo: dB(f) - 0.01 + d, hi: dB(f) + 0.01 + d }] }];
    expect(runBench(lp(), mk(0), { h: 1e-6 }).pass).toBe(true);
    expect(runBench(lp(), mk(0.5), { h: 1e-6 }).pass).toBe(false);
  });
  it('phase regions and gain relative to a reference frequency', () => {
    const r = runBench(lp(), [{ kind: 'mask', id: 'm', out: 'out', inp: 'in', regions: [
      { f1: 1000, f2: 1000, lo: -46, hi: -44, quantity: 'phase' },
      { f1: 1000, f2: 1000, lo: -3.1, hi: -2.9, relativeTo: 1 },
    ] }], { h: 1e-6 });
    expect(r.pass).toBe(true);
  });
});

describe('determinism and purity', () => {
  const specs: BenchSpec[] = [
    { kind: 'metric', id: 'vpp', probe: 'v(out)', metric: 'vpp', lo: 0, hi: 1 },
    { kind: 'metric', id: 'thd', probe: 'v(out)', metric: 'thd', params: { harmonics: 9 }, lo: 0, hi: 100 },
    { kind: 'band', id: 'b', probe: 'v(out)', target: { k: 'wave', wave: sine(0.5, 1000, 0, 0.5) }, dv: 0.5, dt: 1e-4 },
  ];
  const o = { h: T / 200, period: T, settle: 'periodic' as const, measurePeriods: 2 };
  it('identical hashes on repeat, including a fresh compile', () => {
    const a = hashOf(runBench(rcSquare(), specs, o)), b = hashOf(runBench(rcSquare(), specs, o));
    expect(a).toBe(b);
    const c = rcSquare();
    expect(hashOf(runBench(c, specs, o))).toBe(hashOf(runBench(c, specs, o)));
  });
  it('inputs are not mutated (deep-frozen spec, options, netlist)', () => {
    const c = rcSquare();
    const before = hashOf(c.netlist);
    deepFreeze(c.netlist);
    expect(() => runBench(c, deepFreeze(structuredClone(specs)), deepFreeze({ ...o }))).not.toThrow();
    expect(hashOf(c.netlist)).toBe(before);
  });
});
