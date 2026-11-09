// Levels: a setup, a goal, a failure rule and a solver bot that proves the level can be passed.
// M0 PLACEHOLDER: one level `0-0` with an empty board whose setup opens the placeholder ticket. It cannot be won (goal is always
// false, the solver does nothing), so `checkAllLevels` reports exactly one problem for it: PLACEHOLDER_SOLVER_PROBLEM. regions.test.ts
// asserts that exact problem rather than faking a win. M2 replaces this with one core Level per ticket (setup = open the ticket,
// goal = bench passed, solver = the ref replay), DESIGN §8.3.
import type { Level } from '@core/kit';
import { openTicketIn } from './engine/tickets';
import type { NodeState } from './engine/state';
import { t } from './i18n';

/** Ticks the placeholder allows before it is lost. */
export const PLACEHOLDER_MAX_TICKS = 5;
/** The one problem `checkAllLevels` must report for the placeholder level. */
export const PLACEHOLDER_SOLVER_PROBLEM = `solver did not pass (Out of time: ${PLACEHOLDER_MAX_TICKS} ticks allowed.)`;

export const LEVELS: Level<NodeState>[] = [
  {
    id: '0-0', title: t('level.0-0.title'), brief: t('level.0-0.brief'),
    setup: (s) => { openTicketIn(s, '0-0'); },
    goal: () => false,
    maxTicks: PLACEHOLDER_MAX_TICKS,
    solver: () => () => [],
  },
];
