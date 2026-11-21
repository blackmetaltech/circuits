// Play-test C3-1: (1) wires join ONLY at their two ends: crossing / running alongside never joins, and the drawing data says exactly what is joined; (2) a bridge with no real
// balance is diagnosed, never "balances at l"; the slip's formula follows the side R is on.
import { describe, expect, it } from 'vitest';
import { Engine } from '@core/kit';
import { GAME } from '../game';
import { LEVEL_DEFS } from '../data/levels';
import { buildConnectivity } from '../sim/board/connectivity';
import { getDef } from './board';
import { refActions } from './replay';
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
    expect(r.message).toMatch(/passes over w1 at pad 4,6: they do NOT touch/);
    expect(nodeOf(e, [4, 3])).not.toBe(nodeOf(e, [2, 6]));
    expect(nodeOf(e, [4, 3])).toBe(nodeOf(e, [4, 9]));
    expect(q(e, 'bench').crossings).toEqual([{ pad: [4, 6], a: 'w1', b: 'w2' }]);
  });
  it('a wire running along another for a stretch is NOT joined either, and says so', () => {
    const e = open('2-2', P22);
    ok(e, 'addWire', [[4, 3], [4, 9]]);
    const r = ok(e, 'addWire', [[2, 6], [4, 6], [4, 8], [7, 8]]);
    expect(r.message).toMatch(/runs alongside w1 for 2 pad\(s\): they do NOT touch/);
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
    expect(r.message).toMatch(/w2 and w1 both end on pad 4,9: those two wires ARE joined there/);
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
