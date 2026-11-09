// Grid helpers (DESIGN §3.1): pads are integer [x, y] with y growing downwards; "row-major" order (y, then x) is the canonical
// deterministic order for pads. Rotation is clockwise on screen in quarter turns; flip mirrors x BEFORE rotating.
import type { Pad, Rot } from './types';

export const padKey = (p: Pad): string => p[0] + ',' + p[1];
export const samePad = (a: Pad, b: Pad): boolean => a[0] === b[0] && a[1] === b[1];
/** Row-major comparator (y, then x): the canonical order for pads. */
export const padCmp = (a: Pad, b: Pad): number => a[1] - b[1] || a[0] - b[0];
export const isInt = (n: number): boolean => Number.isInteger(n);
/** Pads are valid on 0 ≤ x < w, 0 ≤ y < h. */
export const inBounds = (b: { w: number; h: number }, p: Pad): boolean => p[0] >= 0 && p[0] < b.w && p[1] >= 0 && p[1] < b.h;

/** One clockwise quarter turn on a y-down screen is (x, y) → (−y, x). `+ 0` normalises −0. */
export function rotateOffset(off: Pad, rot: Rot, flip: boolean): Pad {
  let x = flip ? -off[0] : off[0], y = off[1];
  for (let i = 0; i < rot; i++) { const nx = -y; y = x; x = nx; }
  return [x + 0, y + 0];
}

/** Every pad on the orthogonal segment a→b, inclusive (empty for a diagonal). */
export function segmentPads(a: Pad, b: Pad): Pad[] {
  if (a[0] !== b[0] && a[1] !== b[1]) return [];
  const out: Pad[] = [];
  const dx = Math.sign(b[0] - a[0]), dy = Math.sign(b[1] - a[1]);
  let x = a[0], y = a[1];
  out.push([x, y]);
  while (x !== b[0] || y !== b[1]) { x += dx; y += dy; out.push([x, y]); }
  return out;
}
