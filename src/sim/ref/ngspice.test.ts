// NODE vs ngspice-47 reference decks (DESIGN §9.2): diode decks 01-05, 09 and 14 (4-1 wall wart). Tolerance: max |NODE - ngspice| <= 0.5 % of the
// reference signal range, on a common grid (transientError.fraction). The CSVs in tests/ref are committed; CI needs no ngspice.
//
// Models: every .model line is PARSED FROM scripts/ngspice-ref/common.inc, so NODE and ngspice run the identical numbers. For the parts that
// exist in the catalogue (1N4007, 5.1 V Zener, red LED) the test also asserts the catalogue model equals the deck model, so the decks cannot
// drift from src/data/parts again. 1N4148 (deck 01) is the exception: the deck still carries the DESIGN recall (Is 2.52n N 1.752 Rs 0.568),
// the catalogue has since been re-fitted (Is 4.47n N 1.92 Rs 0.35); the comparison here is solver-vs-solver, so it uses the deck numbers.
// ZENER decks (04): the forward Is 1e-14 / N 1 are ESTIMATES (the catalogue has none; NODE falls back to the same diode defaults), and Rs 6.47 is
// a fit to Zzt; only BV / Ibv / Rs are datasheet-derived.
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { column, interp, parseCsv, transientError, type Csv, type Series } from './compare';
import { parseNetlist } from '../mna/netlist';
import { compileNetlist } from '../mna/compile';
import { solveOp } from '../mna/op';
import { runTran } from '../mna/tran';
import { elementCurrent, nodeVoltage } from '../mna/stamp';
import { pwl, sine } from '../mna/waveforms';
import { partById } from '../../data/parts';
import type { Netlist } from '../mna/types';

const ROOT = fileURLToPath(new URL('../../../', import.meta.url));
const csv = (name: string): Csv => parseCsv(readFileSync(`${ROOT}tests/ref/${name}.csv`, 'utf8'));
const TOL = 0.005; // DESIGN §9.2: 0.5 % of signal range

// ---------------------------------------------------------------- deck models
const SUFFIX: Record<string, number> = { f: 1e-15, p: 1e-12, n: 1e-9, u: 1e-6, m: 1e-3, k: 1e3 };
const num = (s: string): number => { const m = /^([-+0-9.eE]+?)([fpnumk]?)$/.exec(s.trim()); if (!m) throw new Error('bad number ' + s); return Number(m[1]) * (SUFFIX[m[2]] ?? 1); };
const deckModels = (): Record<string, Record<string, number>> => {
  const out: Record<string, Record<string, number>> = {};
  for (const m of readFileSync(`${ROOT}scripts/ngspice-ref/common.inc`, 'utf8').matchAll(/^\.model\s+(\w+)\s+D\((.*)\)\s*$/gim)) {
    const p: Record<string, number> = {};
    for (const kv of m[2].trim().split(/\s+/)) { const [k, v] = kv.split('='); p[k.toLowerCase()] = num(v); }
    out[m[1].toUpperCase()] = p;
  }
  return out;
};
const MODELS = deckModels();
/** `.model` card for NODE from a deck model (NODE implements is n rs bv ibv nbv; breakdown only where bv < 1e20). */
const card = (name: string): string => {
  const p = MODELS[name.toUpperCase()]; if (!p) throw new Error('no deck model ' + name);
  const keys = ['is', 'n', 'rs', ...(p.bv < 1e20 ? ['bv', 'ibv', 'nbv'] : [])];
  return `.model ${name.toLowerCase()} d (${keys.filter((k) => p[k] !== undefined).map((k) => `${k}=${p[k]}`).join(' ')})`;
};

describe('deck models match the catalogue where the part exists', () => {
  const same = (deck: string, part: string, keys: string[]): void => {
    const m = partById(part).model, d = MODELS[deck];
    for (const k of keys) {
      const cat = m[k[0].toUpperCase() + k.slice(1)] ?? m[k.toUpperCase()];
      expect(Math.abs(cat - d[k]) / Math.abs(d[k]), `${part}.${k}: catalogue ${cat} vs deck ${d[k]}`).toBeLessThan(1e-12);
    }
  };
  it('1N4007: Vishay line (Is, N, Rs, BV, Ibv)', () => same('D1N4007', '1n4007', ['is', 'n', 'rs', 'bv', 'ibv']));
  it('red LED: Is, N, Rs', () => same('DLEDRED', 'led-red-5mm', ['is', 'n', 'rs']));
  it('5.1 V Zener: BV, Ibv, Rs (forward Is 1e-14 / N 1 are estimates in the deck, defaults in NODE)', () => same('DZ5V1', '1n4733a', ['bv', 'ibv', 'rs']));
});

