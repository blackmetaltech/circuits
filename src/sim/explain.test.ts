// Explain-after-failure templates (DESIGN §7.3) and topology explainers (§3.10): each template filled from a solved state
// (built from netlist cards), the English it produces, and the locale / literal-string guards.
import { describe, expect, it } from 'vitest';
import { checkLocales, createI18n } from '@core/i18n';
import { compileNetlist } from './mna/compile';
import { parseNetlist } from './mna/netlist';
import { solveOp } from './mna/op';
import { elementCurrent, elementPower, nodeVoltage } from './mna/stamp';
import { checkRatings } from './ratings';
import { semiThermal, resistorThermal } from '../data/parts/util';
import type { RatedPart, Window } from './thermal';
import { simEn } from '../locales/sim.en';
import { ch4En } from '../locales/ch4.en';
import { ch5En } from '../locales/ch5.en';
import * as X from './explain';

const i18n = createI18n({ en: simEn });
const text = (e: X.Explained): string => { i18n.clearMissing(); const s = i18n.t(e.key, e.vars); expect(i18n.missingKeys(), e.key).toEqual([]); expect(i18n.missingVars(), e.key).toEqual([]); return s; };
const circ = (t: string, extra?: (nl: ReturnType<typeof parseNetlist>) => void) => { const nl = parseNetlist(t); extra?.(nl); const r = compileNetlist(nl); if (!r.ok) throw new Error(JSON.stringify(r.errors)); return r.circuit; };
const flat = (n: number, v: number): number[] => Array.from({ length: n }, () => v);

describe('number helpers', () => {
  it('sig rounds to significant figures; si picks the prefix', () => {
    expect(X.sig(0.61234)).toBe(0.612); expect(X.sig(1234.5)).toBe(1230); expect(X.sig(-3.6666)).toBe(-3.67); expect(X.sig(0)).toBe(0);
    expect(X.si(4700, 'Ω')).toBe('4.7 kΩ'); expect(X.si(0.004, 'A')).toBe('4 mA'); expect(X.si(910000, 'Ω')).toBe('910 kΩ'); expect(X.si(1e6, 'Ω')).toBe('1 MΩ'); expect(X.si(1.08, 's')).toBe('1.08 s');
  });
  it('nearestE12 snaps to the ordinary resistor series', () => { expect(X.nearestE12(466.7)).toBe(470); expect(X.nearestE12(7000)).toBe(6800); expect(X.nearestE12(1)).toBe(1); });
});

