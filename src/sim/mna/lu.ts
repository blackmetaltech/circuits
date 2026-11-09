/**
 * Flat-array dense LU with partial (row) pivoting, in place, zero allocation after `luWork`.
 * Matrix is row-major `Float64Array` n*n. P·A = L·U: L (unit lower, multipliers) below the diagonal of `a`, U on/above;
 * `piv[k]` is the row swapped with row k at step k (LAPACK style). Deterministic: only +,-,*,/ and comparisons.
 */

/** Preallocated workspace for one dimension n. */
export interface LuWork { n: number; a: Float64Array; piv: Int32Array; y: Float64Array }

export interface LuFactorResult {
  /** false when some |pivot| < 1e-14 * max|A| (or a non-finite pivot). */
  ok: boolean;
  /** Smallest |pivot| over the columns processed (all columns when ok). */
  minPivot: number;
  maxPivot: number;
  /** First column whose pivot fell under the threshold, or -1. */
  badColumn: number;
}

export function luWork(n: number): LuWork {
  return { n, a: new Float64Array(n * n), piv: new Int32Array(n), y: new Float64Array(n) };
}

const REL_TOL = 1e-14;

/** Copy `A` into `w.a` (if given), then factor in place. Stops at the first bad column (factors are then incomplete). */
export function luFactor(w: LuWork, A?: Float64Array): LuFactorResult {
  const n = w.n, a = w.a, piv = w.piv;
  if (A !== undefined) a.set(A);
  let maxAbs = 0;
  for (let i = 0, m = n * n; i < m; i++) { const v = a[i]! < 0 ? -a[i]! : a[i]!; if (v > maxAbs) maxAbs = v; }
  const tol = REL_TOL * maxAbs;
  let minP = Infinity, maxP = 0, bad = -1;
  for (let k = 0; k < n; k++) {
    let p = k, best = a[k * n + k]!; if (best < 0) best = -best;
    for (let i = k + 1; i < n; i++) {
      let v = a[i * n + k]!; if (v < 0) v = -v;
      if (v > best) { best = v; p = i; }
    }
    piv[k] = p;
    if (best < minP) minP = best;
    if (best > maxP) maxP = best;
    if (!(best >= tol) || best === 0 || best !== best) { bad = k; break; } // also catches NaN and an all-zero matrix
    const kr = k * n;
    if (p !== k) {
      const pr = p * n;
      for (let j = 0; j < n; j++) { const t = a[kr + j]!; a[kr + j] = a[pr + j]!; a[pr + j] = t; }
    }
    const inv = 1 / a[kr + k]!;
    for (let i = k + 1; i < n; i++) {
      const ir = i * n;
      const f = a[ir + k]! * inv;
      a[ir + k] = f;
      if (f !== 0) for (let j = k + 1; j < n; j++) a[ir + j] = a[ir + j]! - f * a[kr + j]!;
    }
  }
  return { ok: bad < 0, minPivot: minP === Infinity ? 0 : minP, maxPivot: maxP, badColumn: bad };
}

/** Refactor-in-place entry point: same as `luFactor(w, A)`. */
export function luRefactor(w: LuWork, A: Float64Array): LuFactorResult {
  return luFactor(w, A);
}

/** Solve A x = b with the factors in `w`. `b` and `x` may be the same array. Only valid after an `ok` factor. */
export function luSolve(w: LuWork, b: Float64Array, x: Float64Array): void {
  const n = w.n, a = w.a, piv = w.piv, y = w.y;
  for (let i = 0; i < n; i++) y[i] = b[i]!;
  for (let k = 0; k < n; k++) {
    const p = piv[k]!;
    if (p !== k) { const t = y[k]!; y[k] = y[p]!; y[p] = t; }
  }
  for (let i = 1; i < n; i++) {
    const ir = i * n;
    let s = y[i]!;
    for (let j = 0; j < i; j++) s -= a[ir + j]! * y[j]!;
    y[i] = s;
  }
  for (let i = n - 1; i >= 0; i--) {
    const ir = i * n;
    let s = y[i]!;
    for (let j = i + 1; j < n; j++) s -= a[ir + j]! * y[j]!;
    y[i] = s / a[ir + i]!;
  }
  for (let i = 0; i < n; i++) x[i] = y[i]!;
}
