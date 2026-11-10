// Unit tests of the behavioural macros (DESIGN §3.5, §3.7): 555, comparator, relay, fuse, NTC, regulator thermal shutdown, pot / slide wire expanders,
// event refinement (timing independent of the step), dual op-amp expansion.
import { describe, expect, it } from 'vitest';
import { parseNetlist, EXPANDERS, type ExpandCtx } from './netlist';
import { compileNetlist } from './compile';
import { solveOp } from './op';
import { nodeVoltage } from './stamp';
import { runTran } from './tran';
import { pwl } from './waveforms';
import { ntcResistance } from './devices/ntc';
import { tranCards } from '../oracles/tranUtil';
import { near } from '../oracles/util';
import { lm358, lm741, lm393, ne555, lm7805, lm317 } from '../../data/parts/ics';
import { relay, fuse as fuseDef, ntc as ntcDef, slidewire } from '../../data/parts/misc';
import { potTrim } from '../../data/parts/resistors';
import type { PartDef } from '../../data/parts/types';
import type { PlacedPart } from '../board/types';
import type { Netlist } from './types';

const risingEdges = (t: number[], y: number[], level: number): number[] => {
  const out: number[] = [];
  for (let k = 1; k < y.length; k++) if (y[k - 1] < level && y[k] >= level) out.push(t[k - 1] + ((level - y[k - 1]) / (y[k] - y[k - 1])) * (t[k] - t[k - 1]));
  return out;
};
const withWave = (nl: Netlist, id: string, wave: NonNullable<Netlist['elements'][number]['wave']>): Netlist => ({ ...nl, elements: nl.elements.map((e) => (e.id === id ? { ...e, wave } : e)) });

describe('555 astable', () => {
  const NET = (r1: string, r2: string, c: string): string => `V1 vcc 0 5\nR1 vcc d ${r1}\nR2 d t ${r2}\nC1 t 0 ${c}\nU1 0 t out vcc cv t d vcc ne555\n.model ne555 555 ()`;
  const freq = (h: number, r1: string, r2: string, c: string, tStop: number): number => {
    const r = tranCards(NET(r1, r2, c), { h, tStop, probes: ['v(out)'] });
    const e = risingEdges(r.t, r.y('v(out)'), 2.5).slice(1);
    return (e.length - 1) / (e[e.length - 1] - e[0]);
  };
  it('f = 1.44/((R1 + 2·R2)·C) within 2 % (4.7k, 47k, 100 nF)', () => {
    near(freq(1e-5, '4.7k', '47k', '100n', 0.05), 1.44 / ((4.7e3 + 2 * 47e3) * 100e-9), 0.02);
  });
  it('event refinement: the frequency barely depends on the step (h = 20 µs vs 2 µs: < 0.2 %)', () => {
    const f1 = freq(2e-5, '4.7k', '47k', '100n', 0.05), f2 = freq(2e-6, '4.7k', '47k', '100n', 0.05);
    near(f1, f2, 2e-3);
  });
  it('RESET low holds the output low and the timer stops', () => {
    const r = tranCards(NET('1k', '10k', '10n').replace('U1 0 t out vcc cv t d vcc', 'U1 0 t out rs cv t d vcc') + '\nVr rs 0 0', { h: 2e-7, tStop: 3e-4, probes: ['v(out)'] });
    expect(Math.max(...r.y('v(out)').slice(5))).toBeLessThan(0.5);
  });
});

