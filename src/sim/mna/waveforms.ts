// Source waveforms (DESIGN §3.5). A waveform is plain JSON stored on the element (`Element.wave`); a source without one is DC (p.v / p.i).
// Each waveform is a pure function of time and publishes its BREAKPOINTS (edge times) so the transient stepper can land on them
// exactly and restart with backward Euler. The 1 µs power-on ramp (`POWER_ON_RAMP`) is applied by the stepper through ctx.lambda.
// Edges are clamped to ≥ MIN_EDGE so "instant" edges still have a defined slope. Phases are radians. Determinism: dmath only.
import { dmath } from '@core/numerics';
import type { Element } from './types';

export const POWER_ON_RAMP = 1e-6;
export const MIN_EDGE = 1e-9;

export type Wave =
  | { k: 'sine'; offset: number; amp: number; f: number; phase?: number; delay?: number }
  | { k: 'pulse'; v1: number; v2: number; width: number; delay?: number; rise?: number; fall?: number; period?: number }
  | { k: 'pwl'; pts: [number, number][] };

export const sine = (amp: number, f: number, phase = 0, offset = 0, delay = 0): Wave => ({ k: 'sine', offset, amp, f, phase, delay });
export const pulse = (v1: number, v2: number, width: number, o: { delay?: number; rise?: number; fall?: number; period?: number } = {}): Wave => ({ k: 'pulse', v1, v2, width, ...o });
/** Square wave between lo and hi with the given period and duty (0..1), edges `edge` s long (centred on nothing: edges follow the delay). */
export const square = (lo: number, hi: number, period: number, duty = 0.5, edge = MIN_EDGE, delay = 0): Wave =>
  ({ k: 'pulse', v1: lo, v2: hi, width: duty * period - edge, delay, rise: edge, fall: edge, period });
export const pwl = (pts: [number, number][]): Wave => ({ k: 'pwl', pts });

const edge = (x: number | undefined): number => Math.max(x ?? 0, MIN_EDGE);

export function waveValue(w: Wave, t: number): number {
  if (w.k === 'sine') {
    const td = w.delay ?? 0, ph = w.phase ?? 0;
    return w.offset + w.amp * dmath.sin(t < td ? ph : 2 * Math.PI * w.f * (t - td) + ph);
  }
  if (w.k === 'pulse') {
    let tt = t - (w.delay ?? 0);
    if (tt < 0) return w.v1;
    const r = edge(w.rise), f = edge(w.fall);
    if (w.period && w.period > 0) tt -= Math.floor(tt / w.period) * w.period;
    if (tt < r) return w.v1 + ((w.v2 - w.v1) * tt) / r;
    if (tt < r + w.width) return w.v2;
    if (tt < r + w.width + f) return w.v2 + ((w.v1 - w.v2) * (tt - r - w.width)) / f;
    return w.v1;
  }
  const p = w.pts;
  if (p.length === 0) return 0;
  if (t <= p[0][0]) return p[0][1];
  for (let k = 1; k < p.length; k++) if (t <= p[k][0]) { const [t0, v0] = p[k - 1], [t1, v1] = p[k]; return t1 === t0 ? v1 : v0 + ((v1 - v0) * (t - t0)) / (t1 - t0); }
  return p[p.length - 1][1];
}

/** Edge times in (0, tStop], ascending (duplicates allowed; the stepper skips them). */
export function waveBreakpoints(w: Wave, tStop: number): number[] {
  const out: number[] = [];
  if (w.k === 'sine') { if ((w.delay ?? 0) > 0 && w.delay! <= tStop) out.push(w.delay!); return out; }
  if (w.k === 'pwl') { for (const [t] of w.pts) if (t > 0 && t <= tStop) out.push(t); return out; }
  const d = w.delay ?? 0, r = edge(w.rise), f = edge(w.fall), per = w.period && w.period > 0 ? w.period : 0;
  for (let k = 0; ; k++) {
    const t0 = d + k * per;
    if (t0 > tStop) break;
    for (const t of [t0, t0 + r, t0 + r + w.width, t0 + r + w.width + f]) if (t > 0 && t <= tStop) out.push(t);
    if (!per) break;
  }
  return out;
}

/** Value of an independent source element at time t (before the lambda scale): its waveform, else p[key]. */
export const sourceValue = (el: Element, key: 'v' | 'i', t: number): number => (el.wave ? waveValue(el.wave, t) : el.p[key]);
