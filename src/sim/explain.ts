// Explain-after-failure (DESIGN §7.3) and topology explainers (§3.10). Pure: numbers from a solved state or bench report in,
// `{ key, vars }` out. English lives in src/locales/sim.en.ts (explain.*), filled with the player's own numbers, plain words first, then the equation.
// Numbers in vars are rounded to 3 significant figures; resistance, capacitance, time, frequency and small currents are SI-prefixed strings.
import { dmath } from '@core/numerics';
import type { TopoIssue } from './mna/types';
import type { Failure } from './mna/op';
import type { BenchFailure } from './bench/types';

export type Vars = Record<string, string | number>;
export interface Explained { key: string; vars: Vars }
function capFirst(s: string): string { return s === '' ? s : s[0]!.toUpperCase() + s.slice(1); }

// ---------------------------------------------------------------- number formatting (deterministic: loops, no Math.log/pow)
/** Round to `n` significant figures. */
export function sig(x: number, n = 3): number {
  if (!Number.isFinite(x) || x === 0) return x;
  const a = Math.abs(x);
  let up = 1, down = 1;
  while (a * up < pow10(n - 1)) up *= 10;
  while (a / down >= pow10(n)) down *= 10;
  const v = up > 1 ? Math.round(x * up) / up : Math.round(x / down) * down;
  return v;
}
function pow10(k: number): number { let r = 1; for (let i = 0; i < k; i++) r *= 10; return r; }
const PREFIXES: readonly (readonly [string, number])[] = [['G', 1e9], ['M', 1e6], ['k', 1e3], ['', 1], ['m', 1e-3], ['µ', 1e-6], ['n', 1e-9], ['p', 1e-12]];
/** SI-prefixed quantity, e.g. si(4700, 'Ω') = '4.7 kΩ'. */
export function si(x: number, unit: string): string {
  if (!Number.isFinite(x)) return `${x} ${unit}`;
  const a = Math.abs(x);
  if (a === 0) return `0 ${unit}`;
  const [p, s] = PREFIXES.find(([, s]) => a >= s * 0.9995) ?? PREFIXES[PREFIXES.length - 1];
  return `${sig(x / s)} ${p}${unit}`;
}

// ---------------------------------------------------------------- standard values
const E12 = [1, 1.2, 1.5, 1.8, 2.2, 2.7, 3.3, 3.9, 4.7, 5.6, 6.8, 8.2];
/** Nearest E12 value (the ordinary resistor series) to x. */
export function nearestE12(x: number): number {
  let best = E12[0], bestErr = Infinity, dec = 1;
  while (x >= dec * 10) dec *= 10;
  while (x < dec) dec /= 10;
  for (const d of [dec / 10, dec, dec * 10]) for (const m of E12) {
    const v = sig(m * d), err = Math.abs(dmath.log10(v / x));
    if (err < bestErr) { best = v; bestErr = err; }
  }
  return best;
}
const POWER_RATINGS = [0.125, 0.25, 0.5, 1, 2, 3, 5, 10, 25, 50, 100];
const CAP_VOLTAGES = [6.3, 10, 16, 25, 35, 50, 63, 100, 160, 250, 400, 450];
/** Margin asked of a replacement part (assumption: 30 % on voltage, 50 % on power). */
export const VOLTAGE_MARGIN = 1.3, POWER_MARGIN = 1.5;
const firstAtLeast = (table: readonly number[], x: number): number => table.find((v) => v >= x) ?? table[table.length - 1];

// ---------------------------------------------------------------- §7.3 templates
export function explainResistorPower(a: { part: string; v: number; r: number; p: number; rated: number }): Explained {
  return { key: 'explain.resistor.power', vars: {
    ...pn(a.part), p: sig(a.p), rated: sig(a.rated), v: sig(a.v), i: sig(Math.sqrt(a.p / a.r)), r: si(a.r, 'Ω'), ratio: sig(a.p / a.rated, 2),
    rNext: firstAtLeast(POWER_RATINGS, a.p * POWER_MARGIN), rEach: si(2 * a.r, 'Ω'), pEach: sig(a.p / 2),
  } };
}
/** What the loop around a burned LED holds, from the live board: its own numbers (source, resistors, how many LEDs) and how many times the player has already burned one here. */
export interface LedLoop {
  vSupply: number; vForward: number; rSource: number; rLed: number;
  /** Series resistance of the resistors on the board, ohms; 0 when there is none. */
  rRes?: number;
  /** How the player's name for the resistor(s): "the 100 Ω ¼ W resistor", "2 resistors". */
  rWhat?: string;
  /** LEDs on the board. */
  nLeds?: number;
  /** The LED's model, so a thermal burn (power known, current not) can be turned back into a current. */
  model?: { Is: number; N: number; Rs: number };
  iRated?: number;
}
/** Current of an LED that dissipates p watts: solves p = I x (N Vt ln(I / Is + 1) + I Rs) by bisection (monotonic in I). */
export function ledCurrentFromPower(p: number, m: { Is: number; N: number; Rs: number }): number {
  let lo = 0, hi = 5;
  for (let k = 0; k < 70; k++) {
    const mid = (lo + hi) / 2, pw = mid * (m.N * 0.025852 * dmath.log(mid / m.Is + 1) + mid * m.Rs);
    if (pw < p) lo = mid; else hi = mid;
  }
  return (lo + hi) / 2;
}
/** An LED burned. The text follows the LIVE circuit (bare on the supply, or with a resistor that was too small) and the teaching cadence:
 * the first burn gives the cause and points at Kirchhoff's voltage law without the answer; a repeat burn gives the worked formula. `prior` = earlier failures on this ticket. */