describe('comparator (open collector) hysteresis', () => {
  // in− = Vin; in+ = divider of Vref 2.5 V (R1 10k) and OUT (Rf 100k); 10k pull-up to 5 V
  const cards = (vin: number): string => `Vcc vcc 0 5\nVref ref 0 2.5\nVin in 0 ${vin}\nR1 ref ip 10k\nRf out ip 100k\nRp vcc out 10k\nU1 ip in out vcc 0 cmp\n.model cmp cmp ()`;
  const op = (vin: number, x0?: Float64Array) => {
    const c = compileNetlist(parseNetlist(cards(vin)));
    if (!c.ok) throw new Error('compile');
    const o = solveOp(c.circuit, { x0 });
    if (!o.ok) throw new Error('OP ' + vin);
    return { x: o.x, out: nodeVoltage(o.x, c.circuit.nodeIndex.out), ip: nodeVoltage(o.x, c.circuit.nodeIndex.ip) };
  };
  const flip = (from: number, to: number, step: number): { vin: number; before: number } => {
    let x0: Float64Array | undefined, prev = NaN;
    for (let v = from; step > 0 ? v <= to : v >= to; v += step) {
      const o = op(v, x0); x0 = o.x;
      if (!Number.isNaN(prev) && (o.out > 2.5) !== (prev > 2.5)) return { vin: v, before: o.ip };
      prev = o.out;
    }
    throw new Error('no flip');
  };
  it('levels: high ≈ 5 V (pull-up), low ≈ 0 V; thresholds differ by the feedback hysteresis', () => {
    expect(op(1).out).toBeGreaterThan(4.7); expect(op(4).out).toBeLessThan(0.3);
    const up = flip(1.5, 3.5, 0.005), dn = flip(3.5, 1.5, -0.005);
    const hi = op(1).ip, lo = op(4).ip;                 // + input with OUT high / low
    near(up.vin, hi, 0.01); near(dn.vin, lo, 0.01);
    expect(up.vin - dn.vin).toBeGreaterThan(0.3);
    near(hi - lo, ((op(1).out - op(4).out) * 10) / 110, 0.01);   // ΔVout·R1/(R1 + Rf)
  });
});

describe('relay: pull-in / drop-out hysteresis', () => {
  // coil from a PWL source 0 → 12 V → 0; COM at 5 V, NO loaded by 1k: v(no) = 5 V while operated. Ipull 40 mA·200 Ω = 8 V, Idrop 15 mA·200 Ω = 3 V.
  it('operates at 8 V rising and releases at 3 V falling (events located by crossing refinement)', () => {
    const nl = withWave(parseNetlist('Vc a 0 0\nVs com 0 5\nU1 a 0 com no nc rl\nRn no 0 1k\nRc nc 0 1k\n.model rl relay ()'), 'Vc', pwl([[0, 0], [0.05, 12], [0.1, 0]]));
    const c = compileNetlist(nl);
    if (!c.ok) throw new Error('compile');
    const r = runTran(c.circuit, { h: 5e-5, tStop: 0.1, probes: ['v(no)', 'v(nc)'] });
    expect(r.ok).toBe(true);
    const no = r.series['v(no)'], t = r.t;
    const up = risingEdges(t, no, 2.5), dn = risingEdges(t, no.map((v) => -v), -2.5);
    expect(up.length).toBe(1); expect(dn.length).toBe(1);
    near(up[0], (8 / 12) * 0.05, 0.03);                 // 33.3 ms (+ coil lag L/R = 0.5 ms)
    near(dn[0], 0.05 + (1 - 3 / 12) * 0.05, 0.02);      // 87.5 ms
    expect(no[0]).toBeLessThan(0.1);                    // released at the start: NO open
    const nc = r.series['v(nc)'];
    expect(nc[1]).toBeGreaterThan(4.9);                              // released: COM–NC closed (50 mΩ)
    expect(nc[Math.round(0.05 / 5e-5)]).toBeLessThan(0.01);          // operated at the 12 V peak: NC open
    expect(nc[t.length - 1]).toBeGreaterThan(4.9);                   // released again
  });
});

describe('fuse I²t', () => {
  const run = (rl: string, tStop: number, h: number) => tranCards(`V1 a 0 12\nU1 a b fz\nRl b 0 ${rl}\n.model fz fuse (irated=1)`, { h, tStop, probes: ['i(U1)'] });
  it('does not blow at 0.9 A for 0.5 s', () => {
    const r = run('13.17', 0.5, 5e-4); expect(Math.abs(r.y('i(U1)')[r.t.length - 1])).toBeGreaterThan(0.85);
  });
  it('blows when the I²t window is exceeded: 8.9 A opens after −τ·ln(1 − (Ir/I)²) = 0.637 ms', () => {
    const r = run('1.2', 4e-3, 5e-6), i = r.y('i(U1)');
    const I = 12 / 1.35, tb = -0.05 * Math.log(1 - 1 / (I * I));
    const k = i.findIndex((v, n) => n > 10 && v < 1e-3);
    near(r.t[k], tb, 0.03);
    expect(Math.abs(i[i.length - 1])).toBeLessThan(1e-6);
  });
});

