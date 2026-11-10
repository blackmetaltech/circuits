// Instant failures, failure behaviour, smoked-part state (DESIGN §3.9, §7.3).
import { describe, expect, it } from 'vitest';
import type { Netlist, Element } from './mna/types';
import { semiThermal } from '../data/parts/util';
import type { RatedPart, Window } from './thermal';
import { instantFailures, failureBehaviour, applyFailures, emptySmokeState, markSmoked, refuseSmoked } from './smoke';
import { checkRatings } from './ratings';

const el = (id: string, kind: string, nodes: number[], p: Element['p'] = {}): Element => ({ id, kind, owner: id, nodes, p });
const nl = (elements: Element[]): Netlist => ({ nodeNames: ['0', 'a', 'b', 'c'], elements, models: {}, modelTypes: {} });
const flat = (n: number, v: number): number[] => Array.from({ length: n }, () => v);
const deepFreeze = <X>(o: X): X => { if (o && typeof o === 'object') { Object.freeze(o); for (const v of Object.values(o)) deepFreeze(v); } return o; };
/** Uniform window: n samples, step dt. */
const uw = (n: number, dt: number, series: Record<string, number[]>): Window => ({ t: Array.from({ length: n }, (_, i) => i * dt), series });
const rules = (r: ReturnType<typeof instantFailures>): string[] => r.map((f) => f.rule);

const Mp: RatedPart = { id: 'Q1', kind: 'NMOS', ratings: { Vds: 60, Id: 0.2, VgsMax: 20 }, thermal: semiThermal(312.5, 150, 30) };
const Qp: RatedPart = { id: 'Q1', kind: 'NPN', ratings: { Vceo: 40, Ic: 0.2 }, thermal: semiThermal(200, 150, 30) };
const Cc: RatedPart = { id: 'C1', kind: 'C', ratings: { Vrated: 50 }, thermal: semiThermal(200, 125, 8) };
const Ce: RatedPart = { id: 'C1', kind: 'CE', ratings: { Vrated: 16, VrevMax: 1 }, thermal: semiThermal(40, 105, 60, { tFail: 125 }) };
const Dp: RatedPart = { id: 'D1', kind: 'D', ratings: { VRRM: 100, IFAV: 0.15 }, thermal: semiThermal(350, 175, 20) };
const Lp: RatedPart = { id: 'D1', kind: 'LED', ratings: { IF: 0.03, IFP: 0.16, VR: 5 }, thermal: semiThermal(800, 85, 10) };
const Fp: RatedPart = { id: 'F1', kind: 'FUSE', ratings: { Irated: 0.4 }, thermal: semiThermal(50, 100, 10) };
const q3 = { netlist: nl([el('Q1', 'Q', [1, 2, 3])]) }, c2 = { netlist: nl([el('C1', 'C', [1, 0])]) }, d2 = { netlist: nl([el('D1', 'D', [1, 2])]) }, f2 = { netlist: nl([el('F1', 'FUSE', [1, 2])]) };