describe('templates filled from a solved state', () => {
  it('resistor overpower: 22 ohm across 3.67 V (netlist + ratings)', () => {
    const c = circ('V1 a 0 3.67\nR2 a 0 22'); const op = solveOp(c);
    const v = nodeVoltage(op.x, c.nodeIndex.a), p = elementPower(c, op.x, 'R2');
    const R: RatedPart = { id: 'R2', kind: 'R', ratings: { P: 0.25 }, thermal: resistorThermal(0.25, 8) };
    const rep = checkRatings({ netlist: c.netlist }, [R], { t: [0, 1], series: { 'p(R2)': flat(2, p), 'v(a,0)': flat(2, v), 'i(R2)': flat(2, v / 22) } }, { ta: 25 });
    const e = X.explainFailure(rep.findings[0], { resistance: { R2: 22 } });
    expect(e.key).toBe('explain.resistor.power');
    expect(e.vars).toMatchObject({ part: 'R2', p: 0.612, rated: 0.25, v: 3.67, r: '22 Ω', ratio: 2.4, rNext: 1, rEach: '44 Ω', pEach: 0.306 });
    expect(text(e)).toContain('R2 dissipated 0.612 W but is rated 0.25 W');
    expect(text(e)).toContain('P = I²R = (0.167 A)² × 22 Ω');
    expect(text(e)).toContain('two 44 Ω resistors in parallel share it (0.306 W each)');
  });
  it('LED overcurrent: LED straight across a 9 V battery with 1.7 ohm', () => {
    const c = circ('D1 a 0 LEDr\n.model LEDr led(is=1.19e-17 n=2 rs=9.9)', (nl) => nl.elements.push({ id: 'B1', kind: 'BAT', owner: 'p0', nodes: [1, 0], p: { emf: 9, r: 1.7 } }));
    const op = solveOp(c); expect(op.ok).toBe(true);
    const i = elementCurrent(c, op.x, 'D1'), vf = nodeVoltage(op.x, c.nodeIndex.a);
    const loop = { vSupply: 9, vForward: 2, rSource: 1.7, rLed: 10 };
    const e = X.explainLedOvercurrent({ part: 'D1', i, iRated: 0.03, loop });
    expect(i).toBeGreaterThan(0.1); expect(vf).toBeGreaterThan(1.5);
    expect(e.vars).toMatchObject({ iRated: 0.03, iWant: 0.015, rSeries: '470 Ω', rSource: 1.7 });
    // the first burn: the cause, KVL, the numbers of the actual failure, and NOT the answer
    expect(text(e)).toContain(`Burned: too much current, ${X.sig(i * 1000)} mA vs 30 mA max`); expect(text(e)).toContain('voltage law'); expect(text(e)).toContain('about 15 mA');
    expect(text(e)).not.toMatch(/470|R = /);
    // a repeat burn gets the worked formula
    const again = text(X.explainLedOvercurrent({ part: 'D1', i, iRated: 0.03, loop, prior: 1 }));
    expect(again).toContain('R = (9 V - 2 V) / 15 mA = about 470 Ω');
    // with a resistor in the loop the text says so (never "nothing else in the loop")
    const res = text(X.explainLedOvercurrent({ part: 'D1', i: 0.064, iRated: 0.03, loop: { ...loop, rRes: 100, rWhat: 'the 100 Ω ¼ W resistor' } }));
    expect(res).toContain('the 100 Ω ¼ W resistor'); expect(res).not.toMatch(/nothing else|nothing but/);
  });
  it('electrolytic overvoltage and reversed', () => {
    const e = X.explainElecOvervoltage({ part: 'C1', v: 17.1, vRated: 16 });
    expect(e.vars.vPick).toBe(25); expect(text(e)).toContain('C1 (16 V) saw 17.1 V');
    const r = X.explainElecReversed({ part: 'C3', v: -4.2 }); expect(text(r)).toContain('C3 had -4.2 V across it');
  });
  it('transistor active-region heating', () => {
    const e = X.explainBjtActive({ part: 'Q1', vce: 3.1, ic: 0.2, ib: 4e-3, pRated: 0.5 });
    expect(e.vars).toMatchObject({ p: 0.62, ib: '4 mA', ibNeeded: '20 mA', beta: 10 });
    expect(text(e)).toContain('sat at 3.1 V from collector to emitter while carrying 0.2 A, which is 0.62 W (rated 0.5 W)');
  });
  it('inductive kick', () => { const t = text(X.explainInductiveKick({ part: 'Q1', load: 'M1', vPeak: 64, vceo: 40 })); expect(t).toContain('spiked to 64 V'); expect(t).toContain('40 V'); expect(t).toContain('across M1'); });
  it('MOSFET under-driven', () => {
    const e = X.explainMosfetUnderdriven({ part: 'Q1', vgs: 3.3, vth: 2.1, id: 0.038, vds: 10.5, theta: 312.5 });
    expect(e.vars).toMatchObject({ id: '38 mA', p: 0.399, theta: 313 }); expect(text(e)).toContain('3.3 V on its gate');
  });
  it('regulator thermal', () => {
    const e = X.explainRegulatorThermal({ part: 'U1', vin: 15, vout: 5, i: 0.5, ta: 40, theta: 54 });
    expect(e.vars).toMatchObject({ p: 5, tj: 310, thetaNeeded: 17, tShutdown: 150 }); expect(text(e)).toContain('U1 burned 5 W: (15 - 5) V x 0.5 A');
  });
  it('op-amp slew and gain-bandwidth', () => {
    const s = X.explainSlew({ slew: 0.5, vPeak: 10, f: 50e3 }); expect(s.vars.needed).toBe(3.14); expect(text(s)).toContain('needs 3.14 V per microsecond');
    const g = X.explainGbw({ part: 'U1', gbw: 0.7e6, gain: 100, f: 20e3 });
    expect(g.vars).toMatchObject({ bw: '7 kHz', dB: -9.62, g2: 10, bw2: '70 kHz' }); expect(text(g)).toContain('700 kHz / 100 = 7 kHz');
  });
  it('loading: 5.6k / 3.3k divider from 9 V with a 10k load (solved)', () => {
    const c = circ('V1 in 0 9\nR1 in out 5.6k\nR2 out 0 3.3k\nRL out 0 10k');
    const loaded = nodeVoltage(solveOp(c).x, c.nodeIndex.out);
    const e = X.explainLoading({ r1: 5600, r2: 3300, rLoad: 10e3, vin: 9 });
    expect(e.vars).toMatchObject({ vUnloaded: 3.34, vLoaded: 2.76, rLower: '2.48 kΩ' });
    expect(e.vars.vLoaded).toBeCloseTo(loaded, 2); expect(text(e)).toContain('gives 3.34 V unloaded');
  });
  it('saturated at DC, both directions', () => {
    expect(X.explainDcSaturated({ node: 'OUT', v: 10.5, vp: 0.2, vm: 0 }).key).toBe('explain.dcSaturated.high');
    const lo = X.explainDcSaturated({ node: 'OUT', v: -10.5, vp: 0, vm: 0.2 }); expect(lo.key).toBe('explain.dcSaturated.low'); expect(text(lo)).toContain('OUT is stuck at -10.5 V');
  });
  it('oscillator dies', () => {
    const e = X.explainOscillatorDies({ f: 955, gain: 24, atten: 29, r: 10e3 });
    expect(e.vars).toMatchObject({ f: '955 Hz', loop: 0.83, rfMin: '290 kΩ' }); expect(text(e)).toContain('Loop gain at 955 Hz is 0.83');
  });
  it('band miss: probe loading (1 Meg x 1 uF, 10 Meg probe, 10 V)', () => {
    const e = X.explainBandMiss({ probe: 'OUT', level: 6.32, tCross: 1.08, tLo: 0.95, tHi: 1.05, r: 1e6, c: 1e-6, rProbe: 10e6, vSrc: 10 });
    expect(e.vars).toMatchObject({ t: '1.08 s', tau: '1 s', rth: '909 kΩ', vFinal: 9.09 }); expect(text(e)).toContain('final V = 9.09 V');
  });
  it('floating gate', () => { expect(text(X.explainFloatingGate({ part: 'Q1' }))).toContain('about 100 kΩ'); });
});

