// Smooth building blocks for the behavioural macros (softplus, logistic, soft clamp). Pure; dmath only (determinism).
import { dmath } from '@core/numerics';

/** softplus ln(1 + e^z), exact (= z or 0) beyond ±35 so saturated regions are bit-clean. */
export const sp = (z: number): number => (z > 35 ? z : z < -35 ? 0 : dmath.log(1 + dmath.exp(z)));
/** logistic 1/(1 + e^−z) = d softplus/dz. */
export const sg = (z: number): number => { if (z >= 0) return 1 / (1 + dmath.exp(-z)); const e = dmath.exp(z); return e / (1 + e); };
/** tanh with its derivative 1 − t². */
export const th = (z: number): { t: number; d: number } => { const t = z > 20 ? 1 : z < -20 ? -1 : dmath.tanh(z); return { t, d: 1 - t * t }; };

/**
 * Smooth clamp of x into [lo, hi] with corner width s: unity slope far from the limits, exactly lo / hi beyond them.
 * Returns y and the partials w.r.t. x, lo, hi (they sum to 1).
 */
export function sclamp(x: number, lo: number, hi: number, s: number): { y: number; dx: number; dlo: number; dhi: number } {
  const z1 = (hi - x) / s, s1 = sg(z1), u = hi - s * sp(z1);              // u = softmin(x, hi)
  const z2 = (u - lo) / s, s2 = sg(z2), y = lo + s * sp(z2);              // y = softmax(u, lo)
  return { y, dx: s2 * s1, dlo: 1 - s2, dhi: s2 * (1 - s1) };
}
