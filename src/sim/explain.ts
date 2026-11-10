// Explain-after-failure (DESIGN §7.3) and topology explainers (§3.10). Pure: numbers from a solved state or bench report in,
// `{ key, vars }` out. English lives in src/locales/sim.en.ts (explain.*), filled with the player's own numbers, plain words first, then the equation.
// Numbers in vars are rounded to 3 significant figures; resistance, capacitance, time, frequency and small currents are SI-prefixed strings.
import { dmath } from '@core/numerics';
import type { TopoIssue } from './mna/types';
import type { Failure } from './mna/op';
import type { BenchFailure } from './bench/types';

export type Vars = Record<string, string | number>;
export interface Explained { key: string; vars: Vars }

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
    part: a.part, p: sig(a.p), rated: sig(a.rated), v: sig(a.v), r: si(a.r, 'Ω'), ratio: sig(a.p / a.rated, 2),
    rNext: firstAtLeast(POWER_RATINGS, a.p * POWER_MARGIN), rEach: si(2 * a.r, 'Ω'), pEach: sig(a.p / 2),
  } };
}
/** A battery or supply straight onto an LED: only the source's own resistance and the LED's resistance limited the current. */
export function explainLedOvercurrent(a: { part: string; i: number; iRated: number; vSupply: number; vForward: number; rSource: number; rLed: number }): Explained {
  const iWant = a.iRated / 2;
  return { key: 'explain.led.overcurrent', vars: {
    part: a.part, i: sig(a.i), iRated: sig(a.iRated), rSource: sig(a.rSource, 2), rLed: sig(a.rLed, 2),
    vSupply: sig(a.vSupply), vForward: sig(a.vForward), iWant: sig(iWant), rSeries: si(nearestE12((a.vSupply - a.vForward) / iWant), 'Ω'),
  } };
}
export function explainElecOvervoltage(a: { part: string; v: number; vRated: number }): Explained {
  return { key: 'explain.cap.overvoltage', vars: { part: a.part, v: sig(a.v), vRated: sig(a.vRated), vPick: firstAtLeast(CAP_VOLTAGES, a.v * VOLTAGE_MARGIN) } };
}
export function explainElecReversed(a: { part: string; v: number }): Explained {
  return { key: 'explain.cap.reversed', vars: { part: a.part, v: sig(a.v) } };
}
/** A transistor that dissipates in the active region because its base drive was too small for the load current. */
export function explainBjtActive(a: { part: string; vce: number; ic: number; ib: number; pRated: number; beta?: number }): Explained {
  const beta = a.beta ?? 10;
  return { key: 'explain.bjt.active', vars: {
    part: a.part, vce: sig(a.vce), ic: sig(a.ic), p: sig(a.vce * a.ic), pRated: sig(a.pRated), ib: si(a.ib, 'A'), ibNeeded: si(a.ic / beta, 'A'), beta,
  } };
}
export function explainInductiveKick(a: { part: string; load: string; vPeak: number; vceo: number }): Explained {
  return { key: 'explain.inductiveKick', vars: { part: a.part, load: a.load, vPeak: sig(a.vPeak), vceo: sig(a.vceo) } };
}
export function explainMosfetUnderdriven(a: { part: string; vgs: number; vth: number; id: number; vds: number; theta: number }): Explained {
  return { key: 'explain.mosfet.underdriven', vars: {
    part: a.part, vgs: sig(a.vgs), vth: sig(a.vth), id: si(a.id, 'A'), vds: sig(a.vds), p: sig(a.id * a.vds), theta: sig(a.theta),
  } };
}
export function explainRegulatorThermal(a: { part: string; vin: number; vout: number; i: number; ta: number; theta: number; tShutdown?: number; tTarget?: number }): Explained {
  const p = (a.vin - a.vout) * a.i, tTarget = a.tTarget ?? 125;
  return { key: 'explain.regulator.thermal', vars: {
    part: a.part, p: sig(p), vin: sig(a.vin), vout: sig(a.vout), i: sig(a.i), ta: sig(a.ta), theta: sig(a.theta), tj: sig(a.ta + p * a.theta),
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
    part: a.part, gbw: si(a.gbw, 'Hz'), gain: sig(a.gain), bw: si(bw, 'Hz'), f: si(a.f, 'Hz'),
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
export function explainFloatingGate(a: { part: string; rPull?: number }): Explained {
  return { key: 'explain.floatingGate', vars: { part: a.part, rPull: si(a.rPull ?? 100e3, 'Ω') } };
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
export interface ExplainContext {
  /** Resistance of each part id, ohms (to turn a power finding into V = sqrt(P R)). */
  resistance?: Readonly<Record<string, number>>;
  /** Part ids that are electrolytic capacitors. */
  electrolytic?: readonly string[];
  /** Supply and LED figures for a straight-on LED. */
  led?: Readonly<Record<string, { vSupply: number; vForward: number; rSource: number; rLed: number }>>;
}
/** Upgrade a rating or smoke failure ({ key, vars } from ratings.ts / smoke.ts) to the full explainer when the context has what it needs; otherwise return it unchanged. */
export function explainFailure(f: BenchFailure, ctx: ExplainContext = {}): Explained {
  const v = f.vars, part = String(v.part ?? '');
  const num = (k: string): number => Number(v[k]);
  switch (f.key) {
    case 'rating.resistor.power': case 'smoke.resistor': {
      const r = ctx.resistance?.[part];
      if (r === undefined) break;
      const p = num('value' in v ? 'value' : 'P'), rated = num('limit' in v ? 'limit' : 'Prated');
      return explainResistorPower({ part, v: Math.sqrt(p * r), r, p, rated });
    }
    case 'rating.cap.voltage': if (ctx.electrolytic?.includes(part)) return explainElecOvervoltage({ part, v: num('value'), vRated: num('limit') }); break;
    case 'smoke.cap.over': if (ctx.electrolytic?.includes(part)) return explainElecOvervoltage({ part, v: num('v'), vRated: num('vrated') }); break;
    case 'rating.cap.reverse': case 'smoke.cap.reverse': return explainElecReversed({ part, v: num('v') });
    case 'rating.led.current': case 'smoke.led.die': {
      const l = ctx.led?.[part];
      if (l) return explainLedOvercurrent({ part, i: num('value' in v ? 'value' : 'i'), iRated: num('limit' in v ? 'limit' : 'iF'), ...l });
      break;
    }
    default: break;
  }
  return { key: f.key, vars: f.vars };
}
