// Round C2-1: the number echoed in the 2-2 failure text is the number on the slip, and the engraved marks and slots come from the engine.
import { describe, expect, it } from 'vitest';
import { Engine } from '@core/kit';
import { GAME } from '../game';
import { LEVEL_DEFS } from '../data/levels';
import { refActions } from './replay';
import { newTicketProgress, type NodeState } from './state';

function open(id: string): Engine<NodeState> {
  const e = new Engine(GAME, { mode: 'learner' }); e.autosave = false;
  const st = structuredClone(e.state) as NodeState;
  for (const d of ['1-4', '2-1', '2-2', '2-3']) st.progress.tickets[d] = { ...newTicketProgress(), passed: true, stars: 1 };
  e.setState(st); expect(e.act('openTicket', [id]).ok).toBe(true); return e;
}
const q = (e: Engine<NodeState>, n: string) => e.q(n, []) as any;

describe('C2-1 echo, marks and slots', () => {
  it('2-2: the failure text quotes the typed distance to six figures (13374.9, not 13370)', () => {
    const e = open('2-2');
    for (const a of refActions(LEVEL_DEFS.find((d) => d.id === '2-2')!).filter((x) => !['runBench', 'power', 'advance'].includes(x.name))) expect(e.act(a.name, a.args ?? []).ok).toBe(true);
    expect(e.act('predict', ['dist', 13374.9]).ok).toBe(true); e.act('runBench', []);
    expect(q(e, 'benchResult').failures.map((f: any) => f.text).join(' ')).toMatch(/You gave 13374\.9 m/);
  });
  it('the bridge terminals A, J, B and the junction C are engraved, and the plug and galvanometer slots clear once filled', () => {
    const e = open('2-2'), b = q(e, 'bench');
    expect(b.marks.map((m: any) => m.text).sort()).toEqual(['A', 'B', 'C', 'J']);
    expect(b.slots.map((s: any) => [s.id, s.filled, s.text])).toEqual([['plug', false, 'R plug here'], ['galvo', false, 'galvanometer here']]);
    e.act('placePart', ['galvanometer', null, '100ohm', 13, 8, 0, false]);
    expect(q(e, 'bench').slots.find((s: any) => s.id === 'galvo').filled).toBe(true);
    expect(open('2-4') && q(open('2-4'), 'bench').marks.map((m: any) => m.text).sort()).toEqual(['A', 'B', 'J']);
  });
});
