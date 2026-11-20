// N5 (fresh Class-11 play-tester, Steam Deck): the bench never shows solver internals, the 1-1 220 ohm build in every arrangement says "too much current",
// the 1-5 exam grades the predictions.
import { describe, expect, it } from 'vitest';
import { Engine } from '@core/kit';
import { GAME } from '../game';
import { LEVEL_DEFS } from '../data/levels';
import { newTicketProgress, type NodeState } from './state';
import { explainFailure } from '../sim/explain';
import { say } from './text';
const text = (x: { key: string; vars: Record<string, string | number> }): string => say(x.key, x.vars);

export function open(id: string): Engine<NodeState> {
  const e = new Engine(GAME, { mode: 'learner' }); e.autosave = false;
  const st = structuredClone(e.state) as NodeState;
  for (const d of LEVEL_DEFS.filter((x) => x.chapter === 1)) { if (d.id === id) break; st.progress.tickets[d.id] = { ...newTicketProgress(), passed: true, stars: 1 }; }
  e.setState(st);
  expect(e.act('openTicket', [id]).ok).toBe(true);
  return e;
}
export const ok = (e: Engine<NodeState>, name: string, ...args: unknown[]) => { const r = e.act(name, args); expect(r.ok, `${name} ${JSON.stringify(args)}: ${r.message}`).toBe(true); return r as any; };
export const q = (e: Engine<NodeState>, name: string, ...args: unknown[]) => e.q(name, args) as any;
const SOLVER_WORDS = /simulation|smallest step|changes too violently|\bv\(|solver|t = \d/i;

describe('N5: 1-1 at 220 ohm, every arrangement', () => {
  // resistor before the LED, after it, LED placed first or second
  const builds: Record<string, (e: Engine<NodeState>) => void> = {
    'R then LED (ref layout)': (e) => { ok(e, 'placePart', 'res-cf', 220, '0.25W', 2, 5, 0, false); ok(e, 'placePart', 'led-red-5mm', null, '5mm', 8, 5, 0, false); ok(e, 'addWire', [[2, 2], [2, 5]]); ok(e, 'addWire', [[6, 5], [8, 5]]); ok(e, 'addWire', [[10, 5], [10, 2], [8, 2]]); },
    'LED then R (resistor on the ground side)': (e) => { ok(e, 'placePart', 'led-red-5mm', null, '5mm', 4, 5, 0, false); ok(e, 'placePart', 'res-cf', 220, '0.25W', 8, 8, 0, false); ok(e, 'wire', [2, 2], [4, 5]); ok(e, 'wire', [6, 5], [8, 8]); ok(e, 'wire', [12, 8], [8, 2]); },
    'the tester build (LED first, resistor at the far right)': (e) => { ok(e, 'placePart', 'led-red-5mm', null, '5mm', 8, 5, 0, false); ok(e, 'placePart', 'res-cf', 220, '0.25W', 13, 8, 0, false); ok(e, 'wire', [2, 2], [8, 5]); ok(e, 'wire', [10, 5], [13, 8]); ok(e, 'wire', [17, 8], [8, 2]); },
  };
  for (const [name, build] of Object.entries(builds)) for (const mode of ['learner', 'engineer']) {
    it(`${name} (${mode}): bench says "too much current: 30.9 mA", no solver words`, () => {
      const e = new Engine(GAME, { mode }); e.autosave = false; expect(e.act('openTicket', ['1-1']).ok).toBe(true);
      build(e);
      for (const power of [false, true]) {   // every bench condition: power switch off (auto-powered) and on
        if (power) { ok(e, 'power', true); ok(e, 'advance', 3); }
        ok(e, 'runBench', true);
        const b = q(e, 'benchResult');
        expect(b.pass).toBe(false);
        const all = b.failures.map((f: any) => f.text).join(' | ');
        expect(all).toMatch(/Too much current through the LED: 30\.9 mA/);
        expect(all).not.toMatch(SOLVER_WORDS);
      }
    });
  }
});

describe('N5: a solver stall is never shown as a solver stall', () => {
  it('tran.noConverge / solve.noConverge map to plain words, with the last good reading when the bench has one', () => {
    const names = { p1: 'the LED' }, kinds = { p1: 'LED' };
    const a = text(explainFailure({ key: 'tran.noConverge', vars: { t: 0.000101, h: 1e-7, where: 'v(vp)', cond: 'nominal', probe: 'i(p1)', value: 0.0309 } }, { miss: { names, kinds } }));
    expect(a).toMatch(/last good reading of the LED was about 30\.9 mA/); expect(a).not.toMatch(SOLVER_WORDS);
    const b = text(explainFailure({ key: 'tran.noConverge', vars: { t: 0.000101, h: 1e-7, where: 'v(vp)', cond: 'tired' } }, {}));
    expect(b).toMatch(/couldn't get a steady reading/); expect(b).toMatch(/in the tired test/); expect(b).not.toMatch(SOLVER_WORDS);
    const c = text({ key: 'tran.noConverge', vars: { t: 0.000101, where: 'v(vp)' } });
    expect(c).not.toMatch(SOLVER_WORDS);
    expect(text({ key: 'solve.noConverge', vars: { node: 'n2', elements: 'p1' } })).not.toMatch(/solver/i);
  });
});

describe('N5: the 1-5 exam grades the predictions', () => {
  const build15 = (pva: number, pie2: number): Engine<NodeState> => {
    const e = open('1-5');
    ok(e, 'predict', 'pva', pva); ok(e, 'predict', 'pie2', pie2);
    ok(e, 'placePart', 'res-exact', 2, 'ideal', 4, 2, 0, false); ok(e, 'placePart', 'res-exact', 3, 'ideal', 10, 4, 0, false); ok(e, 'placePart', 'res-exact', 6, 'ideal', 8, 7, 1, false);
    for (const w of [[[2, 2], [4, 2]], [[8, 2], [8, 6]], [[14, 2], [14, 4]], [[10, 4], [10, 6], [8, 6]], [[8, 6], [8, 7]], [[8, 11], [8, 12]]]) ok(e, 'addWire', w);
    ok(e, 'attachProbe', 1, [8, 6]);
    ok(e, 'runBench', true);
    return e;
  };
  it('wrong predictions (7.5 V, 0.8 A) on a correct build: 1 star, the slip says by how much and why', () => {
    const e = build15(7.5, 0.8), b = q(e, 'benchResult');
    expect(b.pass).toBe(true); expect(b.stars).toBe(1);
    expect(b.predictions.map((p: any) => p.grade)).toEqual(['miss', 'miss']);
    const d = b.debrief;
    expect(d.equation).toBe('(10 − A)/2 + (5 − A)/3 = A/6'); expect(d.answer).toBe('A = 6.667 V');
    expect(d.working.join(' ')).toMatch(/Multiply through by 6/);
    expect(d.rows[0]).toMatchObject({ unit: 'V', entered: 7.5, ok: false }); expect(d.rows[0].gapPct).toBeCloseTo(12.5, 0);
    expect(d.rows[1]).toMatchObject({ unit: 'A', entered: 0.8, ok: false }); expect(d.rows[1].truth).toBeCloseTo(0.5556, 3);
    expect(d.currents.map((c: any) => [c.name, c.charging])).toEqual([['E1', false], ['E2', true]]);
    expect(d.currents[1].text).toMatch(/E2 is CHARGING: 0\.5556 A/); expect(d.currents[0].text).toMatch(/E1 is DISCHARGING: it pushes 1\.667 A/);
    expect(d.starsText).toMatch(/^1 star/);
  });
  it('within 5 % earns 2 stars, within 1 % earns 3', () => {
    const two = build15(6.9, 0.57), b2 = q(two, 'benchResult');
    expect(b2.pass).toBe(true); expect(b2.stars).toBe(2); expect(b2.predictions.map((p: any) => p.grade)).toEqual(['close', 'close']); expect(b2.debrief.starsText).toMatch(/^2 stars/);
    const three = build15(6.7, 0.56), b3 = q(three, 'benchResult');
    expect(b3.stars).toBe(3); expect(b3.predictions.map((p: any) => p.grade)).toEqual(['exact', 'exact']); expect(b3.debrief.starsText).toMatch(/^3 stars/);
    const one = build15(6.7, 0.7), b1 = q(one, 'benchResult');   // one prediction off: the weakest decides
    expect(b1.stars).toBe(1);
  });
  it('the card states the rule before lock-in', () => {
    const e = open('1-5');
    expect(q(e, 'ticketCard').starRule).toMatch(/3 stars: every prediction within 1 %.*2 stars.*5 %.*1 star/);
  });
});
