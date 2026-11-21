// Rating checks (DESIGN §3.8) and the bench RatingReport. Pure: a measured window in, a verdict out.
//
// Violations use the datasheet symbol as `what` ('P', 'Vrated', 'VRRM', 'IF(AV)', 'Vceo', 'Tj'...): symbols are not translatable prose.
// Each finding also carries an i18n `key` + `vars` (rating.* in src/locales/sim.en.ts) for the explainer (§7.3).
import type { BenchFailure, BenchWindow, RatingReport, RatingViolation } from './bench/types';
import { SEMI_KINDS, avg, maxOf, minOf, partElements, partPower, partSignals, peakAbs, sig, steadyT, thermalState, thetaTotal, ratingProbes, type NetLike, type RatedPart, type ThermalState, type Window } from './thermal';
import { failureBehaviour, instantFailures, thermalSmoke, type FailureBehaviour } from './smoke';

export { ratingProbes };

export const ELEC_REVERSE_RATING_V = 0.5;   // electrolytic V >= -0.5 V (§3.8)
export const BJT_VEBO_DEFAULT = 6;          // V_eb,rev <= 6 V
export const MOS_VGS_DEFAULT = 20;          // |Vgs| <= 20 V

export interface RatingFinding extends RatingViolation { key: string; vars: Record<string, string | number> }
export interface RatingOptions {
  /** Ambient, C (default 25). */
  ta?: number;
  /** Parts that smoked in earlier runs: still reported smoked (the bench refuses burnt parts). */
  previouslySmoked?: readonly string[];
  /** A ticket's own junction limit (deg C), tighter than the part's: the finding names this number ("Tj <= 125 C"). */
  tjLimit?: number;
}
export interface RatingResult extends RatingReport {
  findings: RatingFinding[];
  /** Explainer failures: rating findings plus every smoke cause, as { key, vars }. */
  failures: BenchFailure[];
  power: Record<string, { avg: number; peak: number }>;
  tSteady: Record<string, number>;
  states: Record<string, ThermalState>;
  failureModes: Record<string, FailureBehaviour>;
}