describe('instant failures', () => {
  it('MOSFET |Vgs| > 20 V punches through, 19 V does not', () => {
    const w = (v: number) => uw(5, 0.001, { 'v(a,c)': flat(5, 5), 'v(b,c)': [0, v, 0, 0, 0], 'i(Q1)': flat(5, 0) });
    expect(rules(instantFailures(q3, [Mp], w(-21)))).toEqual(['mosfetGate']);
    expect(instantFailures(q3, [Mp], w(19))).toEqual([]);
  });
  it('BJT Vce > 1.2 Vceo while conducting; not when off', () => {
    const w = (ic: number) => uw(5, 0.001, { 'v(a,c)': flat(5, 50), 'v(b,c)': flat(5, 0.7), 'i(Q1)': flat(5, ic) });
    expect(rules(instantFailures(q3, [Qp], w(0.01)))).toEqual(['bjtAvalanche']);
    expect(instantFailures(q3, [Qp], w(0))).toEqual([]);
    expect(instantFailures(q3, [Qp], uw(5, 0.001, { 'v(a,c)': flat(5, 47), 'v(b,c)': flat(5, 0.7), 'i(Q1)': flat(5, 0.01) }))).toEqual([]);   // 47 < 48
  });
  it('capacitor V > 1.2 Vrated for more than 50 ms', () => {
    const over = (ms: number) => uw(101, 0.001, { 'v(a,0)': Array.from({ length: 101 }, (_, i) => (i < ms ? 65 : 0)) });
    expect(rules(instantFailures(c2, [Cc], over(60)))).toEqual(['capOverVoltage']);
    expect(instantFailures(c2, [Cc], over(40))).toEqual([]);
    expect(instantFailures(c2, [Cc], uw(101, 0.001, { 'v(a,0)': flat(101, 59) }))).toEqual([]);   // 59 < 60
  });
  it('electrolytic reverse > 1 V for more than 0.5 s', () => {
    const rev = (v: number, secs: number) => uw(101, 0.01, { 'v(a,0)': Array.from({ length: 101 }, (_, i) => (i * 0.01 <= secs ? v : 3)) });
    expect(rules(instantFailures(c2, [Ce], rev(-2, 0.7)))).toEqual(['capReverse']);
    expect(instantFailures(c2, [Ce], rev(-2, 0.3))).toEqual([]);
    expect(instantFailures(c2, [Ce], rev(-0.9, 0.9))).toEqual([]);
  });
  it('diode / LED reverse beyond VRRM (VR) with current', () => {
    const w = (v: number, i: number) => uw(5, 0.001, { 'v(a,b)': [0, v, v, 0, 0], 'i(D1)': [0, i, i, 0, 0] });
    expect(rules(instantFailures(d2, [Dp], w(-120, -0.01)))).toEqual(['diodeBreakdown']);
    expect(instantFailures(d2, [Dp], w(-120, 0))).toEqual([]);   // no current: just a rating issue
    expect(rules(instantFailures(d2, [Lp], w(-6, -0.01)))).toEqual(['diodeBreakdown']);
  });
  it('LED I > 3 IF', () => {
    const w = (i: number) => uw(5, 0.001, { 'v(a,b)': flat(5, 2), 'i(D1)': flat(5, i) });
    expect(rules(instantFailures(d2, [Lp], w(0.1)))).toEqual(['ledDie']);   // 0.1 > 0.09
    expect(instantFailures(d2, [Lp], w(0.08))).toEqual([]);
  });
  it('fuse I2t and meter fuse', () => {
    const w = (i: number) => uw(101, 0.001, { 'i(F1)': flat(101, i) });
    expect(rules(instantFailures(f2, [Fp], w(1.0)))).toEqual(['fuse']);   // >> 2 Irated for 50 ms
    expect(instantFailures(f2, [Fp], w(0.3))).toEqual([]);
    const Mf: RatedPart = { id: 'F1', kind: 'METER', ratings: { Irated: 0.2 }, thermal: semiThermal(50, 100, 10) };
    expect(rules(instantFailures(f2, [Mf], w(0.5)))).toEqual(['meterFuse']);
  });
  it('findings carry i18n key and vars; instant failures smoke the part in checkRatings', () => {
    const f = instantFailures(q3, [Mp], uw(5, 0.001, { 'v(a,c)': flat(5, 5), 'v(b,c)': flat(5, 25), 'i(Q1)': flat(5, 0) }))[0];
    expect(f.key).toBe('smoke.mosfet.gate'); expect(f.part).toBe('Q1'); expect(f.vars).toMatchObject({ part: 'Q1' });
    const r = checkRatings(q3, [Mp], uw(5, 0.001, { 'v(a,c)': flat(5, 5), 'v(b,c)': flat(5, 25), 'i(Q1)': flat(5, 0), 'p(Q1)': flat(5, 0) }), {});
    expect(r.smoked).toEqual(['Q1']); expect(r.failures.map((x) => x.key)).toContain('smoke.mosfet.gate');
  });
});