export function explainLedOvercurrent(a: { part: string; i: number; iRated: number; loop: LedLoop; prior?: number }): Explained {
  const L = a.loop, iWant = a.iRated / 2, again = (a.prior ?? 0) >= 1, rRes = L.rRes ?? 0;
  const many = (L.nLeds ?? 1) > 1;
  const key = many ? 'explain.led.overcurrent.many'
    : rRes > 0 ? (again ? 'explain.led.overcurrent.res.again' : 'explain.led.overcurrent.res.first')
    : (again ? 'explain.led.overcurrent.bare.again' : 'explain.led.overcurrent.bare.first');
  return { key, vars: {
    ...pn(a.part), i: sig(a.i), iRated: sig(a.iRated), iMA: sig(a.i * 1000), iRatedMA: sig(a.iRated * 1000), iWantMA: sig(iWant * 1000), rSource: sig(L.rSource, 2), rLed: sig(L.rLed, 2),
    vSupply: sig(L.vSupply), vForward: sig(L.vForward), vLeft: sig(L.vSupply - L.vForward), iWant: sig(iWant), rSeries: si(nearestE12((L.vSupply - L.vForward) / iWant), 'Ω'),
    rRes: si(rRes, 'Ω'), rWhat: L.rWhat ?? 'a resistor',
  } };
}
export function explainElecOvervoltage(a: { part: string; v: number; vRated: number }): Explained {
  return { key: 'explain.cap.overvoltage', vars: { ...pn(a.part), v: sig(a.v), vRated: sig(a.vRated), vPick: firstAtLeast(CAP_VOLTAGES, a.v * VOLTAGE_MARGIN) } };
}
export function explainElecReversed(a: { part: string; v: number }): Explained {
  return { key: 'explain.cap.reversed', vars: { ...pn(a.part), v: sig(a.v) } };
}
/** A transistor that dissipates in the active region because its base drive was too small for the load current. */
export function explainBjtActive(a: { part: string; vce: number; ic: number; ib: number; pRated: number; beta?: number }): Explained {
  const beta = a.beta ?? 10;
  return { key: 'explain.bjt.active', vars: {
    ...pn(a.part), vce: sig(a.vce), ic: sig(a.ic), p: sig(a.vce * a.ic), pRated: sig(a.pRated), ib: si(a.ib, 'A'), ibNeeded: si(a.ic / beta, 'A'), beta,
  } };
}
export function explainInductiveKick(a: { part: string; load: string; vPeak: number; vceo: number }): Explained {
  return { key: 'explain.inductiveKick', vars: { ...pn(a.part), load: a.load, vPeak: sig(a.vPeak), vceo: sig(a.vceo) } };
}
export function explainMosfetUnderdriven(a: { part: string; vgs: number; vth: number; id: number; vds: number; theta: number }): Explained {
  return { key: 'explain.mosfet.underdriven', vars: {
    ...pn(a.part), vgs: sig(a.vgs), vth: sig(a.vth), id: si(a.id, 'A'), vds: sig(a.vds), p: sig(a.id * a.vds), theta: sig(a.theta),
  } };
}
export function explainRegulatorThermal(a: { part: string; vin: number; vout: number; i: number; ta: number; theta: number; tShutdown?: number; tTarget?: number }): Explained {
  const p = (a.vin - a.vout) * a.i, tTarget = a.tTarget ?? 125;
  return { key: 'explain.regulator.thermal', vars: {
    ...pn(a.part), p: sig(p), vin: sig(a.vin), vout: sig(a.vout), i: sig(a.i), ta: sig(a.ta), theta: sig(a.theta), tj: sig(a.ta + p * a.theta),
    tShutdown: a.tShutdown ?? 150, tTarget, thetaNeeded: sig((tTarget - a.ta) / p),
  } };
}
/** `slew` in V per microsecond; the signal is a sine of peak vPeak at f Hz (slew needed = 2 pi f Vp). */
export function explainSlew(a: { slew: number; vPeak: number; f: number }): Explained {
  return { key: 'explain.opamp.slew', vars: { slew: sig(a.slew), vPeak: sig(a.vPeak), f: si(a.f, 'Hz'), needed: sig((2 * Math.PI * a.f * a.vPeak) / 1e6) } };
}
export function explainGbw(a: { part: string; gbw: number; gain: number; f: number }): Explained {
  const bw = a.gbw / a.gain, g2 = Math.sqrt(a.gain);
  return { key: 'explain.opamp.gbw', vars: {
    ...pn(a.part), gbw: si(a.gbw, 'Hz'), gain: sig(a.gain), bw: si(bw, 'Hz'), f: si(a.f, 'Hz'),
    dB: sig(-10 * dmath.log10(1 + (a.f / bw) * (a.f / bw))), g2: sig(g2), bw2: si(a.gbw / g2, 'Hz'),
  } };
}
/** Divider r1 (top) / r2 (bottom) from vin, with rLoad across r2. */
export function explainLoading(a: { r1: number; r2: number; rLoad: number; vin: number }): Explained {
  const par = (a.r2 * a.rLoad) / (a.r2 + a.rLoad);
  return { key: 'explain.loading', vars: {
    r1: si(a.r1, 'Ω'), r2: si(a.r2, 'Ω'), rLoad: si(a.rLoad, 'Ω'), vUnloaded: sig((a.vin * a.r2) / (a.r1 + a.r2)),
    vLoaded: sig((a.vin * par) / (a.r1 + par)), rLower: si(par, 'Ω'),
  } };
}
/** An amplifier output pinned to a rail at DC; vp and vm are the + and - input voltages. */
export function explainDcSaturated(a: { node: string; v: number; vp: number; vm: number }): Explained {
  return { key: a.vp >= a.vm ? 'explain.dcSaturated.high' : 'explain.dcSaturated.low', vars: { node: a.node, v: sig(a.v), vp: sig(a.vp), vm: sig(a.vm) } };
}
export function explainOscillatorDies(a: { f: number; gain: number; atten: number; r: number }): Explained {
  return { key: 'explain.oscillator.dies', vars: { f: si(a.f, 'Hz'), loop: sig(a.gain / a.atten, 2), gain: sig(a.gain, 2), atten: sig(a.atten, 2), rfMin: si(a.atten * a.r, 'Ω') } };
}
/** An RC step response whose measuring probe (rProbe to ground) loads the capacitor node: Thevenin R = r || rProbe, final V = vSrc x rProbe/(r + rProbe). */
export function explainBandMiss(a: { probe: string; level: number; tCross: number; tLo: number; tHi: number; r: number; c: number; rProbe: number; vSrc: number }): Explained {
  const rth = (a.r * a.rProbe) / (a.r + a.rProbe);
  return { key: 'explain.bandMiss', vars: {
    probe: a.probe, level: sig(a.level), t: si(a.tCross, 's'), tLo: si(a.tLo, 's'), tHi: si(a.tHi, 's'), tau: si(a.r * a.c, 's'),
    rProbe: si(a.rProbe, 'Ω'), rth: si(rth, 'Ω'), vFinal: sig((a.vSrc * a.rProbe) / (a.r + a.rProbe)),
  } };
}
/** 2-1: the divider formula is right on paper, but the ADC input is a resistor in parallel with the bottom resistor. */
export function explainDivider(a: { r1: number; r2: number; rLoad: number; vin: number; lo: number; hi: number }): Explained {
  const par = (a.r2 * a.rLoad) / (a.r2 + a.rLoad);
  return { key: 'explain.divider', vars: {
    r1: si(a.r1, 'Ω'), r2: si(a.r2, 'Ω'), rLoad: si(a.rLoad, 'Ω'), vin: sig(a.vin), vUnloaded: sig((a.vin * a.r2) / (a.r1 + a.r2)), vLoaded: sig((a.vin * par) / (a.r1 + par)), rLower: si(par, 'Ω'), lo: sig(a.lo), hi: sig(a.hi),
  } };
}
/** 2-1: the divider is not a divider yet. `floating`: a bottom resistor is placed but nothing of it reaches GND; `nobottom`: only the top resistor is placed; `notop`: nothing runs from IN to OUT. */
export interface DividerFault { kind: 'floating' | 'nobottom' | 'notop'; r1: number; rLoad: number; vin: number }
export function explainDividerFault(a: DividerFault & { lo: number; hi: number }): Explained {
  const vOut = a.kind === 'notop' ? 0 : (a.vin * a.rLoad) / (a.r1 + a.rLoad);
  const key = a.kind === 'floating' ? 'explain.divider.floating' : a.kind === 'nobottom' ? 'explain.divider.nobottom' : 'explain.divider.notop';
  return { key, vars: { r1: si(a.r1, 'Ω'), rLoad: si(a.rLoad, 'Ω'), vin: sig(a.vin), vOut: sig(vOut), lo: sig(a.lo), hi: sig(a.hi) } };
}
/** Chapter 3: what the player built as the explainers need it. `r` / `c`: the resistor and the capacitor of the RC filter (ohm, farad; 0 when absent), `rProbe`: the scope probe's resistance on the node,
 *  `vSrc`: the supply the RC is charged from, `level`: the crossing level of the spec. */
