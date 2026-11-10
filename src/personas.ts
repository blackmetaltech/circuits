// Scripted players for playtests, soak runs and title-screen demos. They drive the real engine through Env.step (DESIGN §8.7).
//  idle    opens nothing by itself; with a ticket open it powers on and runs the bench once, nothing else (must never pass a build ticket)
//  expert  replays the ticket's ref solution (opens the first unpassed ticket when none is open)
//  monkey  random probe-filtered legal actions (must never break an invariant)
// Novice / smoker / cheese-seeker arrive with the real tickets (M2-2).
import type { Action, PersonaFactory } from '@core/kit';
import { LEVEL_DEFS } from './data/levels';
import type { NodeState } from './engine/state';
import { refActions } from './engine/replay';
import { levelDefOf } from './engine/tickets';

export function makePersonas(defs: typeof LEVEL_DEFS): Record<string, PersonaFactory<NodeState>> {
  return {
    idle: () => (s) => {
      const tk = s.ticket; if (!tk || tk.lastBench) return [];
      return tk.live.powered ? [{ name: 'runBench' }] : [{ name: 'power', args: [true] }];
    },
    expert: () => (s) => {
      if (!s.ticket) { const d = defs.find((x) => !s.progress.tickets[x.id]?.passed) ?? defs[0]; return d ? [{ name: 'openTicket', args: [d.id] }] : []; }
      const def = levelDefOf(defs, s.ticket.id);
      if (!def || s.ticket.lastBench || s.ticket.board.parts.some((p) => !p.fixed)) return [];
      return refActions(def);
    },
    monkey: () => (_s, ctx) => {
      const legal = ctx.legal().filter((a) => a.name !== 'tick');
      const out: Action[] = [];
      const n = ctx.rng.int(1, 3);
      for (let i = 0; i < n && legal.length > 0; i++) out.push(ctx.rng.pick(legal));
      return out;
    },
  };
}
export const PERSONAS: Record<string, PersonaFactory<NodeState>> = makePersonas(LEVEL_DEFS);
