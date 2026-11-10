// Unit tests for transient analysis, C / L devices and source waveforms (DESIGN §3.2, §3.5).
import { describe, expect, it } from 'vitest';
import { dmath } from '@core/numerics';
import { parseNetlist } from './netlist';
import { compileNetlist } from './compile';
import { solveOp } from './op';
import { AcCtx } from './stamp';
import { runTran, tranAdvance, tranInit, tranWork, type TranOptions, type TranState } from './tran';
import { pulse, pwl, sine, square, waveBreakpoints, waveValue } from './waveforms';
import { C as CAP } from './devices/c';
import { L as IND } from './devices/l';
import { DEVICES } from './devices';
import { interp } from '../oracles/tranUtil';
import type { Circuit, Device, Netlist } from './types';

const compile = (nl: Netlist, devs?: Record<string, Device>): Circuit => { const r = compileNetlist(nl, devs); if (!r.ok) throw new Error(JSON.stringify(r.errors)); return r.circuit; };
const cards = (s: string): Circuit => compile(parseNetlist(s));
const withWave = (nl: Netlist, id: string, wave: NonNullable<Netlist['elements'][number]['wave']>): Netlist => ({ ...nl, elements: nl.elements.map((e) => (e.id === id ? { ...e, wave } : e)) });

describe('waveforms', () => {
  it('sine: offset + amp·sin(2πft + phase), delay holds the t = 0 value', () => {
    const w = sine(2, 1000, Math.PI / 2, 1, 1e-3);
    expect(waveValue(w, 0)).toBeCloseTo(3, 12);
    expect(waveValue(w, 1e-3 + 0.25e-3)).toBeCloseTo(1 + 2 * dmath.sin(Math.PI), 9);
    expect(waveBreakpoints(w, 1)).toEqual([1e-3]);
    expect(waveValue(sine(1, 50), 0.005)).toBeCloseTo(1, 12);
  });
  it('pulse / square: edges, plateau, period; breakpoints list every edge', () => {
    const w = pulse(0, 5, 1e-3, { delay: 1e-3, rise: 1e-4, fall: 1e-4, period: 4e-3 });
    expect(waveValue(w, 0.5e-3)).toBe(0);
    expect(waveValue(w, 1e-3 + 0.5e-4)).toBeCloseTo(2.5, 12);
    expect(waveValue(w, 1.5e-3)).toBe(5);
    expect(waveValue(w, 1e-3 + 1.1e-3 + 0.5e-4)).toBeCloseTo(2.5, 9);
    expect(waveValue(w, 5e-3 + 0.5e-3)).toBe(5);       // second period
    const bp = waveBreakpoints(w, 6e-3);
    expect(bp.length).toBe(6);
    expect(bp.slice(0, 4)).toEqual([1e-3, 1e-3 + 1e-4, 1e-3 + 1e-4 + 1e-3, 1e-3 + 1e-4 + 1e-3 + 1e-4]);
    const sq = square(-1, 1, 1e-3, 0.5);
    expect(waveValue(sq, 0.25e-3)).toBe(1); expect(waveValue(sq, 0.75e-3)).toBe(-1);
  });
  it('pwl: interpolation, clamping, breakpoints', () => {
    const w = pwl([[0, 0], [1e-3, 2], [3e-3, -2]]);
    expect(waveValue(w, 0.5e-3)).toBeCloseTo(1, 12); expect(waveValue(w, 2e-3)).toBeCloseTo(0, 12); expect(waveValue(w, 1)).toBe(-2);
    expect(waveBreakpoints(w, 2e-3)).toEqual([1e-3]);
  });
});

