// Rating checks (DESIGN §3.8) over a measured window; thermal verdict at steady state; RatingReport conformance.
import { describe, expect, it } from 'vitest';
import type { Netlist, Element } from './mna/types';
import type { BenchSpec, RatingReport } from './bench/types';
import { runBench } from './bench/run';
import { parseNetlist } from './mna/netlist';
import { compileNetlist } from './mna/compile';
import { resistorThermal, semiThermal } from '../data/parts/util';
import type { RatedPart, Window } from './thermal';
import { ratingProbes, checkRatings, ratingsFromWindow } from './ratings';

const el = (id: string, kind: string, nodes: number[], p: Element['p'] = {}): Element => ({ id, kind, owner: id, nodes, p });
const nl = (elements: Element[]): Netlist => ({ nodeNames: ['0', 'a', 'b', 'c'], elements, models: {}, modelTypes: {} });
const deepFreeze = <X>(o: X): X => { if (o && typeof o === 'object') { Object.freeze(o); for (const v of Object.values(o)) deepFreeze(v); } return o; };
const flat = (n: number, v: number): number[] => Array.from({ length: n }, () => v);
/** Constant window of 5 samples over 1 s. */
const win = (series: Record<string, number[]>): Window => ({ t: [0, 0.25, 0.5, 0.75, 1], series });
const k = (r: ReturnType<typeof checkRatings>): string[] => r.findings.map((f) => f.what);

describe('resistor', () => {
  const R: RatedPart = { id: 'R1', kind: 'R', ratings: { P: 0.25 }, thermal: resistorThermal(0.25, 8) };
  const ckt = { netlist: nl([el('R1', 'R', [1, 0], { r: 22 })]) };
  it('within rating: no findings, steady T = Ta + P*theta', () => {
    const r = checkRatings(ckt, [R], win({ 'p(R1)': flat(5, 0.2), 'v(a,0)': flat(5, 2), 'i(R1)': flat(5, 0.1) }), { ta: 25 });
    expect(r.violations).toEqual([]); expect(r.smoked).toEqual([]);
    expect(r.tSteady.R1).toBeCloseTo(25 + 0.2 * 340, 9);
  });
  it('average power over the rating is a violation with key and vars', () => {
    const r = checkRatings(ckt, [R], win({ 'p(R1)': flat(5, 0.61), 'v(a,0)': flat(5, 3.67), 'i(R1)': flat(5, 0.17) }), { ta: 25 });
    expect(r.violations).toMatchObject([{ part: 'R1', what: 'P', limit: 0.25 }]); expect(r.violations[0].value).toBeCloseTo(0.61, 9);
    expect(r.findings[0].key).toBe('rating.resistor.power'); expect(r.findings[0].vars.part).toBe('R1');
    expect(r.smoked).toEqual([]);   // 0.61 W = 2.4x: warm, not smoked
  });
  it('smokes above 2.6x rated power at Ta = 25 C, not below (theta = 85/P, tFail 250 C)', () => {
    const run = (x: number) => checkRatings(ckt, [R], win({ 'p(R1)': flat(5, 0.25 * x) }), { ta: 25 });
    expect(run(2.5).smoked).toEqual([]);
    expect(run(2.7).smoked).toEqual(['R1']);
    expect(run(2.7).failures.some((f) => f.key === 'smoke.resistor')).toBe(true);
    expect(run(2.7).failureModes.R1).toEqual({ effect: 'open', r: 1e9 });
  });
  it('power is time averaged: a short peak above the rating is not a violation', () => {
    const t = [0, 0.01, 0.02, 1];
    const r = checkRatings(ckt, [R], { t, series: { 'p(R1)': [0.2, 3, 0.2, 0.2] } }, { ta: 25 });
    expect(r.violations).toEqual([]);
  });
});

describe('capacitors', () => {
  const C: RatedPart = { id: 'C1', kind: 'C', ratings: { Vrated: 50 }, thermal: semiThermal(200, 125, 8) };
  const E: RatedPart = { id: 'C1', kind: 'CE', ratings: { Vrated: 16, VrevMax: 1 }, thermal: semiThermal(40, 105, 60, { tFail: 125 }) };
  const ckt = { netlist: nl([el('C1', 'C', [1, 0], { c: 1e-6 })]) };
  it('|V| peak above Vrated', () => {
    const r = checkRatings(ckt, [C], win({ 'v(a,0)': [0, 10, -55, 10, 0], 'p(C1)': flat(5, 0) }), {});
    expect(k(r)).toEqual(['Vrated']); expect(r.violations[0].value).toBe(55);
  });
  it('electrolytic polarity: V < -0.5 V is a rating violation; -0.4 V is not', () => {
    expect(k(checkRatings(ckt, [E], win({ 'v(a,0)': flat(5, -4.2), 'p(C1)': flat(5, 0) }), {}))).toContain('VrevMax');
    expect(checkRatings(ckt, [E], win({ 'v(a,0)': flat(5, -0.4), 'p(C1)': flat(5, 0) }), {}).violations).toEqual([]);
  });
});