export interface RcCtx { r: number; c: number; rProbe: number; vSrc: number; level: number; tLo: number; tHi: number; deb?: DebCtx }
/** 3-2: what OUT actually did, read from the trace the scope shows (or, before a sweep has run, the exact RC response): the level it started at, the lowest it got during the press
 *  (and where it stood when the button was released), and the highest it got after the release. `rPull`: the pull-up that recharges the capacitor on release. `fromScope`: the numbers are the scope's samples. */
export interface DebCtx { vStart: number; vLow: number; vAtRelease: number; vHigh: number; tPress: number; tRelease: number; rPull: number; fromScope: boolean }
/** Chapter 3 ticket 3-3: the coil, the series resistor and the rail that is wired. */
export interface CoilCtx { rCoil: number; rSeries: number; vRail: number; lCoil: number; iPull: number; relay: string }

/** The time at which a capacitor charged from vSrc through r, with a probe of rProbe on it, crosses `level`: Thevenin vth = vSrc rProbe / (r + rProbe), rth = r || rProbe; null when it never gets there. */
export function rcCrossing(a: RcCtx): { t: number | null; vth: number; rth: number; tauEff: number } {
  const rth = (a.r * a.rProbe) / (a.r + a.rProbe), vth = (a.vSrc * a.rProbe) / (a.r + a.rProbe), tauEff = rth * a.c;
  return { t: a.level < vth ? -tauEff * dmath.log(1 - a.level / vth) : null, vth, rth, tauEff };
}
/** 3-1: the RC timer's crossing missed its window. `again`: the second miss on this ticket gives the worked formula. */
export function explainRc(a: RcCtx & { again: boolean }): Explained {
  const tau = a.r * a.c, x = rcCrossing(a), tWant = (a.tLo + a.tHi) / 2, vars: Vars = { R: si(a.r, 'Ω'), C: si(a.c, 'F'), tau: si(tau, 's'), level: sig(a.level), tLo: si(a.tLo, 's'), tHi: si(a.tHi, 's'), tWant: si(tWant, 's'), rProbe: si(a.rProbe, 'Ω'), vth: sig(x.vth), rth: si(x.rth, 'Ω'), tauEff: si(x.tauEff, 's'), t: x.t === null ? 'never' : si(x.t, 's'), rNeeded: si(tWant / a.c, 'Ω'), cNeeded: si(tWant / a.r, 'F') };
  if (x.t === null) return { key: 'explain.rc.never', vars };
  const paperOk = tau >= a.tLo * 0.99 && tau <= a.tHi * 1.01;   // R x C on paper is right: the probe's load is what moved it
  const keys = paperOk && x.t > a.tHi ? ['explain.rc.loaded.first', 'explain.rc.loaded.again'] : x.t > a.tHi ? ['explain.rc.slow.first', 'explain.rc.slow.again'] : ['explain.rc.fast.first', 'explain.rc.fast.again'];
  return { key: keys[a.again ? 1 : 0]!, vars };
}
/** Chapter 3 failures in plain words: the RC timer (3-1), the debounce filter (3-2), the relay coil (3-3) and the capacitor exam (3-4). Null when the failure is not one of theirs. */
function explainChapter3(f: BenchFailure, ctx: ExplainContext): Explained | null {
  const mode = ctx.miss?.mode, v = f.vars, num = (k: string): number => Number(v[k]), again = (ctx.prior ?? 0) >= 1, id = String(v.id ?? '');
  if (mode === 'rc' && ctx.rc && ctx.rc.r > 0 && ctx.rc.c > 0) return explainRc({ ...ctx.rc, again });
  if (mode === 'debounce' && ctx.rc && ctx.rc.r > 0 && ctx.rc.c > 0) {
    const tau = ctx.rc.r * ctx.rc.c, metric = String(v.metric ?? ''), cond = String(v.cond ?? ''), value = num('value');
    const vars: Vars = { R: si(ctx.rc.r, 'Ω'), C: si(ctx.rc.c, 'F'), tau: si(tau, 's'), cond: cond === 'nominal' ? 'nominal' : cond, n: Number.isFinite(value) ? value : 0, t: Number.isFinite(value) ? si(value, 's') : 'never', lo: si(num('lo'), 's'), hi: si(num('hi'), 's') };
    const d = ctx.rc.deb;
    if (d) {
      // what OUT really did, from the trace: press needs it to fall below 2.5 V, the release needs it to climb back above
      Object.assign(vars, { vStart: sig(d.vStart, 3), vLow: sig(d.vLow, 3), vRel: sig(d.vAtRelease, 3), vHigh: sig(d.vHigh, 3), tauPress: si(tau, 's'), tauRel: si(ctx.rc.r * ctx.rc.c + d.rPull * ctx.rc.c, 's'), rPull: si(d.rPull, 'Ω'), rCharge: si(ctx.rc.r + d.rPull, 'Ω'), tHold: si(d.tRelease - d.tPress, 's'), pct: sig((d.vLow / Math.max(d.vStart, 1e-9)) * 100, 2) });
      const never = f.key === 'bench.metric.nan' || (metric === 'crossingCount' && value === 0);
      if (never || id === 'npress' || id === 'nrelease') {
        const pressFail = d.vLow > ctx.rc.level, relFail = !pressFail && d.vHigh < ctx.rc.level;
        if (pressFail && (never || id === 'npress')) return { key: 'explain.debounce.nopress', vars };
        if (relFail && (never || id === 'nrelease')) return { key: 'explain.debounce.norelease', vars };
      }
    }
    if (f.key === 'bench.metric.nan' || (metric === 'crossingCount' && value === 0)) return { key: 'explain.debounce.none', vars };
    if (metric === 'crossingCount') return { key: 'explain.debounce.many', vars };
    if (metric === 'crossingTime') return { key: value > num('hi') ? 'explain.debounce.late' : 'explain.debounce.early', vars };
    return null;
  }
  if (mode === 'coil' && ctx.coil) {
    const c = ctx.coil, R = c.rCoil + c.rSeries, iMax = c.vRail / R, tau = c.lCoil / R, value = num('value');
    const vars: Vars = { R: si(R, 'Ω'), v: sig(c.vRail), tau: si(tau, 's'), iMax: sig(iMax * 1000), tMax: si(num('hi'), 's'), t: Number.isFinite(value) ? si(value, 's') : 'never', i: Number.isFinite(value) ? sig(value * 1000) : 0, rNeeded: si(c.vRail / 0.058, 'Ω') };
    if (id === 'tpull') return { key: again ? 'explain.coil.slow.again' : 'explain.coil.slow', vars };
    if (id === 'isteady') return { key: 'explain.coil.steady', vars };
    return null;
  }
  if (mode === 'caps') {
    const value = num('value'), scale = id === 'heat' ? 1e3 : 1;
    if (id !== 'vm' && id !== 'vd' && id !== 'heat') return null;
    return { key: id === 'vm' ? 'explain.caps.vm' : id === 'vd' ? 'explain.caps.vd' : 'explain.caps.heat', vars: { value: Number.isFinite(value) ? sig(value * scale, 3) : 0, lo: sig(num('lo') * scale, 3), hi: sig(num('hi') * scale, 3) } };
  }
  return null;
}