describe('C and L devices', () => {
  it('DC OP: capacitor open, inductor short', () => {
    const op = solveOp(cards('V1 in 0 6\nR1 in a 1k\nC1 a 0 1u\nR2 a b 2k\nL1 b 0 1m'));
    expect(op.ok).toBe(true);
    // a = b = 0 (L short): i = 6/3k, V(a) = 4 V
    const nl = cards('V1 in 0 6\nR1 in a 1k\nC1 a 0 1u\nR2 a b 2k\nL1 b 0 1m');
    expect(op.x[nl.nodeIndex.a - 1]).toBeCloseTo(4, 6);
    expect(op.x[nl.nodeIndex.b - 1]).toBeCloseTo(0, 9);
  });
  it('AC stamps: jωC admittance; L branch row v − jωL·i = 0', () => {
    const ckt = cards('V1 in 0 1\nC1 in a 2u\nL1 a 0 3m');
    const ac = new AcCtx(ckt.dim), w = 1000;
    const c1 = ckt.elements[ckt.elementIndex.C1], l1 = ckt.elements[ckt.elementIndex.L1];
    CAP.stampAC!(c1, ac, w); IND.stampAC!(l1, ac, w);
    const ia = ckt.nodeIndex.a - 1, ii = ckt.nodeIndex.in - 1, k = l1.branch[0];
    expect(ac.Im[ii * ckt.dim + ii]).toBeCloseTo(w * 2e-6, 15);
    expect(ac.Im[ii * ckt.dim + ia]).toBeCloseTo(-w * 2e-6, 15);
    expect(ac.Re[ii * ckt.dim + ii]).toBe(0);
    expect(ac.Re[k * ckt.dim + ia]).toBe(1); expect(ac.Im[k * ckt.dim + k]).toBeCloseTo(-w * 3e-3, 15);
  });
  it('validate rejects non-positive values', () => {
    const nl = parseNetlist('C1 a 0 1u\nR1 a 0 1k'); nl.elements[0].p.c = 0;
    expect(compileNetlist(nl).ok).toBe(false);
    const nl2 = parseNetlist('L1 a 0 1m\nR1 a 0 1k'); nl2.elements[0].p.l = -1;
    expect(compileNetlist(nl2).ok).toBe(false);
  });
});

