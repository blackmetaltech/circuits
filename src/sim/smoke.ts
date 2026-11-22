// Smoke: thermal smoke, instant failures, failure behaviour and the smoked-part state (DESIGN §3.9, §7.3).
// Pure. Failures are `{ key, vars }`; English lives in src/locales/sim.en.ts (smoke.* keys).
import type { PartKind } from '../data/parts/types';
import type { Element, Netlist } from './mna/types';
import type { BenchFailure } from './bench/types';
import { THREE_TERMINAL_KINDS, dwell, minOf, partElements, partSignals, peakAbs, ratedPower, sig, steadyT, thetaTotal, ownerOf, type NetLike, type RatedPart, type Window } from './thermal';

// ---- constants (DESIGN §3.9 unless noted)
export const MOS_VGS_BREAKDOWN = 20;        // V, gate oxide punch-through
export const BJT_AVALANCHE = 1.2;           // x Vceo while conducting
export const BJT_CONDUCTING_A = 1e-3;       // ASSUMPTION: "conducting" = |Ic| above 1 mA (the design gives no threshold)
export const CAP_OVER = 1.2;                // x Vrated ...
export const CAP_OVER_S = 0.05;             // ... for longer than 50 ms
export const ELEC_REVERSE_V = 1;            // V, reverse for longer than ...
export const ELEC_REVERSE_S = 0.5;          // ... 0.5 s vents
export const BREAKDOWN_A = 1e-3;            // ASSUMPTION: "breakdown with current" = reverse |I| above 1 mA
export const LED_DIE = 3;                   // x IF,abs
export const FUSE_WINDOW_S = 0.05;          // I2t accumulator window
export const FUSE_FAST = 2;                 // ESTIMATE: fast-blow = (2 x Irated)^2 over 50 ms when the catalogue gives no I2t

export type InstantRule = 'mosfetGate' | 'bjtAvalanche' | 'capOverVoltage' | 'capReverse' | 'diodeBreakdown' | 'ledDie' | 'fuse' | 'meterFuse' | 'thermal';
export interface InstantFailure { part: string; rule: InstantRule; key: string; vars: Record<string, string | number> }

/** Thermal smoke: steady T = Ta + P*theta above tFail. Resistors: roughly 2.6x rated power at Ta = 25 C (theta = 85/P, tFail 250 C). */
export function thermalSmoke(part: RatedPart, pAvg: number, ta: number): InstantFailure | null {
  if (part.kind === 'REG') return null;   // a linear regulator protects itself: its thermal shutdown latches the output off and on (it is not destroyed by heat)
  const T = steadyT(ta, pAvg, thetaTotal(part.thermal, part.heatsink));
  if (!(T > part.thermal.tFail)) return null;
  const pr = ratedPower(part) ?? 0;
  if (part.kind === 'R') return { part: part.id, rule: 'thermal', key: 'smoke.resistor', vars: { part: part.id, P: pAvg, Prated: pr, ratio: pr > 0 ? pAvg / pr : 0, T, tFail: part.thermal.tFail } };
  return { part: part.id, rule: 'thermal', key: 'smoke.thermal', vars: { part: part.id, P: pAvg, T, tFail: part.thermal.tFail } };
}