// ---------------------------------------------------------------- chapter 5
/** Collector current of a divider-biased (or single-resistor) common-emitter stage at gain beta: Ic = beta x (Vth - 0.65) / (Rth + (beta + 1) x RE). r2 = 0 means no lower resistor (a single bias resistor). */
export function ceCollectorCurrent(a: { r1: number; r2: number; re: number; vcc: number; beta: number }): number {
  const vth = a.r2 > 0 ? (a.vcc * a.r2) / (a.r1 + a.r2) : a.vcc, rth = a.r2 > 0 ? (a.r1 * a.r2) / (a.r1 + a.r2) : a.r1;
  return Math.max(0, (a.beta * (vth - 0.65)) / (rth + (a.beta + 1) * a.re));
}
/** Chapter 5 failures in plain words. Null when the failure is not one of theirs. */
function explainChapter5(f: BenchFailure, ctx: ExplainContext): Explained | null {
  const mode = ctx.miss?.mode, v = f.vars, num = (k: string): number => Number(v[k]), again = (ctx.prior ?? 0) >= 1, id = String(v.id ?? ''), cond = String(v.cond ?? '');
  const condText = cond === '' || cond === 'nominal' ? '' : `, in the ${cond} test`, value = num('value');
  if (mode === 'switch' && ctx.sw) {
    const w = ctx.sw, ib = (w.vpin - 0.7) / (w.rb + w.rpin), ic = Math.min(w.beta * ib, w.vfan / w.rfan), need = w.vfan / w.rfan;
    if (id === 'fanhi' && (f.key === 'bench.level.fail' || f.key === 'bench.metric.fail')) {
      const vars: Vars = { value: sig(Math.max(0, value), 3), lo: sig(num('lo'), 3), rb: si(w.rb, 'Ω'), rpin: si(w.rpin, 'Ω'), vpin: w.vpin, ib: sig(ib * 1000, 3), beta: w.beta, icMax: sig(w.beta * ib * 1000, 3), need: sig(need * 1000, 3), vce: sig(w.vfan - Math.max(0, value), 3), ibNeed: sig((need / 10) * 1000, 3), rbMax: si(((w.vpin - 0.7) / (need / 10)) - w.rpin, 'Ω') };
      return { key: again ? 'explain.sw.weak.again' : 'explain.sw.weak.first', vars };
    }
    if (id === 'ipin' && value > num('hi')) return { key: 'explain.sw.pin', vars: { value: sig(value * 1000, 3), hi: sig(num('hi') * 1000, 2), rb: si(w.rb, 'Ω'), rpin: si(w.rpin, 'Ω'), vpin: w.vpin, rbMin: si((w.vpin - 0.7) / 0.02 - w.rpin, 'Ω') } };
    if (id === 'fanlo') return { key: 'explain.sw.leak', vars: { value: sig(Math.max(0, value), 3), hi: sig(num('hi'), 2) } };
    if (f.key === 'rating.bjt.vceo' || f.key === 'smoke.bjt.avalanche') {
      const peak = f.key === 'rating.bjt.vceo' ? num('value') : num('vce'), lim = f.key === 'rating.bjt.vceo' ? num('limit') : num('vceo');
      return explainInductiveKick({ part: String(v.part), load: 'the fan', vPeak: peak, vceo: lim });
    }
    if (f.key === 'rating.bjt.ic') return { key: 'explain.sw.ic', vars: { ...pn(String(v.part)), value: sig(num('value') * 1000, 3), limit: sig(num('limit') * 1000, 3), need: sig(need * 1000, 3) } };
    if (f.key === 'rating.thermal.tj' || f.key === 'smoke.thermal') {
      const vce = w.vfan - w.rfan * ic;
      return explainBjtActive({ part: String(v.part), vce, ic, ib, pRated: w.pRated, beta: 10 });
    }
  }
  if (mode === 'fet' && ctx.fet) {
    const g = ctx.fet, which = /minimum/.test(cond) ? 'minimum' : /maximum/.test(cond) ? 'maximum' : 'typical', vth = g.vth[which];
    if (id === 'istrip' && (f.key === 'bench.level.fail' || f.key === 'bench.metric.fail')) {
      const i = Math.max(0, value), vov = g.vgs - vth, vds = Math.max(0, g.vstrip - g.rstrip * i), vars: Vars = { value: sig(i * 1000, 3), lo: sig(num('lo') * 1000, 3), cond: condText, vth: sig(vth, 3), vgs: g.vgs, vov: sig(vov, 3), vds: sig(vds, 3), vstrip: g.vstrip, iNeed: sig((g.vstrip / g.rstrip) * 1000, 3) };
      return { key: vov <= 0 ? (again ? 'explain.fet.off.again' : 'explain.fet.off.first') : (again ? 'explain.fet.weak.again' : 'explain.fet.weak.first'), vars };
    }
    if (id === 'ioff') return { key: 'explain.fet.float', vars: { value: sig(Math.max(0, value) * 1000, 3), hi: sig(num('hi') * 1000, 2), vleak: g.vleak, vth: sig(g.vth.minimum, 3), rpd: g.rpd > 0 ? si(g.rpd, 'Ω') : 'no resistor' } };
    if (f.key === 'rating.thermal.tj' || f.key === 'smoke.thermal') {
      const p = num(f.key === 'smoke.thermal' ? 'P' : 'P'), idr = (g.vstrip - Math.sqrt(Math.max(0, g.vstrip * g.vstrip - 4 * g.rstrip * p))) / (2 * g.rstrip), vds = g.vstrip - g.rstrip * idr;
      return explainMosfetUnderdriven({ part: String(v.part), vgs: g.vgs, vth: g.vth.typical, id: idr, vds, theta: g.theta });
    }
  }
  if (mode === 'gate' && ctx.gate && id === 'voh' && (f.key === 'bench.level.fail' || f.key === 'bench.metric.fail')) {
    const g = ctx.gate, vdiv = (g.vcc * g.rl) / (g.rc + g.rl), vars: Vars = { value: sig(Math.max(0, value), 3), lo: sig(num('lo'), 3), cond: condText, rc: si(g.rc, 'Ω'), rl: si(g.rl, 'Ω'), vcc: g.vcc, vdiv: sig(vdiv, 3), vlow: g.vlow, nDiodes: g.nDiodes, pLow: sig(g.vlow + 0.65, 3), pNeed: sig(0.65 * 3, 3) };
    if (vdiv < num('lo') + 0.05) return { key: 'explain.gate.pullup', vars };
    if (g.nDiodes <= 2) return { key: 'explain.gate.noshift', vars };
    return { key: 'explain.gate.base', vars };
  }
  if (mode === 'gate' && ctx.gate && id === 'vol' && (f.key === 'bench.level.fail' || f.key === 'bench.metric.fail')) {
    const g = ctx.gate;
    return { key: 'explain.gate.low', vars: { value: sig(Math.max(0, value), 3), hi: sig(num('hi'), 2), cond: condText, rc: si(g.rc, 'Ω'), iSink: sig(((g.vcc - Math.max(0, value)) / g.rc + 1e-3) * 1000, 3) } };
  }
  if (mode === 'amp' && ctx.amp && (f.key === 'bench.metric.fail' || f.key === 'bench.metric.nan') && (id === 'gain' || id === 'thd')) {
    const a = ctx.amp, ic = (b: number): number => ceCollectorCurrent({ r1: a.r1, r2: a.r2, re: a.re, vcc: a.vcc, beta: b }), icLo = ic(a.beta.low), icHi = ic(a.beta.high), icMid = ic(a.beta.mid);
    const vc = a.vcc - icMid * a.rc, gain = id === 'gain' ? value / 0.2 : NaN;
    const vars: Vars = { value: Number.isFinite(value) ? sig(value, 3) : 0, gain: Number.isFinite(gain) ? sig(gain, 3) : 0, cond: condText, icLo: sig(icLo * 1000, 3), icHi: sig(icHi * 1000, 3), icMid: sig(icMid * 1000, 3), betaLo: a.beta.low, betaHi: a.beta.high, rc: si(a.rc, 'Ω'), re: si(a.re, 'Ω'), vc: sig(vc, 3), vcc: a.vcc, rePrime: si(0.02585 / Math.max(icMid, 1e-9), 'Ω'), gainRe: sig((a.rc * a.rload / (a.rc + a.rload)) / (a.re + 0.02585 / Math.max(icMid, 1e-9)), 3), swing: sig(value, 3), ratio: sig(icHi / Math.max(icLo, 1e-12), 2) };
    if (a.re < 1) return { key: 'explain.amp.noRe', vars };
    if (a.r2 <= 0 || icHi / Math.max(icLo, 1e-12) > 1.5 || vc < 1.5 || vc > a.vcc - 0.5) return { key: again ? 'explain.amp.bias.again' : 'explain.amp.bias.first', vars };
    return { key: 'explain.amp.clip', vars };
  }
  if (mode === 'amplifierexam' && ctx.ce && (id === 'ic' || id === 'vce') && (f.key === 'bench.metric.fail' || f.key === 'bench.metric.nan')) {
    const c = ctx.ce, ib = (c.vcc - c.vbe) / c.rb, ic = c.beta * ib, vce = c.vcc - ic * c.rc;
    return { key: 'explain.ceexam.miss', vars: { rb: si(c.rb, 'Ω'), rc: si(c.rc, 'Ω'), ib: sig(ib * 1e6, 3), ic: sig(ic * 1000, 3), vce: sig(Math.max(vce, 0.2), 3), vcc: c.vcc, vbe: c.vbe, beta: c.beta, value: sig(Number.isFinite(value) ? value : 0, 3), lo: sig(num('lo'), 3), hi: sig(num('hi'), 3), which: id === 'ic' ? 'collector current (mA)' : 'collector voltage (V)' } };
  }
  return null;
}