describe('semiconductors', () => {
  const D: RatedPart = { id: 'D1', kind: 'D', ratings: { VRRM: 100, IFAV: 0.15 }, thermal: semiThermal(350, 175, 20) };
  const LED: RatedPart = { id: 'D1', kind: 'LED', ratings: { IF: 0.03, IFP: 0.16, VR: 5 }, thermal: { thetaJA: 800, tauS: 10, tMax: 85, tFail: 110 } };
  const Z: RatedPart = { id: 'D1', kind: 'Z', ratings: { Pd: 0.5 }, thermal: semiThermal(300, 175, 20) };
  const Q: RatedPart = { id: 'Q1', kind: 'NPN', ratings: { Vceo: 40, Ic: 0.2, Ptot: 0.625 }, thermal: semiThermal(200, 150, 30) };
  const M: RatedPart = { id: 'Q1', kind: 'NMOS', ratings: { Vds: 60, Id: 0.2, Pd: 0.4, VgsMax: 20 }, thermal: semiThermal(312.5, 150, 30) };
  const L: RatedPart = { id: 'L1', kind: 'L', ratings: { Isat: 0.1 }, thermal: semiThermal(150, 125, 15, { tFail: 150 }) };
  const dn = { netlist: nl([el('D1', 'D', [1, 2])]) }, qn = { netlist: nl([el('Q1', 'Q', [1, 2, 3])]) }, ln = { netlist: nl([el('L1', 'L', [1, 2])]) };
  const f5 = flat(5, 0);
  it('diode: average forward current and reverse peak', () => {
    expect(k(checkRatings(dn, [D], win({ 'v(a,b)': flat(5, 0.8), 'i(D1)': flat(5, 0.4), 'p(D1)': flat(5, 0.3) }), {}))).toContain('IF(AV)');
    expect(k(checkRatings(dn, [D], win({ 'v(a,b)': [0, -120, 0, 0, 0], 'i(D1)': f5, 'p(D1)': f5 }), {}))).toEqual(['VRRM']);
    expect(checkRatings(dn, [D], win({ 'v(a,b)': flat(5, 0.7), 'i(D1)': flat(5, 0.1), 'p(D1)': flat(5, 0.07) }), {}).violations).toEqual([]);
  });
  it('LED: average over IF, peak over IFP, reverse over VR', () => {
    expect(k(checkRatings(dn, [LED], win({ 'v(a,b)': flat(5, 2), 'i(D1)': flat(5, 0.05), 'p(D1)': flat(5, 0.1) }), {}))).toContain('IF');
    expect(k(checkRatings(dn, [LED], { t: [0, 0.001, 0.002, 0.5, 1], series: { 'v(a,b)': flat(5, 1.9), 'i(D1)': [0, 0.2, 0, 0, 0], 'p(D1)': f5 } }, {}))).toEqual(['IFP']);
    expect(k(checkRatings(dn, [LED], win({ 'v(a,b)': [0, -6, 0, 0, 0], 'i(D1)': f5, 'p(D1)': f5 }), {}))).toEqual(['VR']);
  });
  it('Zener: average power over Pd', () => {
    const r = checkRatings(dn, [Z], win({ 'v(a,b)': flat(5, -5.1), 'i(D1)': flat(5, -0.2), 'p(D1)': flat(5, 1.02) }), {});
    expect(k(r)).toContain('Pd');
  });
  it('BJT: Vceo peak, Ic peak, Veb reverse > 6 V', () => {
    const base = { 'v(a,c)': flat(5, 5), 'v(b,c)': flat(5, 0.7), 'i(Q1)': flat(5, 0.01), 'p(Q1)': flat(5, 0.05) };
    expect(checkRatings(qn, [Q], win(base), {}).violations).toEqual([]);
    expect(k(checkRatings(qn, [Q], win({ ...base, 'v(a,c)': [5, 45, 5, 5, 5] }), {}))).toContain('Vceo');
    expect(k(checkRatings(qn, [Q], win({ ...base, 'i(Q1)': [0, 0.3, 0, 0, 0] }), {}))).toContain('Ic');
    expect(k(checkRatings(qn, [Q], win({ ...base, 'v(b,c)': [0.7, -7, 0.7, 0.7, 0.7] }), {}))).toContain('Vebo');
  });
  it('MOSFET: Vds, |Vgs| 20 V, Id average', () => {
    const base = { 'v(a,c)': flat(5, 5), 'v(b,c)': flat(5, 5), 'i(Q1)': flat(5, 0.05), 'p(Q1)': flat(5, 0.05) };
    expect(checkRatings(qn, [M], win(base), {}).violations).toEqual([]);
    expect(k(checkRatings(qn, [M], win({ ...base, 'v(a,c)': [5, 70, 5, 5, 5] }), {}))).toContain('Vds');
    expect(k(checkRatings(qn, [M], win({ ...base, 'v(b,c)': [5, -21, 5, 5, 5] }), {}))).toContain('Vgs');
    expect(k(checkRatings(qn, [M], win({ ...base, 'i(Q1)': flat(5, 0.5) }), {}))).toContain('Id');
  });
  it('inductor: |I| peak over Isat', () => {
    expect(k(checkRatings(ln, [L], win({ 'i(L1)': [0, -0.2, 0, 0, 0], 'p(L1)': f5 }), {}))).toEqual(['Isat']);
  });
  it('Tj steady above Tj,max is a violation; above tFail it smokes', () => {
    const r = checkRatings(qn, [Q], win({ 'v(a,c)': flat(5, 5), 'v(b,c)': flat(5, 0.7), 'i(Q1)': flat(5, 0.01), 'p(Q1)': flat(5, 0.7) }), { ta: 25 });
    expect(r.tSteady.Q1).toBeCloseTo(25 + 0.7 * 200, 9);   // 165 C > 150
    expect(k(r)).toContain('Tj'); expect(r.smoked).toEqual([]);
    const r2 = checkRatings(qn, [Q], win({ 'v(a,c)': flat(5, 5), 'v(b,c)': flat(5, 0.7), 'i(Q1)': flat(5, 0.01), 'p(Q1)': flat(5, 0.9) }), { ta: 25 });
    expect(r2.smoked).toEqual(['Q1']);   // 205 C > 175
  });
});

