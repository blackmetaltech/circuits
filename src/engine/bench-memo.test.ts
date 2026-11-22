// The bench memo must be invisible: the same answer as the raw bench on every board, and no aliasing between callers.
import { describe, expect, it } from 'vitest';
import { Engine } from '@core/kit';
import { GAME } from '../game';
import { benchTicket, benchTicketRaw } from './ticket-run';
import { LEVEL_DEFS } from '../data/levels';
import { refActions } from './replay';

const defOf = (id: string) => LEVEL_DEFS.find((d) => d.id === id)!;

describe('bench memo', () => {
  it.each([['1-1'], ['5-1']])('%s: memo equals raw on an empty, a part-missing and the reference board, before and after a committed bench', (id) => {
    const e = new Engine(GAME); e.act('newGame', [1, 'sandbox']); expect(e.act('openTicket', [id]).ok).toBe(true);
    const def = defOf(id);
    const check = () => { const s = e.state as any; expect(benchTicket(s, def)).toEqual(benchTicketRaw(s, def)); expect(benchTicket(s, def)).toEqual(benchTicketRaw(s, def)); };
    check();
    const acts = refActions(def).filter((x) => x.name !== 'runBench');
    e.act(acts[0]!.name, acts[0]!.args ?? []); check();                       // one part: the specs' other parts are missing
    for (const x of acts.slice(1)) e.act(x.name, x.args ?? []);
    check();                                                                  // the reference board, powered
    expect(e.act('runBench').ok).toBe(true); check();                         // after a committed bench
    const a = benchTicket(e.state as any, def), b = benchTicket(e.state as any, def);
    (a.result as any).pay = 999; a.result.failures.push({ key: 'x', vars: {} });
    expect((b.result as any).pay).toBeUndefined(); expect(b.result.failures.some((f) => f.key === 'x')).toBe(false);
  });
});