// ---------------------------------------------------------------- chapter 4
const condNum = (cond: string, re: RegExp): number | null => { const m = re.exec(cond); return m ? Number(m[1]) : null; };
/** Chapter 4 failures in plain words: the rectifier (4-1), the Zener shunt (4-2), the regulator (4-3) and the LM317 (4-4). Null when the failure is not one of theirs. */
function explainChapter4(f: BenchFailure, ctx: ExplainContext): Explained | null {
  const mode = ctx.miss?.mode, v = f.vars, num = (k: string): number => Number(v[k]), again = (ctx.prior ?? 0) >= 1, id = String(v.id ?? ''), cond = String(v.cond ?? '');
  const condText = cond === '' || cond === 'nominal' ? '' : `, in the ${cond} test`, value = num('value');
  if (mode === 'rectifier' && ctx.rect && (f.key === 'bench.metric.fail' || f.key === 'bench.metric.nan')) {
    const r = ctx.rect, mains = condNum(cond, /(\d+) V/) ?? 230, half = r.nDiodes < 4, t = half ? 20 : 10;
    if (id === 'ripple' && r.c > 0) {
      const dv = (r.i * t * 1e-3) / r.c, vars: Vars = { ripple: sig(value, 3), lim: sig(num('hi'), 2), cond: condText, C: si(r.c, 'F'), iMA: sig(r.i * 1000, 3), t, q: sig(r.i * t * 1e3, 3), dv: sig(dv, 2), cNeed: si((r.i * t * 1e-3) / num('hi'), 'F') };
      const RIPPLE_KEYS = { first: { half: 'explain.rect.ripple.first.half', bridge: 'explain.rect.ripple.first.bridge' }, again: { half: 'explain.rect.ripple.again.half', bridge: 'explain.rect.ripple.again.bridge' } } as const;   // literal keys so the locale guards can see them
      return { key: RIPPLE_KEYS[again ? 'again' : 'first'][half ? 'half' : 'bridge'], vars };
    }
    if (id === 'mean') {
      const vrms = (12 * mains) / 230, pk = vrms * 1.414, drops = half ? 0.8 : 1.6, vars: Vars = { value: Number.isFinite(value) ? sig(value, 3) : 0, lim: sig(num('lo'), 3), cond: condText, pk: sig(pk, 3), vrms: sig(vrms, 3), nDrops: half ? 1 : 2, top: sig(pk - drops, 3) };
      return { key: value < 2 ? 'explain.rect.mean.dead' : 'explain.rect.mean.low', vars };
    }
  }
  if (mode === 'rectifier' && ctx.rect && f.key === 'rating.diode.current') return { key: 'explain.diode.current.rect', vars: { part: String(v.part), value: sig(num('value'), 3), limit: sig(num('limit'), 3) } };
  if (mode === 'rectifier' && f.key === 'rating.diode.peak') return { key: 'explain.diode.peak', vars: { part: String(v.part), value: sig(num('value'), 3), limit: sig(num('limit'), 3), avg: sig(num('avg'), 2), iMA: sig((ctx.rect?.i ?? 0.1) * 1000, 3) } };
  if (mode === 'rectifier' && f.key === 'smoke.thermal' && ctx.miss?.kinds?.[String(v.part)] === 'XFMR') return { key: 'explain.xfmr.hot', vars: { part: String(v.part), p: sig(num('P'), 3), v: 17, r: 1.5, i: sig(17 / 1.5, 2) } };
  if (mode === 'zener' && ctx.zener && f.key === 'bench.level.fail' && id === 'vout') {
    const z = ctx.zener, vin = condNum(cond, /^(\d+) V/) ?? 13, il = /30 mA/.test(cond) ? 0.03 : 0, iR = (vin - z.vz) / z.r;
    if (value > num('hi')) {
      const iz = (vin - value) / z.r - il, vars: Vars = { cond, value: sig(value, 3), hi: sig(num('hi'), 4), iz: sig(iz * 1000, 3), slope: sig(z.slope, 2), vin, vz: z.vz, R: si(z.r, 'Ω'), iR: sig(iR * 1000, 3), rise: sig(value - z.vz, 2) };
      return { key: again ? 'explain.zener.high.again' : 'explain.zener.high.first', vars };
    }
    const iTot = Math.max(0, (vin - Math.max(value, 0)) / z.r), iz = Math.max(0, iTot - il), vars: Vars = { cond, value: sig(Math.max(value, 0), 3), lo: sig(num('lo'), 4), hi: sig(num('hi'), 4), vdrop: sig(vin - Math.max(value, 0), 3), iz: sig(iz * 1000, 3), iTot: sig(iTot * 1000, 3), vin, vz: z.vz, R: si(z.r, 'Ω'), iR: sig(iR * 1000, 3), iL: sig(il * 1000, 3), sag: sig(Math.max(0, (z.izt - (iR - il)) * z.slope), 2) };
    return { key: again ? 'explain.zener.drop.again' : 'explain.zener.drop.first', vars };
  }
  if (mode === 'zener' && ctx.zener && f.key === 'rating.zener.power') {
    const z = ctx.zener;
    return { key: 'explain.zener.hot', vars: { part: String(v.part), value: sig(num('value'), 3), limit: sig(num('limit'), 3), vin: 17, vz: z.vz, iR: sig(((17 - z.vz) / z.r) * 1000, 3) } };
  }
  if (mode === 'regulator' && ctx.reg) {
    const g = ctx.reg, i = condNum(cond, /^([\d.]+) A/) ?? 0.5, vinChip = g.vrail - i * g.rpre, p = (vinChip - g.vout) * i, tj = g.ta + p * g.theta;
    if (f.key === 'rating.thermal.tj') return { key: 'explain.reg.tj', vars: { part: String(v.part), p: sig(p, 3), vin: sig(vinChip, 3), vout: g.vout, i, ta: g.ta, theta: sig(g.theta, 3), tj: sig(tj, 3), tTarget: g.tjMax, thetaNeeded: sig((g.tjMax - g.ta) / p, 3) } };
    if (id === 'vmin' && (f.key === 'bench.metric.fail' || f.key === 'bench.metric.nan')) {
      if (vinChip < g.vout + 2) return { key: 'explain.reg.dropout', vars: { value: sig(Math.max(value, 0), 3), rpre: si(g.rpre, 'Ω'), i, vinChip: sig(vinChip, 3), vdrop: sig(i * g.rpre, 3) } };
      return { key: 'explain.reg.shut', vars: { value: sig(Math.max(value, 0), 3), tShut: 150, tBack: 135, vin: sig(vinChip, 3), vout: g.vout, i, p: sig(p, 3), ta: g.ta, theta: sig(g.theta, 3), tj: sig(tj, 3) } };
    }
  }
  if (mode === 'lm317' && ctx.lm317 && f.key === 'bench.level.fail' && id === 'vout') {
    const { r1, r2 } = ctx.lm317, vf = 1.25 * (1 + r2 / r1) + 50e-6 * r2;
    if (Math.abs(vf - 3.3) / 3.3 > 0.01 && !(value > vf * 1.05)) {   // (an output far above what the formula gives is the minimum load, whichever resistors)
      const r2need = (3.3 - 1.25) / (1.25 / r1 + 50e-6);
      return { key: again ? 'explain.lm317.formula.again' : 'explain.lm317.formula', vars: { value: sig(value, 4), cond: condText, lo: sig(num('lo'), 4), hi: sig(num('hi'), 4), r1: si(r1, 'Ω'), r2: si(r2, 'Ω'), vf: sig(vf, 4), vout: 3.3, r2need: si(r2need, 'Ω'), off: sig(Math.abs(vf - 3.3) / 0.033, 2), iadjV: sig(50e-6 * r2, 2) } };
    }
    const iDiv = (1.25 / r1) * 1000;
    return { key: 'explain.lm317.minload', vars: { value: sig(value, 4), cond: condText, iDiv: sig(iDiv, 2), iExtra: sig(Math.max(0, 3.5 - iDiv), 2) } };
  }
  return null;
}
export function explainFloatingGate(a: { part: string; rPull?: number }): Explained {
  return { key: 'explain.floatingGate', vars: { ...pn(a.part), rPull: si(a.rPull ?? 100e3, 'Ω') } };
}

