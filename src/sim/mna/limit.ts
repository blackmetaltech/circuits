// Junction step limiting (SPICE3 `DEVpnjlim`). Pure functions: the caller detects "limited" as `result !== vnew`.
//   A Newton step that would push an exponential junction far up its curve is log-compressed; a limited iteration is never
//   accepted as converged (op.ts), because the proposed point was not the true Newton point.
import { dmath } from '@core/numerics';

/** Critical voltage of a junction, V: vcrit = nVt·ln(nVt/(√2·Is)). Above it the exponential is too steep for a raw Newton step. */
export function vcritOf(nVt: number, is: number): number {
  return nVt * dmath.log(nVt / (Math.SQRT2 * is));
}

/**
 * Limit the new junction voltage `vnew` given the old one (SPICE3 pnjlim).
 *  - forward: if vnew > vcrit and |vnew − vold| > 2·nVt, compress the step logarithmically;
 *  - reverse (ngspice extension): a jump more negative than 2·vold−1 (vold ≤ 0) or −vold−1 (vold > 0) is clamped there,
 *    so a first reverse step from 0 V goes to −1, −3, −7, … (it still reaches any reverse bias in a few iterations).
 */
export function pnjlim(vnew: number, vold: number, nVt: number, vcrit: number): number {
  if (vnew > vcrit && Math.abs(vnew - vold) > nVt + nVt) {
    if (vold > 0) {
      const arg = (vnew - vold) / nVt;
      return arg > 0 ? vold + nVt * (2 + dmath.log(arg - 2)) : vold - nVt * (2 + dmath.log(2 - arg));
    }
    return nVt * dmath.log(vnew / nVt);
  }
  if (vnew < 0) {
    const arg = vold > 0 ? -vold - 1 : 2 * vold - 1;
    if (vnew < arg) return arg;
  }
  return vnew;
}
