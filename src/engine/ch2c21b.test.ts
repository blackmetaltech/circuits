// Chapter 2 round C2-1, engine side, part 2: the signed null detector.
import { describe, expect, it } from 'vitest';
import { Engine } from '@core/kit';
import { GAME } from '../game';
import { LEVEL_DEFS } from '../data/levels';
import { refActions } from './replay';
import { newTicketProgress, type NodeState } from './state';

const def = (id: string) => LEVEL_DEFS.find((d) => d.id === id)!;
function open(id: string, passed: string[] = ['1-4', '2-1', '2-2', '2-3']): Engine<NodeState> {
  const e = new Engine(GAME, { mode: 'learner' }); e.autosave = false;
  const st = structuredClone(e.state) as NodeState;
  for (const d of passed) st.progress.tickets[d] = { ...newTicketProgress(), passed: true, stars: 1 };
  e.setState(st);
  expect(e.act('openTicket', [id]).ok, `open ${id}`).toBe(true);
  return e;
}
const ok = (e: Engine<NodeState>, name: string, ...args: unknown[]) => { const r = e.act(name, args); expect(r.ok, `${name} ${JSON.stringify(args)}: ${r.message}`).toBe(true); return r; };
const q = (e: Engine<NodeState>, name: string, ...args: unknown[]) => e.q(name, args) as any;
const runRef = (e: Engine<NodeState>, id: string) => { for (const a of refActions(def(id)).filter((x) => x.name !== 'runBench' && x.name !== 'power' && x.name !== 'advance')) ok(e, a.name, ...(a.args ?? [])); };

describe('the null detector is signed and says which way to slide', () => {
  const live = (id: string, jockeyMm: number) => {
    const e = open(id); runRef(e, id); if (id === '2-4') for (const k of ['pgrad', 'pemf', 'pr']) ok(e, 'predict', k, 1);
    ok(e, 'power', true); ok(e, 'setJockey', 'f3', jockeyMm); ok(e, 'advance', 2); return e;
  };
  const gauge = (e: Engine<NodeState>) => q(e, 'scope').gauge;
  it('2-4: left of 750 mm reads negative and says slide right, right of it positive and slide left, on the mark it says so', () => {
    const a = gauge(live('2-4', 700)); expect(a).toMatchObject({ slide: 'right', slideText: 'slide right' }); expect(a.signed).toBeLessThan(-100); expect(a.signedText).toMatch(/^-\d/);
    const b = gauge(live('2-4', 800)); expect(b).toMatchObject({ slide: 'left' }); expect(b.signedText).toMatch(/^\+\d/);
    expect(gauge(live('2-4', 750))).toMatchObject({ slide: 'on', slideText: 'on balance' });
  });
  it('2-2: the arrow always points toward the null: following it shrinks the reading', () => {
    for (const mm of [300, 350, 450, 500]) {
      const e = live('2-2', mm), g = gauge(e), dir = g.slide === 'right' ? 1 : -1; expect(['left', 'right']).toContain(g.slide);
      ok(e, 'setJockey', 'f3', mm + dir * 10); ok(e, 'advance', 1); expect(Math.abs(gauge(e).signed), `${mm}`).toBeLessThan(Math.abs(g.signed));
    }
    expect(gauge(live('2-2', 400)).slide).toBe('on');
  });
  it('a ticket whose gauge is not a null detector has no signed reading', () => {
    const e = open('2-1', ['1-4']); runRef(e, '2-1'); ok(e, 'power', true); ok(e, 'advance', 2); expect(gauge(e).signed).toBe(null); expect(gauge(e).slide).toBe(null);
  });
});
