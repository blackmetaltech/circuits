// N2 1-5: a build whose three resistors meet somewhere other than the brass A pad is "wired" but node A is not there: the coach says A must be joined, and the bench cannot find V(A).
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

describe('N2: 1-5 junction away from the A pad', () => {
  it('the coach keeps asking for A until a part leg is on it', () => {
    const e = open('1-5');
    ok(e, 'placePart', 'res-exact', 2, 'ideal', 4, 2, 0, false); ok(e, 'placePart', 'res-exact', 3, 'ideal', 10, 4, 0, false); ok(e, 'placePart', 'res-exact', 6, 'ideal', 8, 7, 1, false);
    ok(e, 'predict', 'pva', 6.6667); ok(e, 'predict', 'pie2', 0.5556);
    for (const w of [[[2, 2], [4, 2]], [[8, 2], [7, 2], [7, 7], [8, 7]], [[14, 2], [14, 4]], [[10, 4], [10, 7], [8, 7]], [[8, 11], [8, 12]]]) ok(e, 'addWire', w);
    const step = () => q(e, 'coach').steps.find((s: any) => s.id === 'wire');
    expect(step().done).toBe(false);      // every leg is joined to something, but not to A
    ok(e, 'addWire', [[8, 6], [8, 7]]);
    expect(step().done).toBe(true);
  });
});
