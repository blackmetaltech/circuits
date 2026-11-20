// The exam debrief (N5): what the 1-5 slip shows after the bench. The engine owns every number: the nodal (KCL) equation worked out from the printed
// figure, the answers, charging or discharging, and the player's predictions graded against the measured truth.
import type { ExamFigure } from '../data/levels/types';
import { sig } from '../sim/explain';
import { say } from './text';

export interface DebriefRow { id: string; name: string; unit: string; entered: number; truth: number; gapPct: number; grade: string; gradeText: string; ok: boolean }
export interface Debrief {
  node: string;
  /** KCL at the node, as the student writes it: (10 - A)/2 + (5 - A)/3 = A/6 */
  equation: string;
  /** The working, one line each (multiply through, collect, solve). */
  working: string[];
  /** The answer line: A = 6.667 V */
  answer: string;
  /** One line per source: how much it delivers or takes, and which. */
  currents: { name: string; amps: number; charging: boolean; text: string }[];
  /** Predicted vs measured with the % error. */
  rows: DebriefRow[];
  /** How the stars were earned: the rule and where the player landed. */
  starsText: string;
}

const num = (x: number): string => String(sig(x, 4));
const abs = (x: number): number => Math.abs(x);

/** Solve the node: sum((E_k - A)/R_k) = A/R_L. */
export function solveFigure(f: ExamFigure): { a: number; into: number[] } {
  let num2 = 0, den = 1 / f.load.ohm;
  for (const s of f.sources) { num2 += s.volts / s.r.ohm; den += 1 / s.r.ohm; }
  const a = num2 / den;
  return { a, into: f.sources.map((s) => (a - s.volts) / s.r.ohm) };
}

export const starsRule = (): string => say('debrief.rule');

/** The 2-4 slip: the potentiometer worked out from the printed problem (gradient, EMF, internal resistance), with the player's predictions graded. */
function buildPotDebrief(f: ExamFigure, rows: Omit<DebriefRow, 'ok'>[], stars: number, built: boolean): Debrief {
  const p = f.pot!, i = p.driverV / (p.rheostat + p.wireOhm), k = (i * p.wireOhm) / p.wireCm, e = k * p.l1Cm, v2 = k * p.l2Cm, r = (p.shunt * (p.l1Cm - p.l2Cm)) / p.l2Cm;
  const working = [
    say('debrief.pot.i', { v: num(p.driverV), rh: num(p.rheostat), rw: num(p.wireOhm), i: num(i) }),
    say('debrief.pot.k', { i: num(i), rw: num(p.wireOhm), l: num(p.wireCm), k: num(k) }),
    say('debrief.pot.e', { k: num(k), l1: num(p.l1Cm), e: num(e) }),
    say('debrief.pot.v', { sh: num(p.shunt), k: num(k), l2: num(p.l2Cm), v: num(v2) }),
    say('debrief.pot.r', { sh: num(p.shunt), l1: num(p.l1Cm), l2: num(p.l2Cm), r: num(r) }),
  ];
  const full = rows.map((x) => ({ ...x, ok: x.grade !== 'miss' }));
  const starsText = say(!built ? 'debrief.stars.fail' : stars >= 3 ? 'debrief.stars.3' : stars === 2 ? 'debrief.stars.2' : 'debrief.stars.1');
  return { node: 'wire', equation: say('debrief.pot.equation'), working, answer: say('debrief.pot.answer', { r: num(r) }), currents: [{ name: 'cell', amps: sig(e, 4), charging: false, text: say('debrief.pot.robust') }], rows: full, starsText };
}

export function buildDebrief(f: ExamFigure, rows: Omit<DebriefRow, 'ok'>[], stars: number, built: boolean): Debrief {
  if (f.kind === 'pot' && f.pot) return buildPotDebrief(f, rows, stars, built);
  const { a, into } = solveFigure(f), n = f.node;
  const eq = f.sources.map((s) => `(${num(s.volts)} − ${n})/${num(s.r.ohm)}`).join(' + ') + ` = ${n}/${num(f.load.ohm)}`;
  const mult = f.sources.every((s) => Number.isInteger(s.r.ohm)) && Number.isInteger(f.load.ohm) ? leastCommon([...f.sources.map((s) => s.r.ohm), f.load.ohm]) : 0;
  const working: string[] = [];
  if (mult > 0) {
    working.push(say('debrief.mult', { m: num(mult), terms: f.sources.map((s) => `${num(mult / s.r.ohm)}(${num(s.volts)} − ${n})`).join(' + '), rhs: (mult / f.load.ohm === 1 ? '' : num(mult / f.load.ohm)) + n }));
    const left = f.sources.reduce((acc, s) => acc + (mult / s.r.ohm) * s.volts, 0), coef = f.sources.reduce((acc, s) => acc + mult / s.r.ohm, 0) + mult / f.load.ohm;
    working.push(say('debrief.collect', { n, lhs: num(left), rhs: `${num(coef)}${n}` }));
  } else working.push(say('debrief.collect', { n, lhs: f.sources.map((s) => `${num(s.volts)}/${num(s.r.ohm)}`).join(' + '), rhs: `${n}(${[...f.sources.map((s) => `1/${num(s.r.ohm)}`), `1/${num(f.load.ohm)}`].join(' + ')})` }));
  const answer = `${n} = ${num(a)} V`;
  const currents = f.sources.map((s, i) => {
    const amps = into[i]!, charging = amps > 0;
    return { name: s.name, amps: sig(amps, 4), charging, text: say(charging ? 'debrief.charging' : 'debrief.discharging', { name: s.name, amps: num(abs(amps)), n, a: num(a), e: num(s.volts) }) };
  });
  const full = rows.map((r) => ({ ...r, ok: r.grade !== 'miss' }));
  const starsText = say(!built ? 'debrief.stars.fail' : stars >= 3 ? 'debrief.stars.3' : stars === 2 ? 'debrief.stars.2' : 'debrief.stars.1');
  return { node: n, equation: eq, working, answer, currents, rows: full, starsText };
}

function leastCommon(xs: number[]): number {
  const gcd = (p: number, q: number): number => (q === 0 ? p : gcd(q, p % q));
  return xs.reduce((m, x) => (m * x) / gcd(m, x), 1);
}
