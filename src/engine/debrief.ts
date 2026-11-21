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
  /** Fewer than 3 stars on a passed exam: the slip offers "try again for more stars" (predict again, bench again). */
  retry: boolean;
  retryText: string;
}
const retryOf = (built: boolean, stars: number): { retry: boolean; retryText: string } => ({ retry: built && stars < 3, retryText: built && stars < 3 ? say('debrief.retry') : '' });

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
  const starsText = say(!built ? 'debrief.stars.fail' : stars >= 3 ? 'debrief.stars.3' : stars === 2 ? 'debrief.stars.2' : 'debrief.stars.1.pot');
  return { node: 'wire', equation: say('debrief.pot.equation'), working, answer: say('debrief.pot.answer', { r: num(r) }), currents: [{ name: 'cell', amps: sig(e, 4), charging: false, text: say('debrief.pot.robust') }], rows: full, starsText, ...retryOf(built, stars) };
}

/** The 3-4 slip: both capacitor cards worked out from the printed problem (series / parallel, charge, energy, charge sharing and the heat that is lost), with the predictions graded and the bench's own energy ledger. */
function buildCapsDebrief(f: ExamFigure, rows: Omit<DebriefRow, 'ok'>[], stars: number, built: boolean, measured?: Record<string, number>): Debrief {
  const k = f.caps!, a = k.a, b = k.b, cp = a.c2 + a.c3, c = (a.c1 * cp) / (a.c1 + cp), q = c * a.volts, u = 0.5 * q * a.volts / 1000, vM = a.volts - q / a.c1;
  const q2 = b.c1 * b.v1, ct = b.c1 + b.c2, v2 = q2 / ct, e0 = 0.5 * b.c1 * b.v1 * b.v1 / 1000, e1 = 0.5 * ct * v2 * v2 / 1000, loss = e0 - e1;
  const working = [
    say('debrief.caps.par', { cp: num(cp) }), say('debrief.caps.ser', { c1: num(a.c1), cp: num(cp), c: num(c) }),
    say('debrief.caps.q', { c: num(c), v: num(a.volts), q: num(q), c1: num(a.c1), v1: num(q / a.c1), vm: num(vM) }), say('debrief.caps.u', { q: num(q), v: num(a.volts), u: num(u) }),
    say('debrief.caps.share', { c1: num(b.c1), v1: num(b.v1), q: num(q2), c2: num(b.c2), ct: num(ct), v: num(v2) }),
    say('debrief.caps.loss', { c1: num(b.c1), v1: num(b.v1), e0: num(e0), ct: num(ct), v: num(v2), e1: num(e1), loss: num(loss) }),
  ];
  if (measured?.heat !== undefined) working.push(say('debrief.caps.ledger', { heat: num(measured.heat * 1000) }));
  const full = rows.map((x) => ({ ...x, ok: x.grade !== 'miss' }));
  const starsText = say(!built ? 'debrief.stars.fail' : stars >= 3 ? 'debrief.stars.3' : stars === 2 ? 'debrief.stars.2' : 'debrief.stars.1.caps');
  return { node: 'bank', equation: say('debrief.caps.equation'), working, answer: say('debrief.caps.answer', { q: num(q), u: num(u), v: num(v2), loss: num(loss) }), currents: [], rows: full, starsText, ...retryOf(built, stars) };
}

export function buildDebrief(f: ExamFigure, rows: Omit<DebriefRow, 'ok'>[], stars: number, built: boolean, measured?: Record<string, number>): Debrief {
  if (f.kind === 'pot' && f.pot) return buildPotDebrief(f, rows, stars, built);
  if (f.kind === 'caps' && f.caps) return buildCapsDebrief(f, rows, stars, built, measured);
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
  return { node: n, equation: eq, working, answer, currents, rows: full, starsText, ...retryOf(built, stars) };
}

function leastCommon(xs: number[]): number {
  const gcd = (p: number, q: number): number => (q === 0 ? p : gcd(q, p % q));
  return xs.reduce((m, x) => (m * x) / gcd(m, x), 1);
}