// ---------------------------------------------------------------- solver and topology (already carry the user's node and element names)
/** Solver failures (singular, no convergence, topology) carry their own explainer key and vars. */
export const explainSolve = (f: Failure): Explained => ({ key: f.key, vars: f.vars });
/** Topology findings the player should read: blocking first, then warnings; harmless info (unconnected pin) is left to the red pin dot. */
export function explainTopology(issues: readonly TopoIssue[]): Explained[] {
  const rank = { block: 0, warn: 1, info: 2 } as const;
  return issues.filter((i) => i.severity !== 'info').map((i, n) => ({ i, n })).sort((a, b) => rank[a.i.severity] - rank[b.i.severity] || a.n - b.n).map(({ i }) => ({ key: i.key, vars: i.vars }));
}

// ---------------------------------------------------------------- from a bench or rating failure to its explainer
/** The plain words for a level spec the bench measured outside its band: units, the part by name, what it needs, and the likeliest cause. */
export interface MissCtx {
  /** The ticket's explainer family ('divider' | 'bridge' | 'blackbox' | 'pot'), for the causes that depend on what the ticket teaches. */
  mode?: string;
  /** Part uid -> what to call it ("the LED", "the 470 Ω resistor"). */
  names?: Readonly<Record<string, string>>;
  /** Part uid -> kind ('LED', 'R', ...). */
  kinds?: Readonly<Record<string, string>>;
}
const sigm = (x: number, lo: number, hi: number): number => {
  const span = Math.abs(hi - lo), mid = Math.max(Math.abs(hi), Math.abs(lo), 1e-12);
  return sig(x, span / mid < 0.01 ? 5 : 3);
};
export function explainLevelMiss(f: BenchFailure, ctx: MissCtx = {}): Explained | null {
  const v = f.vars, value = Number(v.value), lo = Number(v.lo), hi = Number(v.hi), probe = String(v.probe ?? '');
  if (!Number.isFinite(value) || !Number.isFinite(lo) || !Number.isFinite(hi)) return null;
  const m = /^([ivp])\((.*)\)$/.exec(probe);
  if (!m) return null;
  const q = m[1]!, arg = m[2]!;
  // the sign the player never meant: a current into the battery or a power drawn from it is negative in the solver; show it the way it reads
  const flip = hi <= 0 && lo < 0;
  const val = flip ? -value : value, a = flip ? -hi : lo, b = flip ? -lo : hi;
  const cond = String(v.cond ?? 'nominal'), condText = cond === 'nominal' ? '' : `, in the ${cond} test`;
  const unit = q === 'i' ? 'mA' : q === 'v' ? 'V' : 'W', k = q === 'i' ? 1000 : 1;
  const what = q === 'v' ? arg.split(',')[0]!.toUpperCase() : ctx.names?.[arg];
  if (what === undefined) return null;
  const kind = q === 'v' ? '' : (ctx.kinds?.[arg] ?? '');
  // a null detector (a galvanometer that must read zero, within a few microamps either side)
  if (q === 'i' && lo < 0 && hi > 0 && Math.max(-lo, hi) < 1e-3) return { key: ctx.mode === 'pot' ? 'bench.plain.null.fixed' : 'bench.plain.null', vars: { what, value: sig(Math.abs(value) * 1e6, 3), hi: sig(hi * 1e6, 3), cond: condText } };
  const open = b >= 1e3 ? 'atLeast' : a <= 0 ? 'atMost' : 'band';
  const vars: Vars = { what, value: sigm(val * k, a * k, Math.min(b, 1e5) * k), lo: sigm(a * k, a * k, Math.min(b, 1e5) * k), hi: sigm(Math.min(b, 1e5) * k, a * k, Math.min(b, 1e5) * k), unit, cond: condText };
  const dead = q === 'i' && Math.abs(val) < 1e-6;
  if (dead) { vars.value = 0; return { key: kind === 'LED' ? 'bench.plain.i.zero.led' : 'bench.plain.i.zero', vars }; }
  const low = val < a;
  if (cond === 'tired' && q === 'i' && low && open === 'band') return { key: 'bench.plain.i.low.band.tired', vars };
  return { key: `bench.plain.${q}.${low ? 'low' : 'high'}.${open}`, vars };
}

