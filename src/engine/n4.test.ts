// N4 (impatient 13-year-old, handheld): the bench never tests a dark bench, wires always route, burn text is frozen at the burn, undo after a burn does not re-burn, plain-words undo, 1-3 / 1-2 teaching.
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
const ok = (e: Engine<NodeState>, name: string, ...args: unknown[]) => { const r = e.act(name, args); expect(r.ok, `${name} ${JSON.stringify(args)}: ${r.message}`).toBe(true); return r as any; };
const q = (e: Engine<NodeState>, name: string, ...args: unknown[]) => e.q(name, args) as any;
const LED = ['led-red-5mm', null, '5mm'] as const;

/** 1-1 reference build (470 ohm), power left OFF. */
function build11(e: Engine<NodeState>): void {
  ok(e, 'placePart', 'res-cf', 470, '0.25W', 2, 5, 0, false); ok(e, 'placePart', ...LED, 8, 5, 0, false);
  ok(e, 'addWire', [[2, 2], [2, 5]]); ok(e, 'addWire', [[6, 5], [8, 5]]); ok(e, 'addWire', [[10, 5], [10, 2], [8, 2]]);
}

describe('N4: the bench with the power switch off', () => {
  it("the player's bench button switches the power on (and says so); it never tests a dark bench", () => {
    const e = open('1-1'); build11(e);
    expect(q(e, 'bench').instruments.powered).toBe(false);
    const r = ok(e, 'runBench', true);
    expect(r.autoPowered).toBe(true); expect(r.message).toMatch(/power switch was off/i);
    expect(q(e, 'bench').instruments.powered).toBe(true);
    expect(r.pass).toBe(true);
    const r2 = ok(e, 'runBench', true); expect(r2.autoPowered).toBe(false);
  });
  it('a bench run with the power already on does not announce a switch', () => {
    const e = open('1-1'); build11(e); ok(e, 'power', true);
    expect(ok(e, 'runBench', true).autoPowered).toBe(false);
  });
});

describe('N4: wires always find a route', () => {
  it('a second wire onto an already wired pad works (pads take several wires)', () => {
    const e = open('1-5');
    ok(e, 'placePart', 'res-exact', 2, 'ideal', 4, 2, 0, false); ok(e, 'placePart', 'res-exact', 3, 'ideal', 10, 4, 0, false);
    ok(e, 'wire', [2, 2], [4, 2]); ok(e, 'wire', [8, 2], [8, 6]); ok(e, 'wire', [10, 4], [8, 6]);
    const r = ok(e, 'wire', [8, 6], [14, 2]);   // A already has two wires; a third lands on it
    expect(r.landed.length).toBe(2);
    ok(e, 'wire', [8, 6], [8, 12]);
    expect(q(e, 'bench').wires.length).toBe(2 + 5);
  });
  it('walls of wires and legs in the way: the router goes around, crossing as hop-overs', () => {
    const e = open('1-5');
    ok(e, 'placePart', 'res-exact', 6, 'ideal', 8, 7, 1, false);
    ok(e, 'addWire', [[5, 0], [5, 15]]); ok(e, 'addWire', [[6, 0], [6, 15]]);
    const r = ok(e, 'wire', [3, 3], [9, 3]);
    expect(r.path[0]).toEqual([3, 3]); expect(r.path[r.path.length - 1]).toEqual([9, 3]);
    const r2 = ok(e, 'wire', [8, 8], [4, 9]); expect(r2.path.length).toBeGreaterThanOrEqual(2);
    const r3 = ok(e, 'wire', [5, 15], [6, 0]); expect(r3.path[0]).toEqual([5, 15]);
  });
  it('the two refusals no route can fix say so in plain words, not "draw it in two steps"', () => {
    const e = open('1-5');
    ok(e, 'wire', [4, 4], [4, 9]);
    const dup = e.act('wire', [[4, 9], [4, 4]]); expect(dup.ok).toBe(false); expect(dup.message).toMatch(/already joined/);
    const tj = e.act('wire', [[4, 6], [9, 6]]); expect(tj.ok).toBe(false); expect(tj.message).toMatch(/middle of another wire/);
    expect(e.act('wire', [[4, 4], [5, 9]]).ok).toBe(true);   // a different far end onto the same wired pad is fine
  });
  it("the ticket's own wires cannot be removed", () => {
    const e = open('1-5');
    expect(e.act('deleteWire', ['fw1']).ok).toBe(false); expect(e.act('unwire', ['fw1']).message).toMatch(/came with the ticket/);
    expect(e.act('unwire', [[8, 12]]).ok).toBe(false);
    ok(e, 'loadBoard', { parts: [], wires: [] }); expect(q(e, 'bench').wires.length).toBe(2);
  });
});

