// A first-timer (Mina) played 1-1..1-3 on the GPU bench (0.7). Each finding the engine owns, pinned here: every sentence the bench
// or the explainer says must be true of the board she built and of the numbers it prints.
import { describe, expect, it } from 'vitest';
import { Engine } from '@core/kit';
import { GAME } from '../game';
import { LEVEL_DEFS } from '../data/levels';
import { clearFaultActions } from './replay';
import { newTicketProgress, type NodeState } from './state';
import { explainLevelMiss } from '../sim/explain';

const def = (id: string) => LEVEL_DEFS.find((d) => d.id === id)!;
function open(id: string, clear = true): Engine<NodeState> {
  const e = new Engine(GAME, { mode: 'learner' }); e.autosave = false;
  const st = structuredClone(e.state) as NodeState;
  for (const d of LEVEL_DEFS) { if (d.id === id) break; st.progress.tickets[d.id] = { ...newTicketProgress(), passed: true, stars: 1 }; }
  e.setState(st);
  expect(e.act('openTicket', [id]).ok).toBe(true);
  if (clear) for (const a of clearFaultActions(def(id))) expect(e.act(a.name, a.args ?? []).ok).toBe(true);
  return e;
}
const ok = (e: Engine<NodeState>, name: string, ...args: unknown[]) => { const r = e.act(name, args); expect(r.ok, `${name}: ${r.message}`).toBe(true); return r; };
const failText = (e: Engine<NodeState>): string => ((e.q('benchResult') as any).failures as any[]).map((f) => f.text).join(' | ');
/** Burn the LED live twice (power on, run until it smokes, fit a fresh one, again): the explainer's text for the second burn. */
function burnTwice(e: Engine<NodeState>, led: string): string {
  ok(e, 'power', true);
  for (let k = 0; k < 2; k++) {
    let smoked = false;
    for (let i = 0; i < 60 && !smoked; i++) smoked = (ok(e, 'advance', 8).smoked as string[]).includes(led);
    expect(smoked, `burn ${k + 1}`).toBe(true);
    if (k === 0) { ok(e, 'replaceSmoked', led); ok(e, 'power', true); }   // fitting a fresh part switches the bench off
  }
  const log = e.q('failureLog') as any[];
  return (e.q('explain', [log[log.length - 1].id]) as any).text as string;
}

describe('first-timer findings (Mina, 1-1..1-3)', () => {
  it('1. a part placed with no leg touching anything says so; a part with a leg on a wire end does not', () => {
    const e = open('1-1');
    const r = ok(e, 'placePart', 'res-cf', 220, '0.25W', 12, 10, 0, false);
    expect(r.message).toMatch(/Placed .*220 Ω/); expect(r.message).toMatch(/Its legs touch nothing yet: wire each leg\./);
    ok(e, 'addWire', [[2, 2], [2, 5]]);
    const r2 = ok(e, 'placePart', 'res-cf', 470, '0.25W', 2, 5, 0, false);
    expect(r2.message).not.toMatch(/touch nothing/);
  });

  it('2. an LED burnt straight on the battery while a resistor lies unwired: the text does not put that resistor "in the loop", it names it as not connected', () => {
    const e = open('1-1');
    ok(e, 'placePart', 'led-red-5mm', null, '5mm', 8, 5, 0, false);
    ok(e, 'addWire', [[2, 2], [2, 5], [8, 5]]); ok(e, 'addWire', [[10, 5], [10, 2], [8, 2]]);
    ok(e, 'placePart', 'res-cf', 220, '0.25W', 12, 10, 0, false);   // wired to nothing
    const txt = burnTwice(e, 'p1');   // the second burn is the "again" cadence that printed the worked formula
    expect(txt).toMatch(/[Bb]urned/);
    expect(txt).not.toMatch(/in the loop/); expect(txt).not.toMatch(/220 Ω is far below/);
    expect(txt).toMatch(/220 Ω .*not (wired|connected) into the LED's loop/);
  });

  it('3. the worked formula prints the exact resistance and the standard value, and calls the fitted resistor below it only when it is', () => {
    const e = open('1-1');
    ok(e, 'placePart', 'led-red-5mm', null, '5mm', 8, 5, 0, false);
    ok(e, 'placePart', 'res-cf', 100, '0.25W', 2, 5, 0, false);
    ok(e, 'addWire', [[2, 2], [2, 5]]); ok(e, 'addWire', [[6, 5], [8, 5]]); ok(e, 'addWire', [[10, 5], [10, 2], [8, 2]]);
    const txt = burnTwice(e, 'p1');
    expect(txt).toMatch(/with the 100 Ω ¼ W resistor in the loop/);
    expect(txt).toMatch(/= 46\d Ω/);                          // the exact value, not "about 470"
    expect(txt).toMatch(/470 Ω or more/); expect(txt).toMatch(/100 Ω is below that/);
    expect(txt).not.toMatch(/about 470 Ω, and/);
  });

  it('4. a value just outside a band never prints as the band edge (13.96 mA against 14 to 20 mA)', () => {
    const f = { key: 'bench.level.fail', vars: { probe: 'i(p1)', value: 0.01396, lo: 0.014, hi: 0.020, cond: 'tired' } } as any;
    const ex = explainLevelMiss(f, { names: { p1: 'LED 1' }, kinds: { p1: 'LED' } })!;
    expect(String(ex.vars.value)).not.toBe(String(ex.vars.lo));
    expect(Number(ex.vars.value)).toBeLessThan(14);
    const g = { key: 'bench.level.fail', vars: { probe: 'i(p1)', value: 0.020004, lo: 0.014, hi: 0.020, cond: 'nominal' } } as any;
    const ex2 = explainLevelMiss(g, { names: { p1: 'LED 1' }, kinds: { p1: 'LED' } })!;
    expect(Number(ex2.vars.value)).toBeGreaterThan(20);
    const h = { key: 'bench.level.fail', vars: { probe: 'i(p1)', value: 0.0037, lo: 0.014, hi: 0.020, cond: 'nominal' } } as any;
    expect(explainLevelMiss(h, { names: { p1: 'LED 1' }, kinds: { p1: 'LED' } })!.vars.value).toBe(3.7);   // far from the edge: as before
  });

  it('5. power off at TEST: the bench result comes first and the power note after it', () => {
    const e = open('1-1');
    const r = ok(e, 'runBench', true);
    expect(r.autoPowered).toBe(true);
    expect(r.message).not.toMatch(/^The power switch was off/);
    expect(r.message).toMatch(/The power switch was off, so the bench switched it on for you\.$/);
  });

  it('9. 1-3: a resistor that overheats gets a split suggestion in values the shoebox has (two 47 Ω, not two 44 Ω)', () => {
    const e = open('1-3');
    ok(e, 'placePart', 'res-cf', 22, '0.25W', 4, 2, 0, false);
    ok(e, 'addWire', [[2, 2], [4, 2]]); ok(e, 'addWire', [[8, 2], [14, 2]]);
    ok(e, 'runBench');
    const txt = failText(e);
    expect(txt).toMatch(/two 47 Ω resistors in parallel/);
    expect(txt).not.toMatch(/two 44 Ω/);
  });
});
