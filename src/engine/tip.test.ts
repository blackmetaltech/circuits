// 0.5 stakes: a customer waits at the counter. Fixed on the first bench test (the player's own TEST key), they tip; each failed
// test before the pass takes a step off, never below zero. 0.6 (D-money-06): the tip is 40 % of the fee to the nearest $0.25,
// the step 25 % of the tip to the nearest $0.05, and on the first ticket (1-1) a failed test costs nothing. Exams and the sandbox have no customer waiting;
// scripted bench runs (not the TEST key) neither earn nor lose the tip.
import { describe, expect, it } from 'vitest';
import { Engine } from '@core/kit';
import { GAME } from '../game';
import { LEVEL_DEFS } from '../data/levels';
import { refActions } from './replay';
import { newTicketProgress, type NodeState } from './state';
import { REGIONS } from '../regions';

const prices = REGIONS.get('global').data.prices;
const SHARE = prices['service:tipShare']!, STEP_SHARE = prices['service:tipStepShare']!;
const tipOf = (id: string) => Math.round((LEVEL_DEFS.find((d) => d.id === id)!.pay!.fee * SHARE) / 100 / 25) * 25;
const stepOf = (id: string) => (id === '1-1' ? 0 : Math.round((tipOf(id) * STEP_SHARE) / 100 / 5) * 5);

function open(id: string): Engine<NodeState> {
  const e = new Engine(GAME, { mode: 'learner' }); e.autosave = false;
  const st = structuredClone(e.state) as NodeState;
  for (const d of LEVEL_DEFS) { if (d.id === id) break; st.progress.tickets[d.id] = { ...newTicketProgress(), passed: true, stars: 1 }; }
  e.setState(st);
  expect(e.act('openTicket', [id]).ok).toBe(true);
  return e;
}
const def = (id: string) => LEVEL_DEFS.find((d) => d.id === id)!;
// the reference build without its own closing bench run (that run would be the pass and pay before the player's TEST)
const fix = (e: Engine<NodeState>, id: string) => { for (const a of refActions(def(id))) if (a.name !== 'runBench') expect(e.act(a.name, a.args ?? []).ok, a.name).toBe(true); };
const fee = (id: string) => LEVEL_DEFS.find((d) => d.id === id)!.pay!.fee;

describe('the waiting customer tips a first-test fix', () => {
  it('the game values: 40 % of the fee, a quarter of the tip a failed test; 1-1 $1.25, 1-2 $1.50 less $0.40, 3-3 $3.50 less $0.90', () => {
    expect(SHARE).toBe(40); expect(STEP_SHARE).toBe(25);
    expect([tipOf('1-1'), stepOf('1-1')]).toEqual([125, 0]);
    expect([tipOf('1-2'), stepOf('1-2')]).toEqual([150, 40]);
    expect([tipOf('3-3'), stepOf('3-3')]).toEqual([350, 90]);
  });

  it('1-1 fixed before the first TEST: the fee, the star bonus and the full tip', () => {
    const e = open('1-1');
    fix(e, '1-1');
    const r = e.act('runBench', [true]);
    expect(r.ok && (r as any).pass).toBe(true);
    expect((r as any).tip).toBe(tipOf('1-1'));
    expect(((r as any).pay as number) - tipOf('1-1')).toBeGreaterThanOrEqual(fee('1-1'));
  });

  it('1-1, the first ticket: failed tests do not cost the tip', () => {
    const e = open('1-1');
    for (let i = 0; i < 2; i++) expect((e.act('runBench', [true]) as any).pass).toBe(false);
    expect((e.state as NodeState).ticket!.failedTests).toBe(2);
    fix(e, '1-1');
    expect((e.act('runBench', [true]) as any).tip).toBe(tipOf('1-1'));
  });

  it('1-2 tested twice as it came in, then fixed: two steps off the tip', () => {
    const e = open('1-2');
    for (let i = 0; i < 2; i++) expect((e.act('runBench', [true]) as any).pass).toBe(false);
    fix(e, '1-2');
    expect((e.act('runBench', [true]) as any).tip).toBe(tipOf('1-2') - 2 * stepOf('1-2'));
  });

  it('five failed tests use the tip up; it never goes negative', () => {
    const e = open('1-2');
    for (let i = 0; i < 5; i++) e.act('runBench', [true]);
    fix(e, '1-2');
    const r = e.act('runBench', [true]);
    expect((r as any).pass).toBe(true); expect((r as any).tip ?? 0).toBe(0);
  });

  it('a scripted bench run (not the TEST key) neither counts against the tip nor earns it', () => {
    const e = open('1-1');
    e.act('runBench', []);
    expect((e.state as NodeState).ticket!.failedTests ?? 0).toBe(0);
    fix(e, '1-1');
    expect((e.act('runBench', []) as any).tip ?? 0).toBe(0);
  });

  it('an exam card has no customer waiting: no tip', () => {
    const exam = LEVEL_DEFS.find((d) => d.eb === true && d.pay)!;
    const e = open(exam.id);
    fix(e, exam.id);
    const r = e.act('runBench', [true]);
    expect((r as any).tip ?? 0).toBe(0);
  });
});

describe('the condition dial (0.6, D-money-06)', () => {
  it('costs $15.00 from the wallet, once; with too little money it is refused and says the price', () => {
    const e = open('1-2');
    const st = structuredClone(e.state) as NodeState; st.progress.wallet = 1400; e.setState(st);
    const no = e.act('buyUpgrade', ['condition-dial']);
    expect(no.ok).toBe(false); expect(no.message).toContain('$15.00');
    const st2 = structuredClone(e.state) as NodeState; st2.progress.wallet = 2000; e.setState(st2);
    expect(e.act('buyUpgrade', ['condition-dial']).ok).toBe(true);
    expect((e.state as NodeState).progress.wallet).toBe(500);
    expect((e.state as NodeState).progress.upgrades).toEqual(['condition-dial']);
    expect(e.act('buyUpgrade', ['condition-dial']).ok).toBe(false);
  });
  it('1-2: without the dial the live bench cannot switch to the tired battery; with it, the live LED current drops on the tired battery', () => {
    const e = open('1-2');
    fix(e, '1-2');
    expect(e.act('setCondition', ['tired']).ok).toBe(false);
    const st = structuredClone(e.state) as NodeState; st.progress.upgrades = ['condition-dial']; e.setState(st);
    const led = () => { e.act('power', [true]); e.act('advance', [4]); const f = e.q('liveFrame') as any; const p = f.parts.find((x: any) => x.led); return Math.abs(p.led.i); };
    const fresh = led();
    expect(e.act('setCondition', ['tired']).ok).toBe(true);
    const tired = led();
    expect(tired).toBeLessThan(fresh - 0.002);                      // 8.4 V and 6 ohm against 9.0 V and 1.7 ohm: about 16 mA against 19.6 mA
    expect(tired).toBeGreaterThan(0.014);                           // the reference still passes there
    expect(e.act('setCondition', ['hot']).ok).toBe(false);
    expect(e.act('setCondition', [null]).ok).toBe(true);
  });
});

describe('no customer waits on your own bench (0.6)', () => {
  it('4-4 is your own 3.3 V rail: no tip and no waiting line', () => {
    const e = open('4-4');
    expect((e.q('bench') as any).waiting ?? false).toBe(false);
    fix(e, '4-4');
    const r = e.act('runBench', [true]);
    expect((r as any).pass).toBe(true); expect((r as any).tip ?? 0).toBe(0);
  });
});