describe('bench integration', () => {
  const R: RatedPart = { id: 'R1', kind: 'R', ratings: { P: 0.25 }, thermal: resistorThermal(0.25, 8) };
  it('ratingProbes lists p(), v(), i() names', () => {
    expect(ratingProbes({ netlist: nl([el('R1', 'R', [1, 0], { r: 22 })]) }, [R])).toEqual(['p(R1)', 'v(a,0)', 'i(R1)']);
  });
  it('the report conforms to RatingReport and drives runBench (callback and static)', () => {
    const n = parseNetlist('V1 a 0 9\nR1 a 0 22');
    n.elements.forEach((e) => { e.owner = e.id; });
    const r = compileNetlist(n); if (!r.ok) throw new Error('compile');
    const parts: RatedPart[] = [{ ...R, id: 'R1' }];
    const specs: BenchSpec[] = [{ kind: 'rating', id: 'rt', probes: ratingProbes(r.circuit, parts) }];
    const res = runBench(r.circuit, specs, { h: 1e-4, window: 1e-3, ic: 'op', ratings: ratingsFromWindow(r.circuit, parts, { ta: 25 }), condition: 'nominal' });
    expect(res.pass).toBe(false);   // 9^2/22 = 3.68 W = 14.7x: violation + smoke
    expect(res.failures.map((f) => f.key)).toEqual(['bench.rating.violation', 'bench.rating.smoked']);
    expect(res.failures[0].vars).toMatchObject({ part: 'R1', what: 'P', limit: 0.25 });
    const stat: RatingReport = { violations: [], smoked: [] };
    expect(runBench(r.circuit, specs, { h: 1e-4, window: 1e-3, ratings: stat }).pass).toBe(true);
  });
});

describe('purity and determinism', () => {
  it('inputs are not mutated and repeated calls are identical', () => {
    const R: RatedPart = { id: 'R1', kind: 'R', ratings: { P: 0.25 }, thermal: resistorThermal(0.25, 8) };
    const ckt = deepFreeze({ netlist: nl([el('R1', 'R', [1, 0], { r: 22 })]) });
    const w = deepFreeze(win({ 'p(R1)': flat(5, 0.7), 'v(a,0)': flat(5, 4), 'i(R1)': flat(5, 0.2) }));
    const parts = deepFreeze([R]);
    const a = checkRatings(ckt, parts, w, { ta: 30 }), b = checkRatings(ckt, parts, w, { ta: 30 });
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
  });
});
