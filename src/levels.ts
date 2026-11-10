// Core Levels (DESIGN §8.3): one per ticket, built from the SAME data as the campaign ticket. setup = open the ticket on a fresh state,
// goal = the bench passed, solver = the ref replay, so `checkAllLevels` and the persona runner exercise the campaign code path.
// Adding a ticket is a data-only change (src/data/levels). The campaign never uses startLevel (it would wipe progress): see game.ts.
import type { Level } from '@core/kit';
import type { LevelDef } from './data/levels/types';
import { LEVEL_DEFS } from './data/levels';
import type { NodeState } from './engine/state';
import { openTicketIn } from './engine/tickets';
import { refActions } from './engine/replay';
import { t } from './i18n';

/** Turns a core Level allows before it is lost. */
export const LEVEL_MAX_TICKS = 10;

export function coreLevels(defs: readonly LevelDef[]): Level<NodeState>[] {
  return defs.map((def) => ({
    id: def.id,
    title: t(def.titleKey),
    brief: t('level.brief', { id: def.id, title: t(def.titleKey) }),
    concepts: def.teaches,
    setup: (s) => { openTicketIn(s, def); },
    goal: (s) => !!s.ticket?.lastBench?.pass,
    maxTicks: LEVEL_MAX_TICKS,
    solver: () => { let done = false; return () => { if (done) return []; done = true; return refActions(def); }; },
  }));
}

export const LEVELS: Level<NodeState>[] = coreLevels(LEVEL_DEFS);
