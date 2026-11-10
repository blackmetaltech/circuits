// Bench cost estimator + gate (DESIGN §3.11). The estimate-vs-measured (2x) check is scripts/bench-cost.ts (needs a clock).
import { describe, expect, it } from 'vitest';
import { parseNetlist } from '../mna/netlist';
import { compileNetlist } from '../mna/compile';
import type { Circuit } from '../mna/types';
import { simEn } from '../../locales/sim.en';
import { runBench } from './run';
import { BENCH_FLOP_LIMIT, conditionOf, costGate, estimateCost } from './cost';

const compile = (cards: string): Circuit => { const r = compileNetlist(parseNetlist(cards)); if (!r.ok) throw new Error(JSON.stringify(r.errors)); return r.circuit; };
const D = '.model dd d (is=1e-14 n=1.9 rs=0.5)';
/** RC ladder of k sections (linear): dim = k + 1 nodes + 1 branch... grows with k. */
const ladder = (k: number): string => { let s = 'V1 n0 0 5\n'; for (let i = 0; i < k; i++) s += `R${i} n${i} n${i + 1} 1k\nC${i} n${i + 1} 0 1u\n`; return s; };
/** Same ladder with a diode on every node (nonlinear). */
const dladder = (k: number): string => { let s = ladder(k) + `${D}\n`; for (let i = 1; i <= k; i++) s += `D${i} n${i} 0 dd\n`; return s; };

describe('estimateCost', () => {
  const c10 = compile(ladder(10)), c20 = compile(ladder(20));
  it('is monotone in steps and in matrix dimension', () => {
    const f = (c: Circuit, tStop: number): number => estimateCost(c, [{ h: 1e-5, tStop }]).flops;
    expect(f(c10, 2e-2)).toBeGreaterThan(f(c10, 1e-2));
    expect(f(c20, 1e-2)).toBeGreaterThan(f(c10, 1e-2));
    const nl10 = compile(dladder(10));
    expect(estimateCost(nl10, [{ h: 1e-5, tStop: 1e-2, newtonIters: 5 }]).flops).toBeGreaterThan(estimateCost(nl10, [{ h: 1e-5, tStop: 1e-2, newtonIters: 2 }]).flops);
  });
  it('a linear circuit grows linearly in steps (LU reuse), a nonlinear one pays the cubic LU per iteration', () => {
    const a = estimateCost(c20, [{ h: 1e-5, tStop: 1e-2 }]), b = estimateCost(c20, [{ h: 1e-5, tStop: 2e-2 }]);
    expect(a.factors).toBe(2); expect(b.factors).toBe(2);
    const nl = compile(dladder(20));
    const nlEst = estimateCost(nl, [{ h: 1e-5, tStop: 1e-2 }]);
    expect(nlEst.factors).toBe(nlEst.steps * nlEst.newtonIters);
    expect(nlEst.flops).toBeGreaterThan(20 * a.flops);
  });
  it('scales as n^3 per factor for nonlinear boards (large steps)', () => {
    const e = (k: number): number => { const c = compile(dladder(k)); return estimateCost(c, [{ h: 1e-5, tStop: 1}]).flops / (c.dim * c.dim * c.dim); };
    expect(e(40) / e(20)).toBeGreaterThan(0.6); expect(e(40) / e(20)).toBeLessThan(1.4);
  });
  it('adds AC points and sums conditions', () => {
    const t = estimateCost(c10, [{ h: 1e-5, tStop: 1e-2 }]), tt = estimateCost(c10, [{ h: 1e-5, tStop: 1e-2 }, { h: 1e-5, tStop: 1e-2 }]);
    expect(tt.steps).toBe(2 * t.steps);
    const ac = estimateCost(c10, [{ h: 1e-5, tStop: 1e-2, acPoints: 100 }]);
    expect(ac.acFlops).toBeGreaterThan(0); expect(ac.flops).toBeGreaterThan(t.flops);
    expect(estimateCost(c10, [{ h: 1, tStop: 1, noTran: true, acPoints: 50 }]).tranFlops).toBe(0);
  });
  it('is pure: same inputs, same number', () => {
    expect(estimateCost(c10, [{ h: 1e-5, tStop: 1e-2 }])).toEqual(estimateCost(c10, [{ h: 1e-5, tStop: 1e-2 }]));
  });
});

describe('the 1.5e9 gate', () => {
  it('a ticket-like board (nonlinear, dim ~ 12, 3 conditions x 6000 steps) is under the limit', () => {
    const c = compile(dladder(10));
    const est = estimateCost(c, Array.from({ length: 3 }, () => ({ h: 1e-6, tStop: 6000e-6 })));
    expect(c.dim).toBeLessThanOrEqual(48);
    expect(est.flops).toBeLessThanOrEqual(1.5e9);
    expect(costGate(est).ok).toBe(true);
  });
  it('a board at the dim cap with the full step budget is refused with the teaching key', () => {
    const c = compile(dladder(46));
    const g = costGate(estimateCost(c, [{ h: 1e-6, tStop: 25000e-6 }, { h: 1e-6, tStop: 25000e-6 }]));
    expect(g.ok).toBe(false);
    if (!g.ok) { expect(g.key).toBe('bench.cost.too-big'); expect(g.vars.flops).toBeGreaterThan(BENCH_FLOP_LIMIT); expect(g.vars.limit).toBe(BENCH_FLOP_LIMIT); }
  });
  it('the key has English text with its variables', () => {
    expect(simEn['bench.cost.too-big']).toContain('{flops}');
    expect(simEn['bench.cost.too-big']).toContain('{limit}');
  });
});

describe('runBench pre-check', () => {
  const c = compile(dladder(46));
  const spec = [{ kind: 'level' as const, id: 'v', probe: 'v(n3)', lo: 0, hi: 10 }];
  it('maxFlops refuses a too-big bench before stepping; no maxFlops runs as before', () => {
    const r = runBench(c, spec, { h: 1e-6, settle: 0, window: 1, maxFlops: 1e6 });
    expect(r.pass).toBe(false);
    expect(r.failures).toHaveLength(1);
    expect(r.failures[0].key).toBe('bench.cost.too-big');
    const small = compile('V1 in 0 10\nR1 in out 1k\nR2 out 0 1k');
    expect(runBench(small, [{ kind: 'level', id: 'v', probe: 'v(out)', lo: 4.9, hi: 5.1 }], { h: 1e-4, settle: 1e-3, window: 1e-3, maxFlops: BENCH_FLOP_LIMIT }).pass).toBe(true);
  });
  it('conditionOf mirrors runBench windows', () => {
    expect(conditionOf(spec, { h: 1e-4, settle: 1e-3, window: 2e-3 }).tStop).toBeCloseTo(3e-3, 12);
    expect(conditionOf(spec, { h: 1e-4, settle: 'periodic', period: 1e-3, maxPeriods: 10 }).tStop).toBeCloseTo(11e-3, 12);
    expect(conditionOf([{ kind: 'mask', id: 'm', out: 'a', inp: 'b', regions: [{ f1: 10, f2: 1e4, lo: -1, hi: 1 }] }], { h: 1e-4 }).noTran).toBe(true);
  });
});