// ---------------------------------------------------------------- runners
function compile(cards: string, waves: Record<string, ReturnType<typeof sine>> = {}): ReturnType<typeof compileOk> {
  const nl = parseNetlist(cards);
  for (const [id, w] of Object.entries(waves)) nl.elements.find((e) => e.id === id)!.wave = w;
  return compileOk(nl);
}
function compileOk(nl: Netlist) { const r = compileNetlist(nl); if (!r.ok) throw new Error(JSON.stringify(r.errors)); return r.circuit; }

function tran(cards: string, waves: Record<string, ReturnType<typeof sine>>, o: Parameters<typeof runTran>[1]) {
  const r = runTran(compile(cards, waves), o);
  if (!r.ok) throw new Error('tran failed: ' + JSON.stringify(r.failure));
  return (p: string): Series => ({ x: r.t, y: r.series[p] });
}

/** DC sweep with continuation: [vin, v(out node), i(element)] per point. */
function sweep(cards: string, src: string, vmax: number, step: number, node: string, branchEl: string) {
  const ckt = compile(cards);
  const e = ckt.elements.find((c) => c.el.id === src)!;
  const n = Math.round(vmax / step), xs: number[] = [], v: number[] = [], i: number[] = [];
  let x0: Float64Array | undefined;
  for (let k = 0; k <= n; k++) {
    e.el.p.v = k * step;
    const op = solveOp(ckt, { x0 });
    if (!op.ok) throw new Error(`sweep failed at ${k * step} V: ${JSON.stringify(op.failure)}`);
    x0 = op.x; xs.push(k * step); v.push(nodeVoltage(op.x, ckt.nodeIndex[node])); i.push(elementCurrent(ckt, op.x, branchEl));
  }
  return { v: { x: xs, y: v } as Series, i: { x: xs, y: i } as Series };
}

/** NODE is sampled AT the reference's own x values (its fine internal grid is linearly interpolated there), so both series then share one grid and the
 *  harness's own linear interpolation error cancels. Without this the coarse ngspice CSV (100 us grid on a 11 V peak with ~ms curvature, deck 02)
 *  is compared with NODE's true curve and shows a 4 mV (1 % of the 0.44 V ripple) PLOTTING artifact: at the CSV's own points NODE agrees to 1e-7 V. */
function check(what: string, ref: Series, nodeRaw: Series, window?: [number, number]): void {
  const test: Series = { x: ref.x, y: ref.x.map((x) => interp(nodeRaw.x, nodeRaw.y, x)) };
  const r = transientError(ref, test, { window, points: 4000 });
  if (process.env.ORACLE_LOG) console.log(`NGSPICE ${what}: maxAbs ${r.maxAbs.toExponential(3)} range ${r.range.toPrecision(4)} fraction ${(100 * r.fraction).toFixed(4)} % at ${r.at}`);
  expect(r.fraction, `${what}: max |d| ${r.maxAbs} over range ${r.range} at x = ${r.at}`).toBeLessThanOrEqual(TOL);
}
const ref = (c: Csv, xk: number | string, yk: number | string): Series => ({ x: column(c, xk), y: column(c, yk) });