describe('NTC thermistor R(T) = R25·exp(B(1/T − 1/298.15))', () => {
  it('curve: 25 °C = R25; 0 / 50 / 100 °C for B = 3950', () => {
    expect(ntcResistance(10e3, 3950, 25)).toBeCloseTo(10e3, 6);
    near(ntcResistance(10e3, 3950, 0), 33620.6, 1e-5); near(ntcResistance(10e3, 3950, 50), 3588.18, 1e-5); near(ntcResistance(10e3, 3950, 100), 697.52, 1e-5);
  });
  it('the catalogue expander emits a resistor at the environment temperature (default 25 °C)', () => {
    const part = { uid: 'p1', partId: 'ntc-10k', value: null, variant: 'B3950', x: 0, y: 0, rot: 0, flip: false } as PlacedPart;
    const ex = EXPANDERS.NTC!;
    expect(ex({ part, def: ntcDef, nodes: [1, 2] })[0].p.r).toBeCloseTo(10e3, 6);
    near(ex({ part, def: ntcDef, nodes: [1, 2], env: { tempC: 50 } })[0].p.r, 3588.18, 1e-5);
  });
});

describe('regulator thermal shutdown', () => {
  // 15 V into a short: P = 15·2.1 = 31.5 W, θ 54 °C/W, τ 2 ms (the part's 60 s scaled down for the test): Tj rises 125 K in ~0.15 ms, shuts down at 150 °C,
  // cools to 135 °C and resumes: an overheated regulator visibly cycles. Cycle = on 19 µs + off 0.26 ms.
  it('output current cycles on/off between 150 °C and 135 °C', () => {
    const r = tranCards('Vin in 0 15\nU1 in 0 out r5\nRs out 0 10m\n.model r5 reg (vreg=5 vdo=2 ilim=2.1 iqgnd=5m tau=2m thetaja=54 ta=25)', { h: 2e-6, tStop: 5e-3, probes: ['i(U1)'] });
    const i = r.y('i(U1)'), on = risingEdges(r.t, i, 1);
    expect(on.length).toBeGreaterThanOrEqual(10);
    const period = (on[on.length - 1] - on[1]) / (on.length - 2);
    near(period, 2e-3 * Math.log((54 * 15 * 0.005 * 0 + 125 - 4.05) / (110 - 4.05)) + 2e-3 * Math.log((54 * 31.5 - 110) / (54 * 31.5 - 125)), 0.05);
    expect(Math.max(...i)).toBeGreaterThan(2);                       // full short-circuit current when running
    expect(Math.min(...i.slice(50))).toBeLessThan(0.01);             // only Iq flows while shut down
  });
  it('without a short the regulator stays on (no events)', () => {
    const r = tranCards('Vin in 0 9\nU1 in 0 out r5\nRl out 0 10\n.model r5 reg (vreg=5 vdo=2 ilim=2.1 iqgnd=5m tau=2m thetaja=54 ta=25)', { h: 1e-5, tStop: 3e-3, probes: ['v(out)'] });
    expect(Math.min(...r.y('v(out)').slice(300))).toBeGreaterThan(4.9);
  });
});