describe('runTran', () => {
  const rc = 'V1 in 0 5\nR1 in c 1k\nC1 c 0 1u';
  it('lands exactly on source breakpoints and restarts with BE', () => {
    const nl = withWave(parseNetlist('V1 in 0 0\nR1 in c 1k\nC1 c 0 1u'), 'V1', pulse(0, 5, 3.3e-4, { delay: 1.23e-4, rise: 2e-5, fall: 2e-5, period: 1e-3 }));
    const ckt = compile(nl), seen: { t: number; m: string }[] = [];
    const r = runTran(ckt, { h: 1e-5, tStop: 2e-3, probes: ['v(c)'], onStep: (s) => seen.push({ t: s.t, m: s.method }) });
    expect(r.ok).toBe(true);
    const bps = waveBreakpoints(nl.elements[0].wave!, 2e-3).concat([1e-6]);
    for (const b of bps) { const k = seen.findIndex((s) => s.t === b); expect(k, `breakpoint ${b}`).toBeGreaterThanOrEqual(0); if (k + 1 < seen.length) expect(seen[k + 1].m).toBe('BE'); }
    expect(seen[0].m).toBe('BE'); expect(seen.some((s) => s.m === 'TRAP')).toBe(true);
    expect(seen[seen.length - 1].t).toBe(2e-3);
  });
  it('power-on ramp: sources reach full value at 1 µs; start from DC OP has no ramp', () => {
    const ckt = cards(rc);
    const z = runTran(ckt, { h: 1e-7, tStop: 2e-6, probes: ['v(in)'] });
    expect(z.series['v(in)'][0]).toBe(0);
    expect(z.series['v(in)'][5]).toBeCloseTo(2.5, 9);        // t = 0.5 µs
    expect(z.series['v(in)'][z.t.length - 1]).toBeCloseTo(5, 9);
    const o = runTran(ckt, { h: 1e-5, tStop: 1e-4, ic: 'op', probes: ['v(in)', 'v(c)'] });
    expect(o.series['v(in)'][0]).toBeCloseTo(5, 9); expect(o.series['v(c)'].every((v) => Math.abs(v - 5) < 1e-6)).toBe(true);
  });
  it('explicit IC: capacitor voltage and inductor current seeded (t = 0 snapshot consistent)', () => {
    const r = runTran(cards('C1 a 0 1u\nR1 a 0 1k'), { h: 1e-6, tStop: 1e-3, ic: { C1: 3 }, probes: ['v(a)', 'i(C1)'] });
    expect(r.series['v(a)'][0]).toBeCloseTo(3, 6); expect(Math.abs(r.series['v(a)'][1] / 3 - dmath.exp(-1e-3)) ).toBeLessThan(1e-4);
    const l = runTran(cards('L1 a 0 1m\nR1 a 0 10'), { h: 1e-6, tStop: 1e-4, ic: { L1: 2 }, probes: ['i(L1)', 'v(a)'] });
    expect(l.series['i(L1)'][0]).toBeCloseTo(2, 6); expect(l.series['v(a)'][0]).toBeCloseTo(-20, 3);
  });
  it('decimate keeps every k-th sample plus the last', () => {
    const r = runTran(cards(rc), { h: 1e-5, tStop: 1e-3, decimate: 7, probes: ['v(c)'] });
    expect(r.t.length).toBe(1 + Math.floor(100 / 7) + 1); expect(r.t[r.t.length - 1]).toBeCloseTo(1e-3, 15);
  });
  it('current-source waveform into a capacitor: v = ∫i/C (PWL), source current reported', () => {
    const nl = withWave(parseNetlist('I1 0 c 0\nC1 c 0 1u\nR1 c 0 1g'), 'I1', pwl([[0, 1e-3], [1e-3, 1e-3], [2e-3, 0]]));
    const r = runTran(compile(nl), { h: 1e-5, tStop: 3e-3, probes: ['v(c)', 'i(I1)'] });
    const v = (t: number): number => interp(r.t, r.series['v(c)'], t);
    expect(v(1e-3)).toBeCloseTo(1, 2);                 // 1 mA · 1 ms / 1 µF
    expect(v(3e-3)).toBeCloseTo(1.5, 2);               // + ½·1 mA·1 ms
    expect(interp(r.t, r.series['i(I1)'], 1.5e-3)).toBeCloseTo(0.5e-3, 9);
  });
  it('sine source through RC settles to the AC magnitude (|H| = 1/√(1+(ωRC)²))', () => {
    const nl = withWave(parseNetlist('V1 in 0 0\nR1 in c 1k\nC1 c 0 1u'), 'V1', sine(1, 159.155));   // ωRC ≈ 1.0
    const r = runTran(compile(nl), { h: 1e-5, tStop: 0.05, probes: ['v(c)'] });
    let pk = 0; r.t.forEach((t, k) => { if (t > 0.03) pk = Math.max(pk, Math.abs(r.series['v(c)'][k])); });
    expect(pk).toBeCloseTo(1 / Math.sqrt(2), 3);
  });
  it('LTI reuse on/off give bit-identical results (and the cache factors rarely)', () => {
    const nl = withWave(parseNetlist('V1 in 0 0\nR1 in a 100\nL1 a c 10m\nC1 c 0 1u\nR2 c 0 5k'), 'V1', square(0, 3, 1e-3, 0.5, 1e-5));
    const o: TranOptions = { h: 2e-6, tStop: 4e-3, probes: ['v(c)', 'i(L1)'] };
    const a = runTran(compile(nl), { ...o, reuse: true }), b = runTran(compile(nl), { ...o, reuse: false });
    expect(a.series['v(c)']).toEqual(b.series['v(c)']); expect(a.series['i(L1)']).toEqual(b.series['i(L1)']);
  });
  it('resuming in chunks (state through JSON) is bit-identical to one long run', () => {
    const nl = withWave(parseNetlist('V1 in 0 0\nR1 in a 100\nL1 a c 10m\nC1 c 0 1u\nR2 c 0 5k'), 'V1', square(0, 3, 1e-3, 0.5, 1e-5));
    const ckt = compile(nl), o: TranOptions = { h: 3e-6, tStop: 3e-3, ic: { C1: 1, L1: 0.01 } };
    const full = runTran(ckt, { ...o, probes: ['v(c)'] });
    const init = tranInit(ckt, o); let st: TranState = init.st; const ys: number[] = [], ts: number[] = [];
    let guard = 0;
    while (!st.done && guard++ < 1000) {
      st = JSON.parse(JSON.stringify(st)) as TranState;      // what the game state would store
      const ws = tranWork(ckt, st);
      const k = 1 + (guard * 37) % 53;
      tranAdvance(ws, st, k, (s) => { ts.push(s.t); ys.push(s.x[ckt.nodeIndex.c - 1]); });
    }
    expect(st.done).toBe(true);
    expect(ts).toEqual(full.t.slice(1)); expect(ys).toEqual(full.series['v(c)'].slice(1));
    expect(st.stats.steps).toBe(full.stats.steps); expect(st.t).toBe(3e-3);
  });
});

