// Play-test C3-1: (1) wires join ONLY at their two ends: crossing / running alongside never joins, and the drawing data says exactly what is joined; (2) a bridge with no real
// balance is diagnosed, never "balances at l"; the slip's formula follows the side R is on.
import { describe, expect, it } from 'vitest';
import { Engine } from '@core/kit';
import { GAME } from '../game';
import { LEVEL_DEFS } from '../data/levels';
import { buildConnectivity } from '../sim/board/connectivity';
import { getDef } from './board';
import { clearFaultActions, refActions } from './replay';
import { newTicketProgress, type NodeState } from './state';

const def = (id: string) => LEVEL_DEFS.find((d) => d.id === id)!;
function open(id: string, passed: string[]): Engine<NodeState> {
  const e = new Engine(GAME, { mode: 'learner' }); e.autosave = false;
  const st = structuredClone(e.state) as NodeState;
  for (const d of passed) st.progress.tickets[d] = { ...newTicketProgress(), passed: true, stars: 1 };
  e.setState(st);
  expect(e.act('openTicket', [id]).ok, `open ${id}`).toBe(true);
  return e;
}
const st = (e: Engine<NodeState>): NodeState => e.state as NodeState;
const ok = (e: Engine<NodeState>, name: string, ...args: unknown[]) => { const r = e.act(name, args); expect(r.ok, `${name} ${JSON.stringify(args)}: ${r.message}`).toBe(true); return r; };
const q = (e: Engine<NodeState>, name: string, ...args: unknown[]) => e.q(name, args) as any;
const bench = (e: Engine<NodeState>) => { ok(e, 'runBench'); return q(e, 'benchResult'); };
const texts = (b: any): string => b.failures.map((f: any) => f.text).join(' | ');
const nodeOf = (e: Engine<NodeState>, pad: [number, number]) => buildConnectivity(st(e).ticket!.board, getDef).nodeOfPad(pad);
const P22 = ['1-4', '2-1'];

describe('wires join only at their ends (crossings, runs alongside, T-junctions)', () => {
  it('a wire crossing another is NOT joined: two nodes, a hop-over in the drawing data, and the message says they do not touch', () => {
    const e = open('2-2', P22);
    ok(e, 'addWire', [[4, 3], [4, 9]]);
    const r = ok(e, 'addWire', [[2, 6], [8, 6]]);
    expect(r.message).toMatch(/passes over another one: they do NOT touch there/);
    expect(nodeOf(e, [4, 3])).not.toBe(nodeOf(e, [2, 6]));
    expect(nodeOf(e, [4, 3])).toBe(nodeOf(e, [4, 9]));
    expect(q(e, 'bench').crossings).toEqual([{ pad: [4, 6], a: 'w1', b: 'w2' }]);
  });
  it('a wire running along another for a stretch is NOT joined either, and says so', () => {
    const e = open('2-2', P22);
    ok(e, 'addWire', [[4, 3], [4, 9]]);
    const r = ok(e, 'addWire', [[2, 6], [4, 6], [4, 8], [7, 8]]);
    expect(r.message).toMatch(/runs alongside another for a stretch: they do NOT touch/);
    expect(nodeOf(e, [2, 6])).not.toBe(nodeOf(e, [4, 3]));
    expect(nodeOf(e, [7, 8])).not.toBe(nodeOf(e, [4, 9]));
  });
  it('a wire END on another wire\'s middle, or a wire passing over another wire\'s end, is refused (no silent junction)', () => {
    const e = open('2-2', P22);
    ok(e, 'addWire', [[4, 3], [4, 9]]);
    expect(e.act('addWire', [[[2, 6], [4, 6]]]).ok).toBe(false);
    expect(e.act('addWire', [[[2, 9], [8, 9]]]).ok).toBe(false);
  });
  it('two wire ends on one pad ARE joined: said in words and drawn as a solder dot', () => {
    const e = open('2-2', P22);
    ok(e, 'addWire', [[4, 3], [4, 9]]);
    const r = ok(e, 'addWire', [[4, 9], [8, 9]]);
    expect(r.message).toMatch(/Two wires end on the same hole: those two wires ARE joined there/);
    expect(nodeOf(e, [8, 9])).toBe(nodeOf(e, [4, 3]));
    expect(q(e, 'bench').joins).toEqual([{ pad: [4, 9], n: 2 }]);
  });
});