describe('N4: burn text is frozen at the burn; undo after a burn does not re-burn', () => {
  const bare = (e: Engine<NodeState>) => { ok(e, 'placePart', ...LED, 4, 5, 0, false); ok(e, 'addWire', [[2, 2], [2, 5], [4, 5]]); ok(e, 'addWire', [[6, 5], [6, 2], [8, 2]]); };
  it('adding a resistor after the burn does not rewrite the note with the new resistor and the old milliamps', () => {
    const e = open('1-1'); bare(e); ok(e, 'power', true); ok(e, 'advance', 3);
    const t1 = q(e, 'liveFrame').events[0].text as string;
    expect(t1).toMatch(/604 mA/); expect(t1).not.toMatch(/220/);
    ok(e, 'placePart', 'res-cf', 220, '0.25W', 2, 8, 0, false);
    const t2 = q(e, 'liveFrame').events[0].text as string;
    expect(t2).toBe(t1);
  });
  it('Ctrl+Z after a burn: the part is fresh, the power is off, nothing re-fires until the power goes on again', () => {
    const e = open('1-1'); bare(e); ok(e, 'power', true); ok(e, 'advance', 3);
    expect(q(e, 'liveFrame').events.length).toBe(1);
    const u = ok(e, 'undo');
    expect(u.message).toMatch(/^Undid: drew a wire\./); expect(u.fresh).toBe(true);
    expect(q(e, 'liveFrame').events.length).toBe(0); expect(q(e, 'bench').instruments.powered).toBe(false);
    ok(e, 'advance', 3); expect(q(e, 'liveFrame').events.length).toBe(0);
    ok(e, 'addWire', [[6, 5], [6, 2], [8, 2]]);
    ok(e, 'power', true); ok(e, 'advance', 3);
    expect(q(e, 'liveFrame').events[0].text).toMatch(/^Burned/);   // only now, with the power back on
  });
  it('replacing the burnt part also switches the power off', () => {
    const e = open('1-1'); bare(e); ok(e, 'power', true); ok(e, 'advance', 3);
    ok(e, 'replaceSmoked', 'p1'); expect(q(e, 'bench').instruments.powered).toBe(false); ok(e, 'advance', 3); expect(q(e, 'liveFrame').events.length).toBe(0);
  });
});

describe('N4: undo and redo in plain words', () => {
  it('names the edit and the part, never the action id', () => {
    const e = open('1-1');
    ok(e, 'placePart', 'res-cf', 470, '0.25W', 2, 5, 0, false); ok(e, 'wire', [2, 2], [2, 5]); ok(e, 'setValue', 'p1', 220); ok(e, 'deletePart', 'p1');
    expect(ok(e, 'undo').message).toBe('Undid: removed the 220 Ω ¼ W resistor.');
    expect(ok(e, 'undo').message).toBe('Undid: changed the value of the 220 Ω ¼ W resistor.');
    expect(ok(e, 'undo').message).toBe('Undid: drew a wire.');
    expect(ok(e, 'undo').message).toBe('Undid: placed the 470 Ω ¼ W resistor.');
    expect(ok(e, 'redo').message).toBe('Redid: placed the 470 Ω ¼ W resistor.');
    for (const m of [ok(e, 'redo').message, ok(e, 'redo').message]) expect(m).not.toMatch(/placePart|setValue|addWire|deletePart/);
  });
});

describe('N4: 1-3 and 1-2 teaching', () => {
  it('1-3: the ticket says the heater is a fixed 50 ohm element needing 7.85 to 8.4 V, and a coach step has the player measure it with the DMM', () => {
    const e = open('1-3');
    expect(q(e, "ticketCard").brief).toMatch(/fixed 50 ohm/); expect(q(e, "ticketCard").brief).toMatch(/across it/); expect(q(e, 'ticketCard').brief).toMatch(/7\.85 V and 8\.4 V/);
    ok(e, 'placePart', 'res-cf', 22, '1W', 4, 2, 0, false); ok(e, 'wire', [2, 2], [4, 2]); ok(e, 'wire', [8, 2], [14, 2]); ok(e, 'power', true);
    const c = q(e, 'coach'); expect(c.active).toBe('measure'); expect(c.text).toMatch(/DMM/); expect(c.text).toMatch(/50 ohm/); expect(c.anchor.target).toBe('dmm');
    ok(e, 'dmmLead', 'red', [14, 2]); ok(e, 'dmmLead', 'black', [14, 8]); ok(e, 'advance', 2);
    expect(q(e, 'coach').active).toBe('run-bench');
  });
  it('1-3: the burn note for the 1/4 W part explains P = I squared R', () => {
    const e = open('1-3'); ok(e, 'placePart', 'res-cf', 22, '0.25W', 4, 2, 0, false); ok(e, 'wire', [2, 2], [4, 2]); ok(e, 'wire', [8, 2], [14, 2]);
    ok(e, 'runBench'); const t = q(e, 'benchResult').failures.map((f: any) => f.text).join(' ');
    expect(t).toMatch(/current squared times resistance: P = I²R = \(0\.1\d+ A\)² × 22 Ω/);
  });
  it('1-2: a fresh-passing, tired-failing build says why a smaller resistor helps', () => {
    const e = open('1-2');
    ok(e, 'placePart', 'res-cf', 180, '0.25W', 2, 5, 0, false);
    for (const x of [8, 14, 18]) ok(e, 'placePart', ...LED, x, 5, 0, false);
    for (const w of [[[2, 2], [2, 5]], [[6, 5], [8, 5]], [[10, 5], [14, 5]], [[16, 5], [18, 5]], [[20, 5], [20, 2], [8, 2]]]) ok(e, 'addWire', w);
    ok(e, 'runBench'); const b = q(e, 'benchResult');
    const txt = b.failures.map((f: any) => f.text).join(' | ');
    expect(b.pass).toBe(false); expect(txt).toMatch(/tired battery gives less voltage/); expect(txt).toMatch(/less resistance/);
  });
});
