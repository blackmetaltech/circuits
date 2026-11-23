// 0.7 (Leo, 0.6 final hand play): a wire end landed on GND beside OUT and joined the supply's plus straight to its minus. Before the click the
// player should be told, and the wire's own sentence should say it. `wireShort` answers for a wire not yet drawn; `wire` adds the sentence.
import { describe, expect, it } from 'vitest';
import { Engine } from '@core/kit';
import { GAME } from '../game';
import { LEVEL_DEFS } from '../data/levels';
import { clearFaultActions } from './replay';
import { newTicketProgress, type NodeState } from './state';

function open(id: string): Engine<NodeState> {
  const e = new Engine(GAME, { mode: 'learner' }); e.autosave = false;
  const st = structuredClone(e.state) as NodeState;
  for (const d of LEVEL_DEFS) { if (d.id === id) break; st.progress.tickets[d.id] = { ...newTicketProgress(), passed: true, stars: 1 }; }
  e.setState(st);
  expect(e.act('openTicket', [id]).ok).toBe(true);
  for (const a of clearFaultActions(LEVEL_DEFS.find((d) => d.id === id)!)) expect(e.act(a.name, a.args ?? []).ok).toBe(true);
  return e;
}
const q = (e: Engine<NodeState>, name: string, ...args: unknown[]) => e.q(name, args) as any;

describe('a wire that shorts a source', () => {
  it('1-3: IN to GND is named as a short across the bench supply, before and after', () => {
    const e = open('1-3');
    const w = q(e, 'wireShort', [2, 2], [14, 8]);
    expect(w.short).toBe(true);
    expect(w.text).toMatch(/IN/); expect(w.text).toMatch(/GND/); expect(w.text).toMatch(/short/i);
    const r = e.act('wire', [[2, 2], [14, 8]]);
    expect(r.ok).toBe(true);
    expect(r.message).toMatch(/short/i);
  });
  it('1-3: IN to OUT (the heater) is not a short', () => {
    const e = open('1-3');
    expect(q(e, 'wireShort', [2, 2], [14, 2]).short).toBe(false);
    expect(e.act('wire', [[2, 2], [14, 2]]).message).not.toMatch(/short/i);
  });
  it('1-1: the battery plus joined to GND is a short across the battery', () => {
    const e = open('1-1');
    const w = q(e, 'wireShort', [2, 2], [8, 2]);
    expect(w.short).toBe(true); expect(w.text).toMatch(/battery/i);
  });
  it('1-1: a wire through a resistor is not a short (the end on a leg)', () => {
    const e = open('1-1');
    expect(e.act('placePart', ['res-cf', 470, '0.25W', 2, 5, 0, false]).ok).toBe(true);
    expect(q(e, 'wireShort', [2, 2], [2, 5]).short).toBe(false);
    expect(q(e, 'wireShort', [6, 5], [8, 2]).short).toBe(false);
  });
});
