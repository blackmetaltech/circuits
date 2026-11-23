// 0.5 stakes: a customer waits at the counter. Fixed on the first bench test (the player's own TEST key), they tip service:tip;
// each failed test before the pass takes service:tipStep off, never below zero. Exams and the sandbox have no customer waiting;
// scripted bench runs (not the TEST key) neither earn nor lose the tip.
import { describe, expect, it } from 'vitest';
import { Engine } from '@core/kit';
import { GAME } from '../game';
import { LEVEL_DEFS } from '../data/levels';
import { refActions } from './replay';
import { newTicketProgress, type NodeState } from './state';
import { REGIONS } from '../regions';

const prices = REGIONS.get('global').data.prices;
const TIP = prices['service:tip']!, STEP = prices['service:tipStep']!;

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
  it('the game values: $2.00, $0.50 a failed test', () => {
    expect(TIP).toBe(200); expect(STEP).toBe(50);
  });

  it('1-1 fixed before the first TEST: the fee, the star bonus and the full tip', () => {
    const e = open('1-1');
    fix(e, '1-1');
    const r = e.act('runBench', [true]);
    expect(r.ok && (r as any).pass).toBe(true);
    expect((r as any).tip).toBe(TIP);
    expect(((r as any).pay as number) - TIP).toBeGreaterThanOrEqual(fee('1-1'));
  });

  it('1-1 tested twice as it came in, then fixed: the tip is $1.00', () => {
    const e = open('1-1');
    for (let i = 0; i < 2; i++) expect((e.act('runBench', [true]) as any).pass).toBe(false);
    expect((e.state as NodeState).ticket!.failedTests).toBe(2);
    fix(e, '1-1');
    expect((e.act('runBench', [true]) as any).tip).toBe(TIP - 2 * STEP);
  });

  it('five failed tests use the tip up; it never goes negative', () => {
    const e = open('1-1');
    for (let i = 0; i < 5; i++) e.act('runBench', [true]);
    fix(e, '1-1');
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