/** Instant failures over the measured window (no thermal delay). Order: parts, then rule order. */
export function instantFailures(ckt: NetLike, parts: readonly RatedPart[], w: Window): InstantFailure[] {
  const out: InstantFailure[] = [];
  for (const part of parts) {
    if (partElements(ckt, part).length === 0) continue;
    const s = partSignals(ckt, part), v = sig(w, s.v), vc = sig(w, s.vc), i = sig(w, s.i), r = part.ratings, id = part.id;
    const add = (rule: InstantRule, key: string, vars: Record<string, string | number>): void => { out.push({ part: id, rule, key, vars: { part: id, ...vars } }); };
    switch (part.kind) {
      case 'NMOS': {
        const pk = peakAbs(vc);
        if (pk > MOS_VGS_BREAKDOWN) add('mosfetGate', 'smoke.mosfet.gate', { vgs: pk, limit: MOS_VGS_BREAKDOWN });
        break;
      }
      case 'NPN': case 'PNP': case 'DARLINGTON': {
        const vceo = r.Vceo; if (vceo === undefined || !v || !i) break;
        let pk = 0;
        for (let k = 0; k < v.y.length; k++) if ((Math.abs(i.y[k] ?? 0) > BJT_CONDUCTING_A || Math.abs(i.y[k - 1] ?? 0) > BJT_CONDUCTING_A) && Math.abs(v.y[k]) > BJT_AVALANCHE * vceo && Math.abs(v.y[k]) > pk) pk = Math.abs(v.y[k]);   // (or it was conducting one sample ago: an inductive kick is the instant after the current stopped)
        if (pk > 0) add('bjtAvalanche', 'smoke.bjt.avalanche', { vce: pk, vceo, limit: BJT_AVALANCHE * vceo });
        break;
      }
      case 'C': case 'CE': {
        const vr = r.Vrated;
        if (vr !== undefined && v) {
          const lim = CAP_OVER * vr;
          if (dwell({ t: v.t, y: v.y.map(Math.abs) }, (x) => x > lim) > CAP_OVER_S) add('capOverVoltage', 'smoke.cap.over', { v: peakAbs(v), vrated: vr, limit: lim, electrolytic: part.kind === 'CE' ? 1 : 0 });
        }
        if (part.kind === 'CE' && v && dwell(v, (x) => x < -ELEC_REVERSE_V) > ELEC_REVERSE_S) add('capReverse', 'smoke.cap.reverse', { v: minOf(v), limit: -ELEC_REVERSE_V });
        break;
      }
      case 'D': case 'LED': case 'Z': case 'SCHOTTKY': {
        const lim = part.kind === 'LED' ? r.VR : r.VRRM;
        if (lim !== undefined && v && i) {
          let pk = 0;
          for (let k = 0; k < v.y.length; k++) if (-v.y[k] > lim && Math.abs(i.y[k] ?? 0) > BREAKDOWN_A && -v.y[k] > pk) pk = -v.y[k];
          if (pk > 0) add('diodeBreakdown', 'smoke.diode.breakdown', { v: pk, limit: lim });
        }
        if (part.kind === 'LED' && r.IF !== undefined && peakAbs(i) > LED_DIE * r.IF) add('ledDie', 'smoke.led.die', { i: peakAbs(i), iF: r.IF, limit: LED_DIE * r.IF });
        break;
      }
      case 'FUSE': {
        if (!i) break;
        const lim = r.I2t ?? (FUSE_FAST * (r.Irated ?? Infinity)) * (FUSE_FAST * (r.Irated ?? Infinity)) * FUSE_WINDOW_S;
        const a = windowI2t(i);
        if (a >= lim) add('fuse', 'smoke.fuse', { i2t: a, limit: lim, irated: r.Irated ?? 0 });
        break;
      }
      case 'METER': {
        if (r.Irated !== undefined && peakAbs(i) > r.Irated) add('meterFuse', 'smoke.meter.fuse', { i: peakAbs(i), limit: r.Irated });
        break;
      }
      default: break;
    }
  }
  return out;
}

/** Largest integral of i^2 over any 50 ms span of the window (a single DC sample counts as 50 ms of i^2). */
function windowI2t(s: { t: number[]; y: number[] }): number {
  const n = s.y.length;
  if (n === 1) return s.y[0] * s.y[0] * FUSE_WINDOW_S;
  let best = 0;
  for (let a = 0; a < n; a++) {
    let acc = 0, reached = false;
    for (let k = a + 1; k < n; k++) {
      const dt = s.t[k] - s.t[k - 1], rem = s.t[a] + FUSE_WINDOW_S - s.t[k - 1];
      const use = Math.min(dt, rem); if (use <= 0) { reached = true; break; }
      acc += use * ((s.y[k - 1] * s.y[k - 1] + s.y[k] * s.y[k]) / 2);
      if (dt >= rem) { reached = true; break; }
    }
    if (reached && acc > best) best = acc;
  }
  return best;
}

