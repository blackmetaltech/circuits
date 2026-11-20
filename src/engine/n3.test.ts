// N3 (novice round 3): the bench and the DMM must agree on node A, a floating build is explained in words, and (below) the 1-4 / strings fixes.
import { describe, expect, it } from 'vitest';
import { Engine } from '@core/kit';
import { GAME } from '../game';
import { LEVEL_DEFS } from '../data/levels';
import { newTicketProgress, type NodeState } from './state';

function open(id: string): Engine<NodeState> {
  const e = new Engine(GAME, { mode: 'learner' }); e.autosave = false;
  const st = structuredClone(e.state) as NodeState;
  for (const d of LEVEL_DEFS.filter((x) => x.chapter === 1)) { if (d.id === id) break; st.progress.tickets[d.id] = { ...newTicketProgress(), passed: true, stars: 1 }; }
  e.setState(st);
  expect(e.act('openTicket', [id]).ok).toBe(true);
  return e;
}
const ok = (e: Engine<NodeState>, name: string, ...args: unknown[]) => { const r = e.act(name, args); expect(r.ok, `${name} ${JSON.stringify(args)}: ${r.message}`).toBe(true); return r; };
const q = (e: Engine<NodeState>, name: string, ...args: unknown[]) => e.q(name, args) as any;

type W = [number, number][];
/** 1-5 with the return net on `r` (the GND pad is (8,12)); `r` other than GND reproduces the novice's floating build. */
function build15(e: Engine<NodeState>, r: [number, number], vals = [2, 3, 6]): void {
  ok(e, 'placePart', 'res-exact', vals[0], 'ideal', 4, 2, 0, false); ok(e, 'placePart', 'res-exact', vals[1], 'ideal', 10, 4, 0, false); ok(e, 'placePart', 'res-exact', vals[2], 'ideal', 8, 7, 1, false);
  const wires: W[] = [[[2, 2], [4, 2]], [[8, 2], [8, 6]], [[14, 2], [14, 4]], [[10, 4], [10, 6], [8, 6]], [[8, 6], [8, 7]]];
  const gnd = r[0] === 8 && r[1] === 12;
  wires.push(gnd ? [[8, 11], [8, 12]] : [[8, 11], [r[0], 11], [r[0], r[1]]]);
  wires.push(gnd ? [[2, 8], [2, 12], [8, 12]] : [[2, 8], [2, r[1]], r]);
  wires.push(gnd ? [[14, 8], [14, 12], [8, 12]] : [[14, 8], [14, r[1]], r]);
  for (const w of wires) ok(e, 'addWire', w);
  ok(e, 'predict', 'pva', 6.6667); ok(e, 'predict', 'pie2', 0.5556);
}
const truthVA = (e: Engine<NodeState>): number => { ok(e, 'runBench'); return q(e, 'benchResult').predictions.find((p: any) => p.id === 'pva').truth; };

describe('N3: 1-5 bench and DMM read the same node A', () => {
  const cases: [string, [number, number], number[]][] = [['ref', [8, 12], [2, 3, 6]], ['swapped R1/R3', [8, 12], [6, 3, 2]], ['3-2-6', [8, 12], [3, 2, 6]]];
  for (const [label, ret, vals] of cases) for (const aPad of [[8, 6], [8, 7]] as [number, number][]) {
    it(`${label}: bench V(A) == DMM(${aPad}, GND) within 1e-6 relative; a one-lead meter agrees too`, () => {
      const e = open('1-5'); build15(e, ret, vals);
      ok(e, 'power', true); ok(e, 'setMeter', 'dcv', [aPad, [8, 12]]); ok(e, 'advance', 4);
      const live = q(e, 'meter').value as number, bench = truthVA(e);
      expect(Math.abs(live - bench) / Math.abs(bench)).toBeLessThan(1e-6);
      ok(e, 'setMeter', 'dcv', [aPad]); ok(e, 'advance', 1);
      expect(Math.abs(q(e, 'meter').value - bench) / Math.abs(bench)).toBeLessThan(1e-6);
    });
  }
  it('the novice build (return net not on the GND pad): the DMM reads 6.67 V between its leads, the bench says the circuit is not tied to GND instead of "0.00005 V"', () => {
    const e = open('1-5'); build15(e, [9, 13]);
    expect(q(e, 'coach').active).toBe('ground'); expect(q(e, 'coach').text).toMatch(/GND/);
    ok(e, 'power', true); ok(e, 'setMeter', 'dcv', [[8, 6], [9, 13]]); ok(e, 'advance', 4);
    const m = q(e, 'meter'); expect(m.value).toBeCloseTo(6.6667, 3); expect(m.floating).toBe(true); expect(q(e, 'dmm').note).toMatch(/GND/);
    ok(e, 'runBench'); const b = q(e, 'benchResult');
    expect(b.pass).toBe(false); expect(b.failures.map((f: any) => f.key)).toEqual(['bench.floating']);
    expect(b.failures[0].text).toMatch(/tied to the GND pad/); expect(JSON.stringify(b)).not.toMatch(/0\.0000/);
  });
});
