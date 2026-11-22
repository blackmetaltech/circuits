// The bench's flop limit covers the whole bench, every condition together (DESIGN 3.11; Tomasz's review, 11-23). Before the
// fix each condition got the full limit, so a three-condition ticket could take three times the budget.
import { describe, expect, it } from 'vitest';
import { Engine } from '@core/kit';
import { GAME } from '../../game';
import { LEVEL_DEFS } from '../../data/levels';
import { refActions } from '../../engine/replay';
import { hiddenOverrides } from '../../engine/ticket-run';
import { newTicketProgress, type NodeState } from '../../engine/state';
import { getDef } from '../../engine/board';
import { runTicketBench } from './ticket';

function refTicket(id: string) {
  const e = new Engine(GAME, { mode: 'learner' }); e.autosave = false;
  const st = structuredClone(e.state) as NodeState;
  for (const d of LEVEL_DEFS) { if (d.id === id) break; st.progress.tickets[d.id] = { ...newTicketProgress(), passed: true, stars: 1 }; }
  e.setState(st);
  const def = LEVEL_DEFS.find((d) => d.id === id)!;
  expect(e.act('openTicket', [id]).ok).toBe(true);
  for (const a of refActions(def)) expect(e.act(a.name, a.args ?? []).ok).toBe(true);
  return { def, tk: (e.state as NodeState).ticket! };
}

describe('flop limit per bench', () => {
  it('1-2 (two conditions): a limit that fits one condition but not both refuses the bench', () => {
    const { def, tk } = refTicket('1-2');
    expect(def.bench.conditions.length).toBe(2);
    const run = (plan: typeof def.bench, flopLimit: number) => runTicketBench({ board: tk.board, getDef, supplies: def.supplies, plan, hidden: hiddenOverrides(def, tk), supply: tk.instruments.supply, gen: tk.instruments.gen, smoked: [], predictions: {}, flopLimit });
    const tooBig = (o: ReturnType<typeof run>) => o.failures.some((f) => f.key === 'bench.cost.too-big');
    expect(tooBig(run(def.bench, 1.5e9))).toBe(false);
    // the smallest limit one condition fits in (bisection on the refusal itself, no access to private estimates)
    const one = { ...def.bench, conditions: [def.bench.conditions[0]!] };
    let lo = 1, hi = 1.5e9;
    for (let i = 0; i < 60 && hi / lo > 1.001; i++) { const m = Math.sqrt(lo * hi); if (tooBig(run(one, m))) lo = m; else hi = m; }
    expect(tooBig(run(one, hi * 1.2))).toBe(false);
    expect(tooBig(run(def.bench, hi * 1.2))).toBe(true);    // per condition this passed; per bench it must not
    expect(tooBig(run(def.bench, hi * 2.2))).toBe(false);   // two conditions of the same size fit in a little over twice
  });
});
