// Novice play-test round N2 (coach): a burned part is named, optional measuring steps ride along, 1-4 refuses the player's bench until something has been measured.
import { describe, expect, it } from 'vitest';
import { Engine } from '@core/kit';
import { GAME } from '../game';
import { clearFaultActions } from './replay';
import { LEVEL_DEFS } from '../data/levels';
import { newTicketProgress, type NodeState } from './state';

function open(id: string): Engine<NodeState> {
  const e = new Engine(GAME, { mode: 'learner' }); e.autosave = false;
  const st = structuredClone(e.state) as NodeState;
  for (const d of LEVEL_DEFS.filter((x) => x.chapter === 1)) { if (d.id === id) break; st.progress.tickets[d.id] = { ...newTicketProgress(), passed: true, stars: 1 }; }
  e.setState(st);
  expect(e.act('openTicket', [id]).ok).toBe(true);
  for (const a of clearFaultActions(LEVEL_DEFS.find((d) => d.id === id)!)) expect(e.act(a.name, a.args ?? []).ok).toBe(true);   // these build tests start from the cleared board (repair.test.ts covers the arrival)
  return e;
}
const ok = (e: Engine<NodeState>, name: string, ...args: unknown[]) => { const r = e.act(name, args); expect(r.ok, `${name} ${JSON.stringify(args)}: ${r.message}`).toBe(true); return r; };
const q = (e: Engine<NodeState>, name: string, ...args: unknown[]) => e.q(name, args) as any;
const LED = ['led-red-5mm', null, '5mm'] as const;

describe('N2: the coach', () => {
  it('a burned part is named in the coach, whatever the ticket (no "clip the meter")', () => {
    const e = open('1-2'); ok(e, 'placePart', ...LED, 4, 5, 0, false); ok(e, 'addWire', [[2, 2], [2, 5], [4, 5]]); ok(e, 'addWire', [[6, 5], [6, 2], [8, 2]]);
    ok(e, 'power', true); ok(e, 'advance', 3);
    const c = q(e, 'coach');
    expect(c.active).toBe('burned'); expect(c.text).toMatch(/^The LED burned: undo it \(Ctrl\+Z\)/); expect(c.text).not.toMatch(/\bp\d+\b|meter/);
    expect(c.anchor.target).toBe('part');
    expect(c.steps.filter((s: any) => s.active).length).toBe(1);
    ok(e, 'replaceSmoked', 'p1');
    expect(q(e, 'coach').active).not.toBe('burned');
  });
  it('an optional measuring step rides along instead of holding the coach back', () => {
    const e = open('1-1'); ok(e, 'placePart', 'res-cf', 470, '0.25W', 2, 5, 0, false); ok(e, 'placePart', ...LED, 8, 5, 0, false);
    ok(e, 'addWire', [[2, 2], [2, 5]]); ok(e, 'addWire', [[6, 5], [8, 5]]); ok(e, 'addWire', [[10, 5], [10, 2], [8, 2]]); ok(e, 'power', true); ok(e, 'advance', 3);
    const c = q(e, 'coach');
    expect(c.active).toBe('run-bench'); expect(c.text).toMatch(/Optional: See the dots/);
    ok(e, 'attachProbe', 1, [8, 5]);
    expect(q(e, 'coach').text).not.toMatch(/Optional/);
  });
  it('1-4: the player\'s bench button refuses until something has been measured; the formal bench itself does not', () => {
    const build = () => { const e = open('1-4'); ok(e, 'placePart', 'res-ww5', 4.7, '5W', 2, 5, 0, false); ok(e, 'addWire', [[2, 2], [2, 5]]); ok(e, 'addWire', [[6, 5], [6, 2], [8, 2]]); return e; };
    const e = build();
    const r = e.act('runBench', [true]); expect(r.ok).toBe(false); expect(r.message).toMatch(/^Measure it first/);
    expect(q(e, 'coach').steps.find((s: any) => s.id === 'open-circuit').done).toBe(false);
    ok(e, 'dmmLead', 'red', [2, 2]); ok(e, 'dmmLead', 'black', [8, 2]);
    ok(e, 'dmmLead', 'red', null);   // taking the lead off again does not un-measure
    expect(q(e, 'coach').steps.find((s: any) => s.id === 'open-circuit').done).toBe(true);
    expect(e.act('runBench', [true]).ok).toBe(true);
    expect(build().act('runBench', []).ok).toBe(true);
  });
});
