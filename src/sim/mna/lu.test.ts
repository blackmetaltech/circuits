import { describe, expect, it } from 'vitest';
import { luFactor, luRefactor, luSolve, luWork } from './lu';

const flat = (rows: number[][]): Float64Array => Float64Array.from(rows.flat());

describe('flat LU', () => {
  it('solves a known 3x3 system', () => {
    const w = luWork(3);
    const r = luFactor(w, flat([[2, 1, -1], [-3, -1, 2], [-2, 1, 2]]));
    expect(r.ok).toBe(true);
    const x = new Float64Array(3);
    luSolve(w, Float64Array.from([8, -11, -3]), x);
    expect(x[0]).toBeCloseTo(2, 12); expect(x[1]).toBeCloseTo(3, 12); expect(x[2]).toBeCloseTo(-1, 12);
  });
  it('handles 1x1', () => {
    const w = luWork(1);
    expect(luFactor(w, Float64Array.from([4])).ok).toBe(true);
    const x = new Float64Array(1);
    luSolve(w, Float64Array.from([2]), x);
    expect(x[0]).toBe(0.5);
    expect(luFactor(w, Float64Array.from([0])).ok).toBe(false);
  });
  it('detects singularity with the right badColumn', () => {
    const w = luWork(3);
    const r = luFactor(w, flat([[1, 2, 3], [2, 4, 5], [1, 2, 0]]));
    expect(r.ok).toBe(false);
    expect(r.badColumn).toBe(1);
    const z = luFactor(w, flat([[1, 0, 0], [0, 1, 0], [0, 0, 0]]));
    expect(z.ok).toBe(false); expect(z.badColumn).toBe(2);
    expect(luFactor(w, flat([[1, 0, 0], [0, 1, 0], [0, 0, 1]])).badColumn).toBe(-1);
  });
  it('reports min/max pivot', () => {
    const w = luWork(2);
    const r = luFactor(w, flat([[4, 0], [0, 0.5]]));
    expect(r.maxPivot).toBe(4); expect(r.minPivot).toBe(0.5);
  });
  it('permutation-heavy: anti-diagonal and zero diagonal', () => {
    const n = 6;
    const A = new Float64Array(n * n);
    for (let i = 0; i < n; i++) A[i * n + (n - 1 - i)] = i + 1;
    const w = luWork(n);
    expect(luFactor(w, A).ok).toBe(true);
    const b = Float64Array.from([1, 2, 3, 4, 5, 6]);
    const x = new Float64Array(n);
    luSolve(w, b, x);
    for (let i = 0; i < n; i++) expect(x[n - 1 - i]).toBeCloseTo(b[i]! / (i + 1), 14);
  });
  it('MNA voltage-source row with zero diagonal', () => {
    // 1V source, 1k resistor to ground: unknowns [v1, i]; G v1 + i = 0; v1 = 1
    const w = luWork(2);
    luFactor(w, flat([[1e-3, 1], [1, 0]]));
    const x = new Float64Array(2);
    luSolve(w, Float64Array.from([0, 1]), x);
    expect(x[0]).toBeCloseTo(1, 14); expect(x[1]).toBeCloseTo(-1e-3, 16);
  });
  it('many RHS with one factor, and b aliasing x', () => {
    const w = luWork(3);
    const A = flat([[4, 1, 0], [1, 3, 1], [0, 1, 2]]);
    luFactor(w, A);
    for (let k = 0; k < 20; k++) {
      const xt = [k, 1 - k, 2 * k + 1];
      const b = new Float64Array(3);
      for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) b[i] += A[i * 3 + j]! * xt[j]!;
      luSolve(w, b, b);
      for (let i = 0; i < 3; i++) expect(b[i]).toBeCloseTo(xt[i]!, 12);
    }
  });
  it('factors in place without A and does not modify caller A', () => {
    const A = flat([[0, 1], [1, 0]]);
    const copy = A.slice();
    const w = luWork(2);
    luRefactor(w, A);
    expect(Array.from(A)).toEqual(Array.from(copy));
    w.a.set(flat([[2, 0], [0, 4]]));
    expect(luFactor(w).ok).toBe(true);
    const x = new Float64Array(2);
    luSolve(w, Float64Array.from([2, 4]), x);
    expect(Array.from(x)).toEqual([1, 1]);
  });

  it('row-scaled pivot test: a gmin-sized floating row beside 1e9-sized rows is not singular, an exactly dependent row still is', () => {
    const w = luWork(3);
    expect(luFactor(w, flat([[1e9, 0, 0], [0, 3e-12, -1e-12], [0, -1e-12, 2e-12]])).ok).toBe(true);
    expect(luFactor(w, flat([[1e9, 0, 0], [0, 1e-12, 1e-12], [0, 1e-12, 1e-12]])).ok).toBe(false);
  });
});
