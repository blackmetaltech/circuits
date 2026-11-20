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
/** 1-5 with R3's return end on `r` (the GND pad is (8,12)); `r` other than GND leaves R3's bottom hanging off the GND net. */
function build15(e: Engine<NodeState>, r: [number, number], vals = [2, 3, 6]): void {
  ok(e, 'placePart', 'res-exact', vals[0], 'ideal', 4, 2, 0, false); ok(e, 'placePart', 'res-exact', vals[1], 'ideal', 10, 4, 0, false); ok(e, 'placePart', 'res-exact', vals[2], 'ideal', 8, 7, 1, false);
  const wires: W[] = [[[2, 2], [4, 2]], [[8, 2], [8, 6]], [[14, 2], [14, 4]], [[10, 4], [10, 6], [8, 6]], [[8, 6], [8, 7]]];
  const gnd = r[0] === 8 && r[1] === 12;
  wires.push(gnd ? [[8, 11], [8, 12]] : [[8, 11], [r[0], 11], [r[0], r[1]]]);
  // both batteries' minus ends are pre-wired to the GND pad by the ticket (fixed wires fw1, fw2)
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
  it('the novice build (R3 not on the GND pad): the coach asks for the GND pad and the bench says so in words, not "0.00005 V"', () => {
    const e = open('1-5'); build15(e, [9, 13]);
    expect(['wire', 'ground']).toContain(q(e, 'coach').active); expect(q(e, 'coach').text).toMatch(/GND/);
    ok(e, 'power', true); ok(e, 'advance', 4);
    ok(e, 'runBench'); const b = q(e, 'benchResult');
    expect(b.pass).toBe(false); expect(JSON.stringify(b)).not.toMatch(/0\.0000/);
  });
  it('the batteries come pre-wired to the GND pad: fixed wires the player cannot remove, and a bare board already has a ground net', () => {
    const e = open('1-5'); const bench = q(e, 'bench');
    expect(bench.wires.filter((w: any) => w.fixed).length).toBe(2); expect(bench.wires.every((w: any) => w.fixed)).toBe(true);
    expect(e.act('deleteWire', ['fw1']).ok).toBe(false); expect(e.act('unwire', [[8, 12]]).ok).toBe(false);
    expect(e.act('unwire', ['fw2']).ok).toBe(false); expect(q(e, 'bench').wires.length).toBe(2);
  });
});