// A fake nonlinear device whose Newton iteration only converges for steps h ≤ hOk inside t ∈ (100, 120) µs (it injects an alternating current otherwise).
function flaky(hOk: number): Record<string, Device> {
  let n = 0;
  const X: Device = {
    kind: 'X', terminals: 2, isLinear: false, branches: () => 0, internalNodes: () => 0,
    stampDC(e, c) { c.g(e.nodes[0], e.nodes[1], 1e-3); },
    stampTran(e, c, _m, h) {
      c.g(e.nodes[0], e.nodes[1], 1e-3);
      if (h > hOk * (1 + 1e-9) && c.time > 1e-4 && c.time < 1.2e-4) c.i(e.nodes[0], e.nodes[1], (n++ & 1 ? 1 : -1));
    },
    terminalCurrents: () => [0, 0], topo: () => ({ dc: [[0, 1]], ideal: [], forced: [] }),
  };
  return { ...DEVICES, X };
}
describe('step control on Newton failure', () => {
  const nl = (): Netlist => { const n = parseNetlist('V1 in 0 5\nR1 in a 1k\nC1 a 0 1u'); n.elements.push({ id: 'X1', kind: 'X', owner: '', nodes: [n.nodeNames.indexOf('a'), 0], p: {} }); return n; };
  it('halves h (≥ h₀/1024), grows back ×2 per step, and finishes', () => {
    const ckt = compile(nl(), flaky(2.5e-6));
    const hs: number[] = [];
    const r = runTran(ckt, { h: 1e-5, tStop: 3e-4, probes: ['v(a)'], onStep: (s) => hs.push(s.h) });
    expect(r.ok).toBe(true);
    expect(r.stats.rejected).toBeGreaterThan(0);
    expect(Math.min(...hs.slice(2))).toBeGreaterThanOrEqual(1e-5 / 1024 * 0.999);
    expect(hs.filter((h) => h === 1e-5).length).toBeGreaterThan(5);      // grew back to h₀
    // growth: steps never more than double
    for (let i = 3; i < hs.length - 1; i++) expect(hs[i + 1]).toBeLessThanOrEqual(2 * hs[i] * (1 + 1e-9) + 1e-12);
  });
  it('failure at the minimum step stops with an explanation, never throws', () => {
    const ckt = compile(nl(), flaky(1e-12));
    const r = runTran(ckt, { h: 1e-5, tStop: 3e-4, probes: ['v(a)'] });
    expect(r.ok).toBe(false);
    expect(r.failure?.key).toBe('tran.noConverge');
    expect(r.failure?.vars.t).toBeDefined();
    expect(r.t.length).toBeGreaterThanOrEqual(1);
  });
});
