// A novice's first ticket (docs/briefs: play-test of 1-1): bench failures in plain words with units, wires that report what they touch, hanging wire ends,
// undo, deleting a part, a coach whose step counter never changes its total, and the crack note in mA. Everything here is engine text and engine state.
import { describe, expect, it } from 'vitest';
import { Engine } from '@core/kit';
import { GAME } from '../game';
import { LEVEL_DEFS } from '../data/levels';
import { explainLevelMiss } from '../sim/explain';
import { say } from './text';
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
const benchText = (e: Engine<NodeState>): string[] => { ok(e, 'runBench'); return q(e, 'benchResult').failures.map((f: any) => f.text as string); };
const LED = ['led-red-5mm', null, '5mm'] as const;
const place = (e: Engine<NodeState>, x: number, y: number) => ok(e, 'placePart', ...LED, x, y, 0, false);

describe('bench failures in plain words', () => {
  it('a dead LED (nothing wired) says 0 mA, the part by name, the band in mA, and the likely cause', () => {
    const e = open('1-1'); place(e, 4, 5);
    const t = benchText(e).join(' ');
    expect(t).toContain('No current through the LED');
    expect(t).toContain('0 mA'); expect(t).toContain('10 to 20 mA');
    expect(t).toMatch(/backwards/); expect(t).toMatch(/wire not touching its leg/);
    expect(t).not.toMatch(/i\(p1\)|nominal test|outside the allowed/);
  });
  it('too much and too little current name the direction to move the resistor', () => {
    const build = (v: number) => { const e = open('1-1'); ok(e, 'placePart', 'res-cf', v, '0.25W', 2, 5, 0, false); place(e, 8, 5); ok(e, 'addWire', [[2, 2], [2, 5]]); ok(e, 'addWire', [[6, 5], [8, 5]]); ok(e, 'addWire', [[10, 5], [10, 2], [8, 2]]); return e; };
    const dim = benchText(build(1000)).join(' '); expect(dim).toMatch(/Too little current through the LED: 7\.\d+ mA, but it needs 10 to 20 mA/); expect(dim).toMatch(/smaller resistor/);
    const bright = benchText(build(220)).join(' '); expect(bright).toMatch(/Too much current through the LED: \d+(\.\d+)? mA, but it needs 10 to 20 mA/); expect(bright).toMatch(/bigger resistor/);
  });
  it('1-3 (a voltage) and 1-4 (a power the battery delivers) read in V and W, with the sign the player expects', () => {
    const e = open('1-3'); ok(e, 'placePart', 'res-cf', 27, '1W', 4, 2, 0, false);
    ok(e, 'wire', [2, 2], [4, 2]); ok(e, 'wire', [8, 2], [14, 2]);
    const t = benchText(e).join(' '); expect(t).toMatch(/Too low: the voltage at OUT reads 7\.\d+ V, but it needs 7\.85 to 8\.4 V/);
  });
  it('1-2 reads the battery current as a draw, in mA', () => {
    const e = open('1-2'); for (let n = 0; n < 3; n++) ok(e, 'placePart', ...LED, 4 + n * 6, 6, 0, false);
    const t = benchText(e).join(' ');
    expect(t).toMatch(/mA/); expect(t).not.toMatch(/outside the allowed/);
  });
});

describe('the crack note', () => {
  it('an LED straight on the battery: instant crack, the note says burned, in mA, with the numbers', () => {
    const e = open('1-1'); place(e, 4, 5); ok(e, 'addWire', [[2, 2], [2, 5], [4, 5]]); ok(e, 'addWire', [[6, 5], [6, 2], [8, 2]]);
    ok(e, 'power', true); expect(ok(e, 'advance', 3).smoked).toEqual(['p1']);
    const ev = q(e, 'liveFrame').events[0];
    expect(ev.kind).toBe('crack');
    expect(ev.text).toMatch(/^Burned: too much current, \d{3} mA vs 30 mA max/);
    expect(ev.text).toMatch(/voltage law/); expect(ev.text).not.toMatch(/470|\bp1\b/);
  });
});

describe('wires say what they touch, and flag the ones that touch nothing', () => {
  it('a wire onto a leg names the leg; onto the connector names the connector; onto an empty hole warns', () => {
    const e = open('1-1'); place(e, 4, 5);
    const r = ok(e, 'wire', [2, 2], [4, 5]);
    expect((r.landed as any[]).map((x: any) => x.kind)).toEqual(['pin', 'pin']);
    expect((r.landed as any[])[1].text).toBe('the LED leg A +'); expect(r.dangling).toEqual([]);
    const h = ok(e, 'wire', [8, 2], [7, 5]);   // one hole beside the K leg
    expect(h.dangling).toEqual([[7, 5]]); expect(h.message).toMatch(/isn't touching a part's leg/);
    expect((h.landed as any[])[1]).toMatchObject({ kind: 'empty' });
    const b = q(e, 'bench'); expect(b.dangling.map((d: any) => d.pad)).toEqual([[7, 5]]);
    expect(b.parts.find((p: any) => p.uid === 'p1').pins.map((p: any) => p.label)).toEqual(['A +', 'K -']);
    expect(b.openPins).toEqual([{ uid: 'p1', pin: 'K', pad: [6, 5] }]);
  });
});

