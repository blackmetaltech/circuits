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

/**
 * Limit the new gate-source voltage (SPICE3 `DEVfetlim`), `vto` the threshold of the equivalent N-channel device.
 * Far above threshold the step may not drop below vto + 2 (or fall by more than half the high-water step), crossing Vt downward
 * stops at vto − 0.5, and an OFF device may not jump more than ~vto + 4 in one step: the square law never sees a wild first guess.
 */
export function fetlim(vnew: number, vold: number, vto: number): number {
  const vtsthi = Math.abs(2 * (vold - vto)) + 2, vtstlo = vtsthi / 2 + 2, vtox = vto + 3.5, delv = vnew - vold;
  let v = vnew;
  if (vold >= vto) {
    if (vold >= vtox) {
      if (delv <= 0) {
        if (vnew >= vtox) { if (-delv > vtstlo) v = vold - vtstlo; } else v = Math.max(vnew, vto + 2);
      } else if (delv >= vtsthi) v = vold + vtsthi;
    } else if (delv <= 0) v = Math.max(vnew, vto - 0.5); else v = Math.min(vnew, vto + 4);
  } else if (delv <= 0) {
    if (-delv > vtsthi) v = vold - vtsthi;
  } else {
    const vtemp = vto + 0.5;
    if (vnew <= vtemp) { if (delv > vtstlo) v = vold + vtstlo; } else v = vtemp;
  }
  return v;
}

/** Limit the new drain-source voltage (SPICE3 `DEVlimvds`): growth is capped near the 3.5 V knee so a first step cannot overshoot into deep saturation. */
export function limvds(vnew: number, vold: number): number {
  if (vold >= 3.5) {
    if (vnew > vold) return Math.min(vnew, 3 * vold + 2);
    return vnew < 3.5 ? Math.max(vnew, 2) : vnew;
  }
  return vnew > vold ? Math.min(vnew, 4) : Math.max(vnew, -0.5);
}
