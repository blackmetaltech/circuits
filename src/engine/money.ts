// 0.6 "money that buys something" (D-money-06, Mateo and Ingrid): the waiting customer's tip is a share of the fee, and the wallet
// buys the condition dial, which lets the live bench run any of a ticket's test conditions (the tired battery, a threshold corner)
// before the player presses TEST. The sandbox and the testbed have the dial for free; learning stays free, checking a customer's
// job before the test is what money buys. Pure functions of the state and the price pack.
import type { LevelDef } from '../data/levels/types';
import type { NodeState, TicketState } from './state';
import { REGIONS } from '../regions';
import { i18n, t } from '../i18n';

export const DIAL = 'condition-dial';
/** The first ticket teaches the bench: its customer tips, but a failed test does not cost the tip there. */
export const FIRST_TICKET = '1-1';

const prices = (s: NodeState) => REGIONS.get(s.region).data.prices;
const roundTo = (x: number, step: number): number => Math.round(x / step) * step;

/** The tip a waiting customer starts with: service:tipShare % of the fee, to the nearest quarter (25 minor units). */
export function tipBase(s: NodeState, def: LevelDef): number {
  return def.pay ? roundTo((def.pay.fee * (prices(s)['service:tipShare'] ?? 0)) / 100, 25) : 0;
}
/** What one failed TEST takes off: service:tipStepShare % of the starting tip, to the nearest 5 minor units; nothing on the first ticket. */
export function tipStep(s: NodeState, def: LevelDef): number {
  if (def.id === FIRST_TICKET) return 0;
  return roundTo((tipBase(s, def) * (prices(s)['service:tipStepShare'] ?? 0)) / 100, 5);
}
export function tipLeft(s: NodeState, def: LevelDef, tk: TicketState): number {
  return Math.max(0, tipBase(s, def) - tipStep(s, def) * (tk.failedTests ?? 0));
}

export const upgradePrice = (s: NodeState, id: string): number => prices(s)[`upgrade:${id}`] ?? 0;
export const hasDial = (s: NodeState): boolean => s.mode === 'sandbox' || s.progress.upgrades.includes(DIAL);

/** A condition's name for the dial: the i18n key cond.<id> when there is one, else the id as the level wrote it. */
const COND_KEYS: Record<string, string> = { fresh: 'cond.fresh', tired: 'cond.tired', nominal: 'cond.nominal', reset: 'cond.reset' };
export function condLabel(id: string): string {
  const k = COND_KEYS[id];
  return k && i18n.has(k) ? t(k) : id;
}