describe('undo and delete', () => {
  it('undo takes back the last edit, undoDepth tracks it', () => {
    const e = open('1-1'); place(e, 4, 5); ok(e, 'wire', [2, 2], [4, 5]);
    expect(q(e, 'bench').undoDepth).toBe(2);
    ok(e, 'undo'); expect(q(e, 'bench').wires).toHaveLength(0); expect(q(e, 'bench').undoDepth).toBe(1);
    ok(e, 'undo'); expect(q(e, 'bench').parts.filter((p: any) => !p.fixed)).toHaveLength(0);
  });
  it('deleting a part removes the wires its legs alone were holding; undo brings them back', () => {
    const e = open('1-1'); place(e, 4, 5); ok(e, 'wire', [2, 2], [4, 5]); ok(e, 'wire', [6, 5], [8, 2]);
    const r = ok(e, 'deletePart', 'p1');
    expect(r.removedWires).toEqual(['w1', 'w2']); expect(r.message).toMatch(/2 wires/); expect(q(e, 'bench').wires).toHaveLength(0);
    ok(e, 'undo'); expect(q(e, 'bench').wires).toHaveLength(2);
  });
  it('wires that still meet each other stay', () => {
    const e = open('1-1'); place(e, 4, 5); ok(e, 'wire', [2, 2], [4, 5]); ok(e, 'wire', [4, 5], [4, 8]); ok(e, 'wire', [4, 8], [6, 8]);
    const r = ok(e, 'deletePart', 'p1');
    expect(r.removedWires).toEqual([]);   // the wires still meet each other's ends, so none is left hanging by this leg alone
    expect(q(e, 'bench').wires.map((w: any) => w.wid)).toEqual(['w1', 'w2', 'w3']);
  });
});

describe('Wren\'s step counter', () => {
  it('the total never changes through a ticket, and the active anchor moves off the shoebox once the LED is placed', () => {
    const e = open('1-1'); const c0 = q(e, 'coach'); const total = c0.stepTotal;
    expect(c0.stepNo).toBe(1); expect(c0.anchor.target).toBe('bin');
    place(e, 4, 5); const c1 = q(e, 'coach'); expect(c1.stepTotal).toBe(total); expect(c1.stepNo).toBe(2); expect(c1.anchor.target).toBe('part');
    ok(e, 'wire', [2, 2], [4, 5]); ok(e, 'wire', [6, 5], [8, 2]); const c2 = q(e, 'coach'); expect(c2.stepTotal).toBe(total); expect(c2.stepNo).toBe(3);
    ok(e, 'power', true); ok(e, 'advance', 3); const c3 = q(e, 'coach'); expect(c3.stepTotal).toBe(total); expect(c3.active).toBe('undo-smoke'); expect(c3.stepNo).toBe(4);
  });
});

describe('explainLevelMiss reads the solver sign the way the player means it', () => {
  const t = (f: any, ctx: any) => { const x = explainLevelMiss(f, ctx)!; return say(x.key, x.vars); };
  it('power into the battery is a negative number: shown as a positive load power, "at least"', () => {
    const s = t({ key: 'bench.level.fail', vars: { probe: 'p(f1)', value: -4.18, lo: -1000, hi: -4.2, cond: 'nominal' } }, { names: { f1: 'the battery pack' }, kinds: { f1: 'BAT' } });
    expect(s).toBe('Not enough power: the battery pack gives 4.18 W, but it needs at least 4.2 W. Power is volts times amps: a load that matches the battery\'s own resistance gets the most.');
  });
  it('the draw on a battery (negative current) must stay under 25 mA, and the tired condition is named', () => {
    const s = t({ key: 'bench.level.fail', vars: { probe: 'i(b1)', value: -0.057, lo: -0.025, hi: 0, cond: 'tired' } }, { names: { b1: 'the battery' }, kinds: { b1: 'BAT' } });
    expect(s).toMatch(/Too much current from the battery: 57 mA, but it must stay under 25 mA, in the tired test/);
  });
  it('falls through (null) when the probe or the part is unknown', () => {
    expect(explainLevelMiss({ key: 'bench.level.fail', vars: { probe: 'weird', value: 1, lo: 2, hi: 3 } })).toBeNull();
    expect(explainLevelMiss({ key: 'bench.level.fail', vars: { probe: 'i(zz)', value: 1, lo: 2, hi: 3 } }, { names: {} })).toBeNull();
  });
});