// ---------------------------------------------------------------- failure behaviour
export interface FailureBehaviour {
  effect: 'open' | 'short' | 'hiZ';
  /** Resistance of the failed branch, ohm. */
  r: number;
  /** Transistors: terminal indices (into Element.nodes) the short joins. */
  between?: [number, number];
  /** MOSFET: the gate is also shorted to this terminal index. */
  gateTo?: number;
  /** Op-amp: extra supply draw, A. */
  supplyA?: number;
}
const OPEN: FailureBehaviour = { effect: 'open', r: 1e9 };

/** What a dead part does on the board (DESIGN §3.9 "Failure behaviour"): the board keeps working with the dead part. */
export function failureBehaviour(kind: PartKind): FailureBehaviour {
  switch (kind) {
    case 'R': case 'CE': case 'LED': case 'REG': return { ...OPEN };
    case 'C': return { effect: 'short', r: 0.1 };
    case 'D': case 'Z': case 'SCHOTTKY': return { effect: 'short', r: 0.5 };
    case 'NPN': case 'PNP': case 'DARLINGTON': return { effect: 'short', r: 0.5, between: [0, 2] };
    case 'NMOS': return { effect: 'short', r: 0.5, between: [0, 2], gateTo: 2 };
    case 'OPAMP': case 'CMP': return { effect: 'hiZ', r: 1e9, supplyA: 0.05 };
    default: return { ...OPEN };
  }
}

/**
 * The netlist as it behaves after the given owners smoked. Rewrites two-terminal parts (open / short as a resistor), transistors (C-E / D-S
 * short, MOSFET gate to source). Op-amp / regulator macros (pin order owned by the macro devices) are left untouched here: their behaviour
 * is in `failureBehaviour` and is applied by the macro device (output high-Z, 50 mA supply, open regulator). Pure.
 */
export function applyFailures(nl: Netlist, smoked: readonly string[], kinds: Readonly<Record<string, PartKind>>): Netlist {
  const dead = (e: Element): PartKind | undefined => (smoked.includes(ownerOf(e)) ? kinds[ownerOf(e)] : undefined);
  const elements: Element[] = [];
  for (const e of nl.elements) {
    const kind = dead(e);
    if (kind === undefined) { elements.push(e); continue; }
    const b = failureBehaviour(kind);
    if (kind === 'R' && e.kind === 'R') { elements.push({ ...e, p: { ...e.p, r: b.r } }); continue; }
    if (b.between && THREE_TERMINAL_KINDS.includes(kind) && e.nodes.length >= 3) {
      elements.push({ id: e.id, kind: 'R', owner: e.owner, nodes: [e.nodes[b.between[0]], e.nodes[b.between[1]]], p: { r: b.r } });
      if (b.gateTo !== undefined) elements.push({ id: `${e.id}#g`, kind: 'R', owner: e.owner, nodes: [e.nodes[1], e.nodes[b.gateTo]], p: { r: b.r } });
      continue;
    }
    if (e.nodes.length === 2) { elements.push({ id: e.id, kind: 'R', owner: e.owner, nodes: [e.nodes[0], e.nodes[1]], p: { r: b.r } }); continue; }
    elements.push(e);
  }
  return { ...nl, elements };
}

// ---------------------------------------------------------------- smoked parts are never accepted again
export interface SmokeState { smoked: string[] }
export const emptySmokeState = (): SmokeState => ({ smoked: [] });
/** Union, sorted, unique (a new state; the input is not touched). */
export function markSmoked(s: SmokeState, ids: readonly string[]): SmokeState {
  const all = [...s.smoked]; for (const id of ids) if (!all.includes(id)) all.push(id);
  return { smoked: all.sort() };
}
/** "The customer won't take burnt parts": one failure per smoked part still on the board. */
export function refuseSmoked(s: SmokeState, boardParts: readonly string[]): BenchFailure[] {
  return boardParts.filter((id) => s.smoked.includes(id)).map((part) => ({ key: 'smoke.refused', vars: { part } }));
}