describe('expanders', () => {
  const ctx = (def: PartDef, nodes: number[], extra: Partial<PlacedPart> = {}): ExpandCtx =>
    ({ part: { uid: 'u1', partId: def.id, value: null, variant: def.variants[0]?.id ?? '', x: 0, y: 0, rot: 0, flip: false, ...extra } as PlacedPart, def, nodes });
  it('LM741 → one OA with the catalogue numbers (A0 2e5, GBW 1e6, SR 0.5 V/µs, Rin 2 MΩ, Isc 25 mA, heads 2 V)', () => {
    const els = EXPANDERS.OPAMP!(ctx(lm741, [1, 2, 3, 4, 5, 6, 7, 8]));
    expect(els.length).toBe(1); expect(els[0].id).toBe('u1'); expect(els[0].kind).toBe('OA');
    expect(els[0].nodes).toEqual([3, 2, 6, 7, 4]);                  // IN+ IN- OUT V+ V-
    expect(els[0].p).toMatchObject({ a0: 2e5, gbw: 1e6, sr: 0.5e6, rin: 2e6, isc: 0.025, headhi: 2, headlo: 2 });
  });
  it('LM358 dual → two OA channels sharing the package Iq; footLo becomes headLo', () => {
    const els = EXPANDERS.OPAMP!(ctx(lm358, [1, 2, 3, 4, 5, 6, 7, 8]));
    expect(els.map((e) => e.id)).toEqual(['u1.1', 'u1.2']);
    expect(els[0].nodes).toEqual([3, 2, 1, 8, 4]); expect(els[1].nodes).toEqual([5, 6, 7, 8, 4]);
    expect(els[0].p.iq).toBeCloseTo(0.35e-3, 12); expect(els[0].p.headlo).toBe(0.005); expect(els[0].p.headhi).toBe(1.5);
  });
  it('LM393 dual → two CMP; NE555 → TMR in catalogue pin order', () => {
    expect(EXPANDERS.CMP!(ctx(lm393, [1, 2, 3, 4, 5, 6, 7, 8])).map((e) => [e.kind, e.nodes])).toEqual([['CMP', [3, 2, 1, 8, 4]], ['CMP', [5, 6, 7, 8, 4]]]);
    const t = EXPANDERS['555']!(ctx(ne555, [1, 2, 3, 4, 5, 6, 7, 8]))[0];
    expect(t.kind).toBe('TMR'); expect(t.nodes).toEqual([1, 2, 3, 4, 5, 6, 7, 8]); expect(t.p.icc5).toBe(2e-3); expect(t.p.icc15).toBe(9e-3);
  });
  it('7805: ref = GND, Vreg 5, Isc 2.1, Iq 5 mA to GND; LM317: ref = ADJ, Vref 1.25, Iadj 50 µA, 3.5 mA injected into OUT; thermal from the variant', () => {
    const a = EXPANDERS.REG!(ctx(lm7805, [1, 2, 3]))[0], b = EXPANDERS.REG!(ctx(lm317, [1, 2, 3]))[0];
    expect(a.nodes).toEqual([1, 2, 3]); expect(a.p).toMatchObject({ vreg: 5, vdo: 2, ilim: 2.1, iqgnd: 5e-3, iqout: 0, thetaja: 54, tau: 60, tshut: 150, thyst: 15 });
    expect(b.nodes).toEqual([3, 1, 2]); expect(b.p).toMatchObject({ vreg: 1.25, iadj: 50e-6, iqout: 3.5e-3, iqgnd: 0, ilim: 1.5, thetaja: 37.9 });
  });
  it('relay and fuse from the catalogue; fuse takes Irated from the variant', () => {
    const r = EXPANDERS.RELAY!(ctx(relay, [1, 2, 3, 4, 5]))[0];
    expect(r.kind).toBe('RLY'); expect(r.p).toMatchObject({ rcoil: 200, lcoil: 0.1, ipull: 0.04, idrop: 0.015, ron: 0.05, roff: 1e9 });
    const f = EXPANDERS.FUSE!(ctx(fuseDef, [1, 2], { variant: '0.4A' }))[0];
    expect(f.kind).toBe('FUSE'); expect(f.p).toMatchObject({ irated: 0.4, window: 0.05 });
  });
  it('pot: the 0.5 % end resistance stops a 0 Ω exploit; slide wire: continuous jockey', () => {
    const pw = (pos: number) => EXPANDERS.POT!(ctx(potTrim, [1, 2, 3], { value: 1000, pos }));
    expect(pw(0).map((e) => e.p.r)).toEqual([5, 995]); expect(pw(1)[0].p.r).toBe(995); expect(pw(1)[1].p.r).toBeCloseTo(5, 12);
    expect(pw(0.25).map((e) => e.p.r)).toEqual([250, 750]);
    const sw = (pos: number) => EXPANDERS.SLIDEWIRE!(ctx(slidewire, [1, 2, 3], { pos })).map((e) => e.p.r);
    expect(sw(0.4)).toEqual([4, 6]); expect(sw(0)[0]).toBe(1e-6); expect(sw(1)[1]).toBe(1e-6);
  });
});

describe('logic pin', () => {
  it('v behind Ro 25 Ω: 5 V into 75 Ω gives 3.75 V and 50 mA; the pin current is reported', () => {
    const c = compileNetlist(parseNetlist('U1 p 0 lg\nRl p 0 75\n.model lg logic (v=5)'));
    if (!c.ok) throw new Error('compile');
    const op = solveOp(c.circuit);
    near(nodeVoltage(op.x, c.circuit.nodeIndex.p), 3.75, 1e-9);
    const e = c.circuit.elements[0];
    near(-e.dev.terminalCurrents(e, op.x, [])[0], 0.05, 1e-9);
  });
});