describe('NODE vs ngspice-47: diode decks (0.5 % of range)', () => {
  it('01 diode clipper: 5 V 1 kHz, 1 k, anti-parallel 1N4148 (deck values), from the DC OP', () => {
    const c = csv('01-diode-clipper');
    const s = tran(`${card('D1N4148')}\nV1 in 0 0\nR1 in out 1k\nD1 out 0 d1n4148\nD2 0 out d1n4148`, { V1: sine(5, 1e3) }, { h: 1e-6, tStop: 1.999e-3, ic: 'op', probes: ['v(out)', 'v(in)'] });
    check('01 v_out', ref(c, 'time_s', 'v_out_V'), s('v(out)'));
    check('01 v_in', ref(c, 'time_s', 'v_in_V'), s('v(in)'));
  }, 60000);

  it('02 half-wave: 12 V pk 50 Hz, catalogue 1N4007, 470 uF, 1 k; power-on, window 4.8-5 s', () => {
    const c = csv('02-halfwave');
    const s = tran(`${card('D1N4007')}\nV1 in 0 0\nD1 in out d1n4007\nC1 out 0 470u\nR1 out 0 1k`, { V1: sine(12, 50) }, { h: 20e-6, tStop: 5, probes: ['v(out)', 'v(in)'] });
    check('02 v_out', ref(c, 'time_s', 'v_out_V'), s('v(out)'), [4.8, 4.9999]);
    check('02 v_in', ref(c, 'time_s', 'v_in_V'), s('v(in)'), [4.8, 4.9999]);
  }, 300000);

  // h = 50 us: NODE FAILS this floating bridge with 'singular' at the first zero crossing (t = 11 ms) for every h <= 40 us (see report: LU pivot floor
  // 1e-14*max|A| with max|A| = 2C/h is at gmin 1e-12 for the floating diode nodes). Deck 14 (also floating) passes at 40 us.
  const bridge = `${card('D1N4007')}\nV1 sp sn 0\nRw sp a 1.5\nD1 a out d1n4007\nD2 sn out d1n4007\nD3 0 a d1n4007\nD4 0 sn d1n4007\nC1 out 0 1000u\nRL out 0 150`;
  it('03a bridge inrush: 17 V pk 50 Hz behind 1.5 ohm, catalogue 1N4007 x4, 1000 uF, 150 ohm; power-on 0-100 ms', () => {
    const c = csv('03-bridge-inrush');
    const s = tran(bridge, { V1: sine(17, 50) }, { h: 50e-6, tStop: 99.95e-3, probes: ['v(out)', 'i(V1)'] });
    check('03a v_out', ref(c, 'time_s', 'v_out_V'), s('v(out)'));
    const i = s('i(V1)'); // ngspice i_src = -i(Vin): current leaving the + terminal
    check('03a i_src', ref(c, 'time_s', 'i_src_A'), { x: i.x, y: i.y.map((v) => -v) });
  }, 120000);
  it('03b bridge settled: window 1.9-2 s', () => {
    const c = csv('03-bridge-settled');
    const s = tran(bridge, { V1: sine(17, 50) }, { h: 50e-6, tStop: 1.99995, probes: ['v(out)', 'i(V1)'] });
    check('03b v_out', ref(c, 'time_s', 'v_out_V'), s('v(out)'), [1.9, 1.99995]);
    const i = s('i(V1)');
    check('03b i_src', ref(c, 'time_s', 'i_src_A'), { x: i.x, y: i.y.map((v) => -v) }, [1.9, 1.99995]);
  }, 300000);

  it('04 Zener shunt (ESTIMATED forward Is 1e-14 / N 1): 220 ohm + 5.1 V Zener, Vin 0-20 V', () => {
    const c = csv('04-zener-shunt');
    const s = sweep(`${card('DZ5V1')}\nV1 in 0 0\nR1 in out 220\nDZ 0 out dz5v1`, 'V1', 20, 0.05, 'out', 'R1');
    check('04 v_out', ref(c, 'vin_V', 'v_out_V'), s.v);
    check('04 i_in', ref(c, 'vin_V', 'i_in_A'), s.i);
  });

  it('05 red LED + 150 ohm, 0-5 V', () => {
    const c = csv('05-led-iv');
    const s = sweep(`${card('DLEDRED')}\nV1 in 0 0\nR1 in a 150\nD1 a 0 dledred`, 'V1', 5, 0.025, 'a', 'R1');
    check('05 v_led', ref(c, 'v_src_V', 'v_led_V'), s.v);
    check('05 i', ref(c, 'v_src_V', 'i_A'), s.i);
  });

  it('09 RLC step (TR-03): 10 V in a 1 us ramp, 20 ohm, 10 mH, 10 uF', () => {
    const c = csv('09-rlc-step');
    const s = tran('V1 in 0 0\nR1 in a 20\nL1 a b 10m\nC1 b 0 10u', { V1: pwl([[0, 0], [1e-6, 10]]) }, { h: 2.5e-6, tStop: 4.9975e-3, ramp: false, probes: ['v(b)', 'i(L1)'] });
    check('09 v_cap', ref(c, 'time_s', 'v_cap_V'), s('v(b)'));
    check('09 i_L', ref(c, 'time_s', 'i_L_A'), s('i(L1)'));
  });

  it('14 wall wart (4-1): 230 V rms xfmr 230:12 (device T), 1.5 ohm winding, 4x 1N4007, 1000 uF, 100 mA CC load; window 0.4-0.48 s', () => {
    const c = csv('14-bridge-transformer');
    const n = 230 / 12;
    const s = tran(`${card('D1N4007')}\nV1 p 0 0\nT1 p 0 se sn ${n}\nRw se sp 1.5\nD1 sp out d1n4007\nD2 sn out d1n4007\nD3 0 sp d1n4007\nD4 0 sn d1n4007\nC1 out 0 1000u\nI1 out 0 0.1`,
      { V1: sine(325.269119, 50) }, { h: 40e-6, tStop: 0.47996, probes: ['v(out)', 'v(sp,sn)', 'i(Rw)'] });
    check('14 v_out', ref(c, 'time_s', 'v_out_V'), s('v(out)'), [0.4, 0.47996]);
    check('14 v_sec', ref(c, 'time_s', 'v_sec_V'), s('v(sp,sn)'), [0.4, 0.47996]);
    check('14 i_sec', ref(c, 'time_s', 'i_sec_A'), s('i(Rw)'), [0.4, 0.47996]);
  }, 300000);
});