describe('failures from the solver and the topology check', () => {
  it('topology explainers: blocking first, info dropped, key and vars from the circuit', () => {
    const c = circ('V1 a 0 5\nV2 a 0 5\nR1 a 0 1k\nR2 x y 1k\nR3 y x 1k');
    const ex = X.explainTopology(c.issues);
    expect(ex.map((e) => e.key)).toEqual(['topo.vloop', 'topo.island']);
    expect(text(ex[0])).toContain('V1, V2'); expect(text(ex[1])).toContain('x, y');
  });
  it('shorted and cutset cases read as English', () => {
    const sh = X.explainTopology(circ('V1 a a 5\nR1 a 0 1k').issues); expect(sh.map((e) => e.key)).toContain('topo.shorted'); sh.forEach(text);
    const cs = X.explainTopology(circ('I1 0 n 2m\nR1 a 0 1k').issues); expect(cs.map((e) => e.key)).toContain('topo.cutset'); cs.forEach(text);
  });
  it('convergence / singular failures pass through with their own words', () => {
    const e = X.explainSolve({ code: 'noConverge', key: 'solve.noConverge', vars: { node: 'a', elements: 'D1, D2' }, nodes: ['a'], elements: ['D1', 'D2'] });
    expect(text(e)).toContain('D1, D2'); expect(text(e)).toContain('add');   // "Try adding a resistor here"
  });
  it('unknown failures and missing context fall through unchanged', () => {
    const f = { key: 'bench.level.fail', vars: { probe: 'p' } };
    expect(X.explainFailure(f)).toEqual(f);
    const g = { key: 'rating.resistor.power', vars: { part: 'R9', value: 1, limit: 0.5 } };
    expect(X.explainFailure(g)).toEqual(g);
  });
  it('smoke and rating keys map to explainers when the context is given', () => {
    const led = X.explainFailure({ key: 'smoke.led.die', vars: { part: 'D1', i: 0.6, iF: 0.03 } }, { led: { D1: { vSupply: 9, vForward: 2, rSource: 1.7, rLed: 10 } } });
    expect(led.key).toBe('explain.led.overcurrent.bare.first'); expect(led.vars.i).toBe(0.6);
    expect(X.explainFailure({ key: 'smoke.cap.over', vars: { part: 'C1', v: 20, vrated: 16 } }, { electrolytic: ['C1'] }).key).toBe('explain.cap.overvoltage');
    expect(X.explainFailure({ key: 'smoke.cap.reverse', vars: { part: 'C3', v: -4.2 } }).key).toBe('explain.cap.reversed');
    expect(X.explainFailure({ key: 'smoke.resistor', vars: { part: 'R2', P: 0.7, Prated: 0.25 } }, { resistance: { R2: 22 } }).key).toBe('explain.resistor.power');
  });
});

describe('locales', () => {
  const all: Record<string, string> = { ...simEn, ...ch4En, ...ch5En };   // chapters 4 and 5 keep their explainers in their own locale files
  const keys = Object.keys(all).filter((k) => k.startsWith('explain.'));
  it('every explain.* key is produced by explain.ts and every key it produces exists', async () => {
    const { readFileSync } = await import('node:fs'); const { fileURLToPath } = await import('node:url');
    const src = readFileSync(fileURLToPath(new URL('./explain.ts', import.meta.url)), 'utf8');
    const used = [...src.matchAll(/'(explain\.[A-Za-z0-9.]+)'/g)].map((m) => m[1]);
    for (const a of ['first', 'again']) for (const b of ['bridge', 'half']) used.push(`explain.rect.ripple.${a}.${b}`);   // composed in explain.ts as explain.rect.ripple.<first|again>.<bridge|half>
    expect([...new Set(used)].sort()).toEqual([...keys].sort());
  });
  it('every explain.* string has plain-words text and balanced placeholders; checkLocales is clean', () => {
    expect(keys.length).toBe(47 + Object.keys(ch4En).filter((k) => k.startsWith('explain.')).length + Object.keys(ch5En).filter((k) => k.startsWith('explain.')).length);
    expect(checkLocales({ en: all, fr: { ...all } }, 'en')).toEqual({ missing: [], extra: [], badPlaceholders: [] });
    for (const k of keys) expect(all[k].match(/\{/g)?.length, k).toBe(all[k].match(/\}/g)?.length);
  });
  it('the explainers name no currency, region or place', () => { for (const k of keys) expect(all[k], k).not.toMatch(/[$€£₹]/); });
  it('semiThermal fixture import is used (typecheck guard)', () => { expect(semiThermal(1, 100, 1).thetaJA).toBe(1); });
});
