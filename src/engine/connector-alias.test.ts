// 0.6 (Asha, playtester persona, on 1-3): the heater arrives linked straight to IN, so IN and OUT are one net that carries one name.
// The first bench test said "v(out) ... not on the board yet"; it must say the link wire joins them and what to do.
import { describe, expect, it } from 'vitest';
import { Engine } from '@core/kit';
import { GAME } from '../game';
import { LEVEL_DEFS } from '../data/levels';
import { newTicketProgress, type NodeState } from './state';

describe('a connector joined to another by one wire still answers to its own name', () => {
  it('1-3 as it arrives: the bench says OUT is wired straight to IN, not "not on the board yet"', () => {
    const e = new Engine(GAME, { mode: 'learner' }); e.autosave = false;
    const st = structuredClone(e.state) as NodeState;
    for (const d of LEVEL_DEFS.filter((x) => x.chapter === 1)) { if (d.id === '1-3') break; st.progress.tickets[d.id] = { ...newTicketProgress(), passed: true, stars: 1 }; }
    e.setState(st);
    expect(e.act('openTicket', ['1-3']).ok).toBe(true);
    expect(e.act('runBench', []).ok).toBe(true);
    const f = (e.q('benchResult', []) as { failures: { key: string; text: string }[] }).failures;
    expect(f.map((x) => x.key)).not.toContain('bench.part.missing');
    expect(f.map((x) => x.text).join(' ')).toMatch(/OUT is wired straight to IN, so nothing sits between them to test/);
  });
});