describe('failure behaviour', () => {
  it('table per kind', () => {
    expect(failureBehaviour('R')).toEqual({ effect: 'open', r: 1e9 });
    expect(failureBehaviour('C')).toEqual({ effect: 'short', r: 0.1 });
    expect(failureBehaviour('CE')).toEqual({ effect: 'open', r: 1e9 });
    expect(failureBehaviour('D')).toEqual({ effect: 'short', r: 0.5 });
    expect(failureBehaviour('LED')).toEqual({ effect: 'open', r: 1e9 });
    expect(failureBehaviour('NPN')).toEqual({ effect: 'short', r: 0.5, between: [0, 2] });
    expect(failureBehaviour('NMOS')).toEqual({ effect: 'short', r: 0.5, between: [0, 2], gateTo: 2 });
    expect(failureBehaviour('OPAMP')).toEqual({ effect: 'hiZ', r: 1e9, supplyA: 0.05 });
    expect(failureBehaviour('REG')).toEqual({ effect: 'open', r: 1e9 });
  });
  it('applyFailures rewrites the netlist purely: R open, C short, D short, LED open, BJT C-E, MOSFET D-S and G-S', () => {
    const n = deepFreeze(nl([el('R1', 'R', [1, 2], { r: 100 }), el('C1', 'C', [1, 0], { c: 1e-6 }), el('D1', 'D', [2, 3]), el('Q1', 'Q', [1, 2, 3]), el('Q2', 'M', [1, 2, 3])]));
    const kinds = { R1: 'R', C1: 'C', D1: 'D', Q1: 'NPN', Q2: 'NMOS' } as const;
    const out = applyFailures(n, ['R1', 'C1', 'D1', 'Q1', 'Q2'], kinds);
    const r = (id: string): Element => out.elements.find((e) => e.id === id)!;
    expect(r('R1').p.r).toBe(1e9);
    expect(r('C1')).toMatchObject({ kind: 'R', nodes: [1, 0], p: { r: 0.1 } });
    expect(r('D1')).toMatchObject({ kind: 'R', nodes: [2, 3], p: { r: 0.5 } });
    expect(r('Q1')).toMatchObject({ kind: 'R', nodes: [1, 3], p: { r: 0.5 } });
    expect(r('Q2')).toMatchObject({ kind: 'R', nodes: [1, 3], p: { r: 0.5 } });
    expect(r('Q2#g')).toMatchObject({ kind: 'R', nodes: [2, 3], p: { r: 0.5 } });
    expect(n.elements[0].p.r).toBe(100);   // input untouched
    expect(JSON.stringify(applyFailures(n, ['R1'], kinds))).toBe(JSON.stringify(applyFailures(n, ['R1'], kinds)));
  });
});

describe('smoked parts are refused by later runs', () => {
  it('state accumulates (sorted, unique) and refuses any board that still holds a smoked part', () => {
    let s = emptySmokeState();
    s = markSmoked(s, ['R2', 'R1']); s = markSmoked(s, ['R1', 'Q1']);
    expect(s.smoked).toEqual(['Q1', 'R1', 'R2']);
    expect(refuseSmoked(s, ['R1', 'C1'])).toEqual([{ key: 'smoke.refused', vars: { part: 'R1' } }]);
    expect(refuseSmoked(s, ['C1', 'C2'])).toEqual([]);
    expect(emptySmokeState().smoked).toEqual([]);
  });
  it('previouslySmoked parts are reported smoked by checkRatings without a new overload', () => {
    const r = checkRatings(c2, [Cc], uw(3, 0.001, { 'v(a,0)': flat(3, 1), 'p(C1)': flat(3, 0) }), { previouslySmoked: ['C1'] });
    expect(r.smoked).toEqual(['C1']);
  });
  it('markSmoked does not mutate its input', () => {
    const s = deepFreeze(emptySmokeState()); const t = markSmoked(s, ['A']);
    expect(s.smoked).toEqual([]); expect(t.smoked).toEqual(['A']);
  });
});