export function checkRatings(ckt: NetLike, parts: readonly RatedPart[], w: Window, o: RatingOptions = {}): RatingResult {
  const ta = o.ta ?? 25;
  const findings: RatingFinding[] = [], failures: BenchFailure[] = [];
  const power: RatingResult['power'] = {}, tSteady: Record<string, number> = {}, states: Record<string, ThermalState> = {}, failureModes: Record<string, FailureBehaviour> = {};
  const smoked: string[] = [];
  const mark = (id: string): void => { if (!smoked.includes(id)) smoked.push(id); };

  for (const part of parts) {
    if (partElements(ckt, part).length === 0) continue;
    const id = part.id, r = part.ratings, s = partSignals(ckt, part);
    const v = sig(w, s.v), vc = sig(w, s.vc), i = sig(w, s.i);
    const add = (what: string, value: number, limit: number, key: string, extra: Record<string, string | number> = {}): void => {
      findings.push({ part: id, what, value, limit, key, vars: { part: id, what, value, limit, ...extra } });
    };
    const pw = partPower(ckt, part, w);
    power[id] = pw;
    switch (part.kind) {
      case 'R': if (r.P !== undefined && pw.avg > r.P) add('P', pw.avg, r.P, 'rating.resistor.power', { ratio: pw.avg / r.P }); break;
      case 'C': case 'CE': {
        if (r.Vrated !== undefined && peakAbs(v) > r.Vrated) add('Vrated', peakAbs(v), r.Vrated, 'rating.cap.voltage');
        if (part.kind === 'CE' && v && minOf(v) < -ELEC_REVERSE_RATING_V) add('VrevMax', -minOf(v), ELEC_REVERSE_RATING_V, 'rating.cap.reverse', { v: minOf(v) });
        break;
      }
      case 'D': case 'SCHOTTKY': {
        if (r.IFAV !== undefined && i && avg(i) > r.IFAV) add('IF(AV)', avg(i), r.IFAV, 'rating.diode.current');
        if (r.VRRM !== undefined && v && -minOf(v) > r.VRRM) add('VRRM', -minOf(v), r.VRRM, 'rating.diode.reverse');
        if (r.IFRM !== undefined && i && maxOf(i) > r.IFRM) add('IFRM', maxOf(i), r.IFRM, 'rating.diode.peak', { avg: avg(i) });
        break;
      }
      case 'LED': {
        if (r.IF !== undefined && i && avg(i) > r.IF) add('IF', avg(i), r.IF, 'rating.led.current');
        if (r.IFP !== undefined && i && maxOf(i) > r.IFP) add('IFP', maxOf(i), r.IFP, 'rating.led.peak');
        if (r.VR !== undefined && v && -minOf(v) > r.VR) add('VR', -minOf(v), r.VR, 'rating.diode.reverse');
        break;
      }
      case 'Z': if (r.Pd !== undefined && pw.avg > r.Pd) add('Pd', pw.avg, r.Pd, 'rating.zener.power'); break;
      case 'NPN': case 'PNP': case 'DARLINGTON': {
        if (r.Vceo !== undefined && peakAbs(v) > r.Vceo) add('Vceo', peakAbs(v), r.Vceo, 'rating.bjt.vceo');
        if (r.Ic !== undefined && peakAbs(i) > r.Ic) add('Ic', peakAbs(i), r.Ic, 'rating.bjt.ic');
        // reverse base-emitter: NPN reverse is Vbe < 0, PNP reverse is Vbe > 0
        const rev = vc ? (part.kind === 'PNP' ? maxOf(vc) : -minOf(vc)) : 0, lim = r.Vebo ?? BJT_VEBO_DEFAULT;
        if (rev > lim) add('Vebo', rev, lim, 'rating.bjt.veb');
        break;
      }
      case 'NMOS': {
        if (r.Vds !== undefined && peakAbs(v) > r.Vds) add('Vds', peakAbs(v), r.Vds, 'rating.mosfet.vds');
        const vg = r.VgsMax ?? MOS_VGS_DEFAULT;
        if (peakAbs(vc) > vg) add('Vgs', peakAbs(vc), vg, 'rating.mosfet.vgs');
        if (r.Id !== undefined && i && Math.abs(avg(i)) > r.Id) add('Id', Math.abs(avg(i)), r.Id, 'rating.mosfet.id');
        break;
      }
      case 'L': if (r.Isat !== undefined && peakAbs(i) > r.Isat) add('Isat', peakAbs(i), r.Isat, 'rating.inductor.sat'); break;
      default: break;
    }
    // thermal: steady state, the bench never waits
    const T = steadyT(ta, pw.avg, thetaTotal(part.thermal, part.heatsink));
    tSteady[id] = T;
    states[id] = thermalState(part, pw.avg, T);
    const tjLim = Math.min(part.thermal.tMax, o.tjLimit ?? Infinity);
    if (SEMI_KINDS.includes(part.kind) && T > tjLim) add('Tj', T, tjLim, 'rating.thermal.tj', { P: pw.avg, ta, theta: thetaTotal(part.thermal, part.heatsink) });
    const ts = thermalSmoke(part, pw.avg, ta);
    if (ts) { mark(id); failures.push({ key: ts.key, vars: ts.vars }); }
  }
  // findings first (they explain), then smoke causes; both already in part order
  failures.unshift(...findings.map((f) => ({ key: f.key, vars: f.vars })));
  for (const f of instantFailures(ckt, parts, w)) { mark(f.part); failures.push({ key: f.key, vars: f.vars }); }
  for (const id of o.previouslySmoked ?? []) if (parts.some((p) => p.id === id)) mark(id);
  const ordered = parts.map((p) => p.id).filter((id) => smoked.includes(id));
  for (const part of parts) if (ordered.includes(part.id)) failureModes[part.id] = failureBehaviour(part.kind);
  return { violations: findings.map(({ part, what, value, limit }) => ({ part, what, value, limit })), smoked: ordered, findings, failures, power, tSteady, states, failureModes };
}

/** A pure `BenchOptions.ratings` callback: record `ratingProbes(...)` in the rating spec, the bench hands the measured window here. */
export function ratingsFromWindow(ckt: NetLike, parts: readonly RatedPart[], o: RatingOptions = {}): (w: BenchWindow) => RatingReport {
  return (w) => { const r = checkRatings(ckt, parts, w, o); return { violations: r.violations, smoked: r.smoked }; };
}