/** The solver stalled: say what the bench last saw, in the player's units, and never mention the solver. */
function explainStuck(f: BenchFailure, ctx: MissCtx = {}): Explained | null {
  const v = f.vars, value = Number(v.value), probe = String(v.probe ?? '');
  const m = /^([ivp])\((.*)\)$/.exec(probe);
  if (!Number.isFinite(value) || !m) return null;
  const q = m[1]!, arg = m[2]!;
  const what = q === 'v' ? arg.split(',')[0]!.toUpperCase() : ctx.names?.[arg];
  if (what === undefined) return null;
  const unit = q === 'i' ? 'mA' : q === 'v' ? 'V' : 'W', k = q === 'i' ? 1000 : 1;
  const cond = String(v.cond ?? 'nominal');
  return { key: 'bench.stuck.last', vars: { what, value: sig(Math.abs(value) * k, 3), unit, cond: cond === 'nominal' ? '' : ` in the ${cond} test` } };
}

export interface ExplainContext {
  /** Part names and kinds for the plain-words bench failures (explainLevelMiss). */
  miss?: MissCtx;
  /** Resistance of each part id, ohms (to turn a power finding into V = sqrt(P R)). */
  resistance?: Readonly<Record<string, number>>;
  /** Part ids that are electrolytic capacitors. */
  electrolytic?: readonly string[];
  /** Supply, loop and LED figures for a burned LED. */
  led?: Readonly<Record<string, LedLoop>>;
  /** Ticket 2-1: the player's divider as the bench sees it (top resistor, bottom resistor, the fixed load across the bottom one, the supply). */
  divider?: { r1: number; r2: number; rLoad: number; vin: number };
  /** Ticket 2-1: what is missing from the divider (checked before `divider`). */
  dividerFault?: DividerFault;
  /** Chapter 3: the RC filter on the board (3-1, 3-2) and the coil (3-3). */
  rc?: RcCtx;
  coil?: CoilCtx;
  /** Chapter 4: the rectifier (4-1), the Zener shunt (4-2), the regulator (4-3) and the LM317 (4-4) as the player built them. */
  rect?: { c: number; i: number; nDiodes: number };
  zener?: { r: number; vz: number; slope: number; izt: number };
  reg?: { rpre: number; vrail: number; vout: number; theta: number; ta: number; tjMax: number };
  lm317?: { r1: number; r2: number };
  /** Chapter 5: the fan driver (5-1), the 3.3 V gate (5-2), the NAND gate (5-3), the common-emitter amplifier (5-4) and its exam (5-5) as the player built them. */
  sw?: { rb: number; rpin: number; vpin: number; vfan: number; rfan: number; beta: number; icLimit: number; pRated: number; part: string };
  fet?: { part: string; vgs: number; vstrip: number; rstrip: number; vth: { minimum: number; typical: number; maximum: number }; theta: number; vleak: number; rpd: number };
  gate?: { nDiodes: number; rc: number; rl: number; vcc: number; vlow: number; hasPulldown: boolean };
  amp?: { r1: number; r2: number; rc: number; re: number; vcc: number; rsrc: number; rload: number; beta: { low: number; mid: number; high: number } };
  ce?: { rb: number; rc: number; beta: number; vcc: number; vbe: number };
  /** How many failures the player already had on this ticket (the first burn teaches the cause, a repeat gives the worked formula). */
  prior?: number;
}
/** Upgrade a rating or smoke failure ({ key, vars } from ratings.ts / smoke.ts) to the full explainer when the context has what it needs; otherwise return it unchanged. */
export function explainFailure(f: BenchFailure, ctx: ExplainContext = {}): Explained {
  return named(explainRaw(f, ctx), ctx);
}
/** {part} and its sentence-start form {Part}. */
const pn = (part: string): { part: string; Part: string } => ({ part, Part: capFirst(part) });
/** The part by name for the player ("the LED", "the 100 Ω ¼ W resistor"), never its id: {part} mid-sentence, {Part} at the start of one. */
function named(e: Explained, ctx: ExplainContext): Explained {
  const uid = e.vars.part;
  if (typeof uid !== 'string' || !ctx.miss?.names) return e;
  const nameOf = ctx.miss.names[uid] ?? uid;
  return { key: e.key, vars: { ...e.vars, part: nameOf, Part: capFirst(nameOf) } };
}
function explainRaw(f: BenchFailure, ctx: ExplainContext): Explained {
  const v = f.vars, part = String(v.part ?? '');
  const num = (k: string): number => Number(v[k]);
  const e4 = explainChapter4(f, ctx); if (e4) return e4;
  const e5 = explainChapter5(f, ctx); if (e5) return e5;
  switch (f.key) {
    case 'rating.resistor.power': case 'smoke.resistor': {
      const r = ctx.resistance?.[part];
      if (r === undefined) break;
      const p = num('value' in v ? 'value' : 'P'), rated = num('limit' in v ? 'limit' : 'Prated');
      return explainResistorPower({ part, v: Math.sqrt(p * r), r, p, rated });
    }
    case 'rating.cap.voltage': if (ctx.electrolytic?.includes(part)) {
      const vv = num('value'), lim = num('limit');
      if (vv <= lim * 1.2) return { key: ctx.miss?.mode === 'rectifier' ? 'explain.cap.overrating' : 'explain.cap.overrating.plain', vars: { ...pn(part), v: sig(vv), vRated: sig(lim), vVent: sig(lim * 1.2), vPick: firstAtLeast(CAP_VOLTAGES, vv * VOLTAGE_MARGIN) } };   // over its rating but not yet venting
      return explainElecOvervoltage({ part, v: vv, vRated: lim });
    } break;
    case 'smoke.cap.over': if (ctx.electrolytic?.includes(part)) return explainElecOvervoltage({ part, v: num('v'), vRated: num('vrated') }); break;
    case 'rating.cap.reverse': case 'smoke.cap.reverse': return explainElecReversed({ part, v: num('v') });
    case 'rating.led.current': case 'smoke.led.die': {
      const l = ctx.led?.[part];
      if (l) return explainLedOvercurrent({ part, i: num(f.key === 'rating.led.current' ? 'value' : 'i'), iRated: num(f.key === 'rating.led.current' ? 'limit' : 'iF'), loop: l, prior: ctx.prior });
      break;
    }
    case 'smoke.thermal': {   // an LED that cooked (a resistor too small for it): the power is known, the current follows from the LED's curve
      if (ctx.coil && part === ctx.coil.relay) { const p = num('P'), i = Math.sqrt(p / ctx.coil.rCoil); return { key: 'explain.coil.hot', vars: { ...pn(part), i: sig(i * 1000), v: sig(i * ctx.coil.rCoil), p: sig(p) } }; }   // a relay coil that cooked (24 V straight across 200 ohm)
      const l = ctx.led?.[part];
      if (l?.model && l.iRated) return explainLedOvercurrent({ part, i: ledCurrentFromPower(num('P'), l.model), iRated: l.iRated, loop: l, prior: ctx.prior });
      break;
    }
    case 'bench.level.fail': case 'bench.metric.fail': case 'bench.metric.nan': case 'bench.band.fail': {
      const e3 = explainChapter3(f, ctx); if (e3) return e3;
      if (ctx.dividerFault && /^v\(/.test(String(v.probe ?? ''))) return explainDividerFault({ ...ctx.dividerFault, lo: num('lo'), hi: num('hi') });
      if (ctx.divider && /^v\(/.test(String(v.probe ?? ''))) return explainDivider({ ...ctx.divider, lo: num('lo'), hi: num('hi') });
      const e = explainLevelMiss(f, ctx.miss); if (e) return e; break;
    }
    case 'bench.match.fail': {
      const value = num('value'), ref = num('ref'), cond = String(v.cond ?? ''), open = /open/.test(cond);
      return { key: open ? 'explain.match.open' : value > ref ? 'explain.match.high' : 'explain.match.low', vars: { cond, value: sig(value, 3), ref: sig(ref, 3), tol: sig(num('tol') * 100, 2) } };
    }
    case 'tran.noConverge': case 'solve.noConverge': { const e = explainStuck(f, ctx.miss); if (e) return e; return { key: 'bench.stuck', vars: { cond: String(v.cond ?? 'nominal') === 'nominal' ? '' : ` in the ${String(v.cond)} test` } }; }
    default: break;
  }
  return { key: f.key, vars: f.vars };
}
