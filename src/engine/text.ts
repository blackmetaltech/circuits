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
const capFirst = (s: string): string => (s === '' ? s : s[0]!.toUpperCase() + s.slice(1));
/** {Part} (sentence start) always travels with {part}. */
/** Plural words that follow a count `n` ({wires}, {ends}, {hang}), so no string says "wire(s)". */
const plurals = (v: Vars): Vars => {
  const o: Vars = { ...v };
  if (typeof v.n === 'number') Object.assign(o, { wires: v.n === 1 ? 'wire' : 'wires', ends: v.n === 1 ? 'end' : 'ends', hang: v.n === 1 ? 'hangs' : 'hang', problems: v.n === 1 ? 'problem' : 'problems' }, v);
  if (typeof v.stars === 'number') Object.assign(o, { starWord: v.stars === 1 ? 'star' : 'stars' }, v);
  return o;
};
export const say = (key: string, vars: Vars = {}): string => t(key, fmtVars(plurals(typeof vars.part === 'string' && vars.Part === undefined ? { ...vars, Part: capFirst(vars.part) } : vars)));
/** Reject the action with a teaching message. */
export const refuse = (p: Problem): never => fail(say(p.key, p.vars));
export const refuseKey = (key: string, vars: Vars = {}): never => fail(say(key, vars));