describe('2-2 a bridge with no balance is diagnosed, never "balances at l"', () => {
  const refExcept = (skip: (w: number[][]) => boolean) => {
    const e = open('2-2', P22);
    for (const a of refActions(def('2-2')).filter((x) => !['runBench', 'power', 'advance'].includes(x.name))) {
      if (a.name === 'addWire' && skip((a.args as any)[0])) continue;
      ok(e, a.name, ...(a.args ?? []));
    }
    return e;
  };
  it('cell not across the wire (B not on GND): the needle reads zero everywhere, the bench refuses and names the cell; the scope does not lock', () => {
    const e = refExcept((w) => w[0]![0] === 22 && w[0]![1] === 11 && w[w.length - 1]![1] === 2);
    ok(e, 'power', true); ok(e, 'advance', 3);
    const s = q(e, 'scope'); expect(s.lock).toBe(false); expect(s.gauge.slide).toBe('dead'); expect(s.gauge.deadText).toMatch(/same \(zero\)/);
    expect(q(e, 'coach').text).toMatch(/no balance/);
    const b = bench(e);
    expect(b.pass).toBe(false);
    expect(texts(b)).toMatch(/no balance/); expect(texts(b)).toMatch(/cell is not across the wire/); expect(texts(b)).not.toMatch(/balances (with|at)/);
  });
  it('galvanometer not on the jockey: no sign change, named', () => {
    const e = refExcept((w) => w[w.length - 1]![0] === 12 && w[w.length - 1]![1] === 9);
    ok(e, 'power', true); ok(e, 'advance', 3);
    const b = bench(e); expect(b.pass).toBe(false); expect(texts(b)).toMatch(/no balance/); expect(texts(b)).toMatch(/not joined to the jockey/);
  });
  it('a wired bridge still balances: the reference passes', () => {
    const e = refExcept(() => false); ok(e, 'setJockey', 'f3', 400); ok(e, 'predict', 'dist', 75); ok(e, 'power', true);
    expect(q(e, 'scope').gauge.dead).toBe(false); expect(bench(e).pass).toBe(true);
  });
  /** X (the cable) on the left, the plug R on the right: l = 100 X / (X + R) = 60 cm for R = 5. */
  const swapped = () => {
    const e = open('2-2', P22);
    ok(e, 'placePart', 'res-box', 5, 'plug', 3, 5, 0, false); ok(e, 'placePart', 'galvanometer', null, '100ohm', 13, 8, 0, false);
    for (const w of [[[2, 2], [2, 11]], [[22, 11], [22, 2]], [[17, 5], [17, 12], [2, 12], [2, 11]], [[7, 5], [11, 5]], [[3, 5], [3, 4], [21, 4], [21, 11], [22, 11]], [[11, 5], [11, 8], [13, 8]], [[19, 8], [19, 10], [12, 10], [12, 9]]]) ok(e, 'addWire', w);
    return e;
  };
  it('R on the right: the slip formula and the failure working follow the wiring (X = R l / (100 - l), ratio 1.5)', () => {
    const e = swapped();
    expect(q(e, 'ticketCard').answers[0]).toMatchObject({ side: 'right', formula: 'X = R l / (100 - l)' });
    ok(e, 'setJockey', 'f3', 600); ok(e, 'predict', 'dist', 33.3); ok(e, 'power', true);
    const b = bench(e); expect(b.pass).toBe(false);
    expect(texts(b)).toMatch(/between C and end B, on the right/); expect(texts(b)).toMatch(/R × l \/ \(100 − l\) = R × 1\.5/);
    ok(e, 'predict', 'dist', 75); expect(bench(e).pass).toBe(true);
  });
  it('R on the left keeps the usual formula', () => {
    const e = refExcept(() => false); expect(q(e, 'ticketCard').answers[0]).toMatchObject({ side: 'left', formula: 'X = R (100 - l) / l' });
  });
});

// ---------------------------------------------------------------- 3-2: the failure text is read from the trace the scope shows
describe('3-2 the "never crossed" text agrees with the scope trace and explains the release path', () => {
  const build = (r: number, c: number) => {
    const e = open('3-2', ['1-4', '2-3', '3-1']);
    ok(e, 'placePart', 'res-cf', r, '0.25W', 4, 8, 0, false); ok(e, 'placePart', 'cap-el', c, '16V', 14, 9, 1, false);
    for (const w of [[[2, 8], [4, 8]], [[8, 8], [14, 8]], [[14, 8], [14, 9]], [[14, 11], [14, 13]]]) ok(e, 'addWire', w);
    return e;
  };
  it('47 k + 4.7 uF: OUT visibly falls on the press, and the text quotes the level the scope trace reached (not "hardly moves")', () => {
    const e = build(47e3, 4.7e-6); ok(e, 'attachProbe', 1, [14, 8]); ok(e, 'power', true);
    for (let i = 0; i < 104; i += 8) ok(e, 'advance', 8);
    const sc = q(e, 'scope'); expect(sc.trace.complete).toBe(true);
    const dt = sc.trace.dt, lo = Math.min(...sc.trace.v.slice(Math.round(0.01 / dt), Math.round(0.05 / dt) + 1));
    expect(lo).toBeLessThan(4.6); expect(lo).toBeGreaterThan(2.5);   // it falls, but not through 2.5 V
    const b = bench(e); const t = texts(b);
    expect(b.pass).toBe(false);
    expect(t).toMatch(/never crossed 2\.5 V/); expect(t).not.toMatch(/hardly moves/);
    const m = /only fell to ([\d.]+) V/.exec(t); expect(m, t).not.toBeNull(); expect(Number(m![1])).toBeCloseTo(lo, 1);
    expect(t).toMatch(/Make R x C about 10 to 20 ms/);
  });
  it('with a smaller R x C that falls but cannot climb back, the release path through the 10 k pull-up is named', () => {
    // 1 k + 10 uF: falls fast on the press; on the release it recharges through 1 k + 10 k, 110 ms: too slow to cross 2.5 V upward inside the window
    const b = bench(build(1e3, 10e-6)); const t = texts(b);
    expect(b.pass).toBe(false);
    expect(t).toMatch(/pull-up/); expect(t).toMatch(/\(1 kΩ \+ 10 kΩ\) x 10 µF = 110 ms/);
  });
});

