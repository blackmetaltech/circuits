// Oracle helpers for transient tests: cards → compile → runTran, with interpolating accessors. (Test support, not a test.)
import { parseNetlist } from '../mna/netlist';
import { compileNetlist } from '../mna/compile';
import { runTran, type TranOptions, type TranResult } from '../mna/tran';
import type { Circuit, Netlist } from '../mna/types';

export interface TranRun { ckt: Circuit; res: TranResult; t: number[]; y: (probe: string) => number[]; at: (probe: string, t: number) => number }

export function tranNetlist(nl: Netlist, o: TranOptions): TranRun {
  const r = compileNetlist(nl);
  if (!r.ok) throw new Error(JSON.stringify(r.errors));
  const res = runTran(r.circuit, o);
  if (!res.ok) throw new Error('tran failed: ' + JSON.stringify(res.failure));
  const y = (p: string): number[] => { const s = res.series[p]; if (!s) throw new Error('no probe ' + p); return s; };
  return { ckt: r.circuit, res, t: res.t, y, at: (p, t) => interp(res.t, y(p), t) };
}
export const tranCards = (cards: string, o: TranOptions): TranRun => tranNetlist(parseNetlist(cards), o);

/** Linear interpolation of (t, y) at time tq. */
export function interp(t: number[], y: number[], tq: number): number {
  let lo = 0, hi = t.length - 1;
  if (tq <= t[0]) return y[0];
  if (tq >= t[hi]) return y[hi];
  while (hi - lo > 1) { const m = (lo + hi) >> 1; if (t[m] <= tq) lo = m; else hi = m; }
  const f = (tq - t[lo]) / (t[hi] - t[lo]);
  return y[lo] + f * (y[hi] - y[lo]);
}
/** First time y crosses `level` (linear interpolation between samples); NaN if never. */
export function crossing(t: number[], y: number[], level: number): number {
  for (let k = 1; k < t.length; k++) {
    if ((y[k - 1] - level) * (y[k] - level) <= 0 && y[k - 1] !== y[k]) return t[k - 1] + ((level - y[k - 1]) / (y[k] - y[k - 1])) * (t[k] - t[k - 1]);
  }
  return NaN;
}
/** ∫ y dt, trapezoid over the recorded samples. */
export function integrate(t: number[], y: number[]): number {
  let s = 0; for (let k = 1; k < t.length; k++) s += 0.5 * (y[k] + y[k - 1]) * (t[k] - t[k - 1]);
  return s;
}
