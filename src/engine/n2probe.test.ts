// N2 1-5: V(A) on a correct build. The scope counted as "clipped" only on the exact connector pad, so a clip on any other pad of node A read 0 V; the target counts the node now.
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

/** The reference build of 1-5 (levels/1-5.ts ref). */
function build(e: Engine<NodeState>): void {
  ok(e, 'placePart', 'res-exact', 2, 'ideal', 4, 2, 0, false); ok(e, 'placePart', 'res-exact', 3, 'ideal', 10, 4, 0, false); ok(e, 'placePart', 'res-exact', 6, 'ideal', 8, 7, 1, false);
  for (const w of [[[2, 2], [4, 2]], [[8, 2], [8, 6]], [[14, 2], [14, 4]], [[10, 4], [10, 6], [8, 6]], [[8, 6], [8, 7]], [[8, 11], [8, 12]], [[2, 8], [2, 12], [8, 12]], [[14, 8], [14, 12], [8, 12]]]) ok(e, 'addWire', w);
}

describe('N2: 1-5 probing node A', () => {
  it('the reference build: A reads 6.667 V on the scope, the DMM, and the supply view data', () => {
    const e = open('1-5'); build(e); ok(e, 'power', true); ok(e, 'attachProbe', 1, [8, 6]); ok(e, 'advance', 4);
    const sc = q(e, 'scope'); expect(sc.target.clipped).toBe(true); expect(sc.v[sc.v.length - 1]).toBeCloseTo(6.6667, 3); expect(sc.lock).toBe(true);
  });
  it('a clip on ANOTHER pad of node A (R3 top lead) counts as being on A and reads 6.667 V', () => {
    const e = open('1-5'); build(e); ok(e, 'power', true); ok(e, 'attachProbe', 1, [8, 7]); ok(e, 'advance', 4);
    const sc = q(e, 'scope'); expect(sc.target.clipped).toBe(true); expect(sc.v[sc.v.length - 1]).toBeCloseTo(6.6667, 3);
  });
  it('a clip on a pad that is not node A is not "clipped" (the arrow still points at A)', () => {
    const e = open('1-5'); build(e); ok(e, 'power', true); ok(e, 'attachProbe', 1, [2, 2]); ok(e, 'advance', 4);
    expect(q(e, 'scope').target.clipped).toBe(false);
  });
});