// ---------------------------------------------------------------- 3-3: L / R teaching in the feedback
describe('3-3 the feedback teaches tau = L / R', () => {
  it('a slow build (12 V alone) says tau = L / R and the volts trade-off; the pass note repeats it', () => {
    const e = open('3-3', ['1-4', '2-3', '3-1']);
    for (const a of refActions(def('3-3')).filter((x) => !['runBench', 'power', 'advance'].includes(x.name))) ok(e, a.name, ...(a.args ?? []));
    expect(q(e, 'coach').text).not.toMatch(/tau = L \/ R/);
    ok(e, 'power', true); ok(e, 'advance', 3); ok(e, 'runBench'); expect(q(e, 'benchResult').pass).toBe(true);
    expect(q(e, 'coach').text).toMatch(/tau = L \/ R/); expect(q(e, 'coach').text).toMatch(/more volts/);
  });
  it('the slow explainers (first miss and repeat) carry the trade-off', () => {
    const slow = () => { const e = open('3-3', ['1-4', '2-3', '3-1']); for (const a of clearFaultActions(def('3-3'))) ok(e, a.name, ...(a.args ?? [])); ok(e, 'addWire', [[2, 2], [12, 2], [12, 4]]); return e; };   // 12 V alone
    const e = slow(); const b1 = bench(e); expect(b1.pass).toBe(false);
    expect(b1.failures.map((f: any) => f.text).join(' ')).toMatch(/tau = L \/ R: a bigger R makes the current rise faster, but needs more volts/);
    const b2 = bench(e); expect(b2.failures.map((f: any) => f.text).join(' ')).toMatch(/Remember tau = L \/ R: a bigger R makes the current rise faster/);
  });
});

// ---------------------------------------------------------------- scope: the 63 % marker
describe('scope 63 % marker on RC / LR tickets', () => {
  it('3-1: dashed level 6.32 V and the crossing time once the sweep has the point (about 1.00 s for the ref)', () => {
    const e = open('3-1', ['1-4', '2-3']); for (const a of refActions(def('3-1')).filter((x) => !['runBench', 'power', 'advance'].includes(x.name))) ok(e, a.name, ...(a.args ?? []));
    ok(e, 'attachProbe', 1, [14, 2]); ok(e, 'power', true); for (let i = 0; i < 104; i += 8) ok(e, 'advance', 8);
    const m = q(e, 'scope').trace.mark63; expect(m.level).toBeCloseTo(6.32, 1); expect(m.final).toBeCloseTo(10, 1); expect(m.t).toBeGreaterThan(0.95); expect(m.t).toBeLessThan(1.05);
  });
  it('3-3: 63 % of the steady coil current (60 mA -> 37.9 mA), crossing a little before the 40 mA pull-in', () => {
    const e = open('3-3', ['1-4', '2-3', '3-1']); for (const a of refActions(def('3-3')).filter((x) => !['runBench', 'power', 'advance'].includes(x.name))) ok(e, a.name, ...(a.args ?? []));
    ok(e, 'power', true); for (let i = 0; i < 104; i += 8) ok(e, 'advance', 8);
    const m = q(e, 'scope').trace.mark63; expect(m.final).toBeCloseTo(60, 0); expect(m.level).toBeCloseTo(37.9, 0); expect(m.t).toBeGreaterThan(0); expect(m.t).toBeLessThan(0.0004);
  });
  it('3-2 (a bounce filter) has none', () => {
    const e = open('3-2', ['1-4', '2-3', '3-1']); expect(q(e, 'scope').trace.mark63).toBeNull();
  });
});
