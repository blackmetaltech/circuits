// Novice play-test round N2 (engine text): parts are named, never "p1"; burn text follows the live circuit and the teaching cadence (first burn: cause + KVL, no answer; repeat: worked formula).
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
const NO_ID = /\b[pf]\d+\b/;
const LED = ['led-red-5mm', null, '5mm'] as const;

describe('N2: part names, never ids', () => {
  it('every board message names the part', () => {
    const e = open('1-1'); const msgs: string[] = [];
    msgs.push(ok(e, 'placePart', ...LED, 8, 5, 0, false).message);
    msgs.push(ok(e, 'placePart', 'res-cf', 100, '0.25W', 2, 5, 0, false).message);
    expect(msgs[0]).toBe('Placed the LED.'); expect(msgs[1]).toBe('Placed the 100 Ω ¼ W resistor.');
    msgs.push(ok(e, 'movePart', 'p2', 2, 8).message, ok(e, 'rotatePart', 'p2').message, ok(e, 'setValue', 'p2', 220).message, ok(e, 'deletePart', 'p2').message);
    for (const m of msgs) expect(m, m).not.toMatch(NO_ID);
    expect(msgs[2]).toMatch(/^The 100 Ω ¼ W resistor moved/); expect(msgs[5]).toMatch(/^The 220 Ω ¼ W resistor removed/);
    const e2 = open('1-2'); ok(e2, 'placePart', ...LED, 8, 5, 0, false); ok(e2, 'placePart', ...LED, 14, 5, 0, false);   // two LEDs: numbered
    expect(ok(e2, 'deletePart', 'p1').message).toBe('LED 1 removed.');
  });
  it('1-5 sources are E1 and E2', () => {
    const e = open('1-5');
    const bad = e.act('deletePart', ['f1']); expect(bad.ok).toBe(false); expect(bad.message).toMatch(/^Source E1 is part of the ticket/);
  });
});

describe('N2: burn text follows the live circuit and the cadence', () => {
  const wireBare = (e: Engine<NodeState>) => { ok(e, 'addWire', [[2, 2], [2, 5], [4, 5]]); ok(e, 'addWire', [[6, 5], [6, 2], [8, 2]]); };
  it('first burn: the cause and KVL, no resistor value; a second burn gives the worked formula', () => {
    const e = open('1-1'); ok(e, 'placePart', ...LED, 4, 5, 0, false); wireBare(e); ok(e, 'power', true); ok(e, 'advance', 3);
    const t1 = q(e, 'liveFrame').events[0].text as string;
    expect(t1).toMatch(/^Burned: too much current, \d+ mA vs 30 mA max/); expect(t1).toMatch(/voltage law/); expect(t1).toMatch(/about 15 mA/);
    expect(t1).not.toMatch(/470|R = /); expect(t1).not.toMatch(NO_ID);
    ok(e, 'replaceSmoked', 'p1'); ok(e, 'power', false); ok(e, 'power', true); ok(e, 'advance', 3);
    const t2 = q(e, 'liveFrame').events[0].text as string;
    expect(t2).toMatch(/Burned again/); expect(t2).toContain('R = (9 V - 2'); expect(t2).toMatch(/about 470 Ω/);
  });
  it('a resistor that is too small: the text names it and never says the loop was empty', () => {
    const e = open('1-1'); ok(e, 'placePart', 'res-cf', 100, '0.25W', 2, 5, 0, false); ok(e, 'placePart', ...LED, 8, 5, 0, false);
    ok(e, 'addWire', [[2, 2], [2, 5]]); ok(e, 'addWire', [[6, 5], [8, 5]]); ok(e, 'addWire', [[10, 5], [10, 2], [8, 2]]);
    ok(e, 'power', true);
    let ev: any = null;
    for (let i = 0; i < 800 && !ev; i++) { ok(e, 'advance', 8); ev = q(e, 'liveFrame').events[0]; }
    expect(ev, 'the LED eventually burns').toBeTruthy();
    const t = ev.text as string;
    expect(t).toContain('the 100 Ω ¼ W resistor'); expect(t).not.toMatch(/nothing else|nothing but|470/); expect(t).not.toMatch(NO_ID);
    expect(t).toMatch(/\d+ mA vs 30 mA max/); expect(t).toMatch(/voltage law/);
  });
  it('the bench report names parts too', () => {
    const e = open('1-3'); ok(e, 'placePart', 'res-cf', 22, '0.25W', 4, 2, 0, false); ok(e, 'wire', [2, 2], [4, 2]); ok(e, 'wire', [8, 2], [14, 2]);
    ok(e, 'runBench');
    const f = q(e, 'benchResult').failures.map((x: any) => x.text).join(' | ');
    expect(f).toMatch(/The 22 Ω ¼ W resistor/); expect(f).not.toMatch(NO_ID);
  });
});
