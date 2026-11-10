// Teaching text: i18n keys + variables to English, with numbers rounded to 3 significant figures (DESIGN §7.5).
import { fail } from '@core/kit';
import { t } from '../i18n';
import { sig } from '../sim/explain';
import type { Problem } from './board';

export type Vars = Record<string, string | number>;
/** Non-integer numbers to 3 significant figures; integers, strings and counts unchanged. */
export function fmtVars(v: Vars): Vars {
  const o: Vars = {};
  for (const [k, x] of Object.entries(v)) o[k] = typeof x === 'number' && Number.isFinite(x) && !Number.isInteger(x) ? sig(x, 3) : x;
  return o;
}
export const say = (key: string, vars: Vars = {}): string => t(key, fmtVars(vars));
/** Reject the action with a teaching message. */
export const refuse = (p: Problem): never => fail(say(p.key, p.vars));
export const refuseKey = (key: string, vars: Vars = {}): never => fail(say(key, vars));
