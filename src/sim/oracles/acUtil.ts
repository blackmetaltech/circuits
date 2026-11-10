// Oracle helpers for AC tests: cards → compile → DC OP → AC. (Test support, not a test.)
import { abs, arg } from '@core/numerics';
import { expect } from 'vitest';
import { parseNetlist } from '../mna/netlist';
import { compileNetlist } from '../mna/compile';
import { makeAc, type AcAnalysis } from '../mna/ac';
import type { Netlist } from '../mna/types';

export function acNetlist(nl: Netlist): AcAnalysis {
  const r = compileNetlist(nl);
  if (!r.ok) throw new Error(JSON.stringify(r.errors));
  const ac = makeAc(r.circuit);
  if (!ac.ok) throw new Error('AC setup failed: ' + JSON.stringify(ac.failure));
  return ac;
}
export const acCards = (cards: string): AcAnalysis => acNetlist(parseNetlist(cards));

export const RAD = 180 / Math.PI;
export const mag = abs;
export const phaseDeg = (z: { re: number; im: number }): number => arg(z) * RAD;
/** Phase closeness in degrees (absolute, ±tol). */
export function nearDeg(actual: number, expected: number, tol = 0.3): void {
  let d = actual - expected; d -= 360 * Math.round(d / 360);
  expect(Math.abs(d), `phase got ${actual}°, want ${expected}°`).toBeLessThanOrEqual(tol);
}
/** Bisection on a monotone-bracketed function (test support). */
export function bisect(fn: (x: number) => number, lo: number, hi: number, n = 80): number {
  const flo = fn(lo);
  for (let k = 0; k < n; k++) { const m = 0.5 * (lo + hi), fm = fn(m); if ((fm < 0) === (flo < 0)) lo = m; else hi = m; }
  return 0.5 * (lo + hi);
}
