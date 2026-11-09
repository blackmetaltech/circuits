import { describe, expect, it } from 'vitest';
import { Rng, seedState } from '@core/kit';
import { solve } from '@core/numerics';
import { luFactor, luSolve, luWork } from './lu';

function randomMatrix(rng: Rng, n: number, kind: number): Float64Array {
  const A = new Float64Array(n * n);
  for (let i = 0; i < n * n; i++) A[i] = rng.range(-1, 1);
  if (kind === 0) {
    // random with a mild diagonal shift: conditioning stays modest, pivoting is still exercised
    for (let i = 0; i < n; i++) A[i * n + i] = A[i * n + i]! + (rng.chance(0.5) ? 1 : -1) * Math.sqrt(n) * rng.range(0.5, 1.5);
  } else if (kind === 1) {
    // diagonal dominance
    for (let i = 0; i < n; i++) {
      let s = 0;
      for (let j = 0; j < n; j++) if (j !== i) s += Math.abs(A[i * n + j]!);
      A[i * n + i] = (rng.chance(0.5) ? 1 : -1) * (s + rng.range(0.5, 2));
    }
  } else if (kind === 2) {
    // MNA-like: [G B; C 0], G diagonally dominant nodal block, m voltage-source branch rows with zero diagonal
    const m = Math.max(1, Math.min(n - 1, rng.int(1, Math.max(1, n >> 2))));
    const nn = n - m;
    A.fill(0);
    for (let i = 0; i < nn; i++) {
      let s = 0;
      for (let j = 0; j < nn; j++) {
        if (j !== i && rng.chance(0.3)) { const g = -rng.range(1e-3, 1); A[i * n + j] = g; s -= g; }
      }
      A[i * n + i] = s + rng.range(1e-2, 1);
    }
    // each branch row k ties distinct nodes: B col with +1, C row with +1 (symmetric stamp), distinct nodes -> independent
    const nodes = rng.shuffle(Array.from({ length: nn }, (_, i) => i));
    for (let k = 0; k < m; k++) {
      const p = nodes[k % nn]!;
      A[p * n + nn + k] = 1; A[(nn + k) * n + p] = 1;
    }
  }
  return A;
}

describe('flat LU properties (vs core solve)', () => {
  it('2000 seeded random matrices, n in 2..128', () => {
    const rng = new Rng(seedState(20260101));
    const works = new Map<number, ReturnType<typeof luWork>>();
    let worstRel = 0, worstRes = 0, skipped = 0;
    for (let t = 0; t < 2000; t++) {
      // bias toward small n so total time is bounded
      const n = rng.chance(0.03) ? rng.int(100, 128) : rng.chance(0.3) ? rng.int(33, 99) : rng.int(2, 32);
      const kind = t % 3;
      const A = randomMatrix(rng, n, kind);
      const b = new Float64Array(n);
      for (let i = 0; i < n; i++) b[i] = rng.range(-10, 10);
      const rows: number[][] = [];
      for (let i = 0; i < n; i++) rows.push(Array.from(A.subarray(i * n, i * n + n)));
      let xc: number[];
      try { xc = solve(rows, Array.from(b)); } catch { skipped++; continue; } // core says singular: skip (bounded below)
      let w = works.get(n);
      if (!w) { w = luWork(n); works.set(n, w); }
      const r = luFactor(w, A);
      expect(r.ok, `t=${t} n=${n} kind=${kind}`).toBe(true);
      const x = new Float64Array(n);
      luSolve(w, b, x);
      let dx = 0, xm = 0, an = 0, xn = 0, res = 0;
      for (let i = 0; i < n; i++) { dx = Math.max(dx, Math.abs(x[i]! - xc[i]!)); xm = Math.max(xm, Math.abs(xc[i]!)); xn = Math.max(xn, Math.abs(x[i]!)); }
      for (let i = 0; i < n; i++) {
        let rs = 0, s = 0;
        for (let j = 0; j < n; j++) { rs += Math.abs(A[i * n + j]!); s += A[i * n + j]! * x[j]!; }
        an = Math.max(an, rs); res = Math.max(res, Math.abs(s - b[i]!));
      }
      const rel = dx / xm;
      worstRel = Math.max(worstRel, rel);
      expect(rel, `t=${t} n=${n} kind=${kind}`).toBeLessThanOrEqual(1e-12);
      expect(res, `res t=${t} n=${n} kind=${kind}`).toBeLessThanOrEqual(1e-12 * an * xn);
      worstRes = Math.max(worstRes, res / (an * xn));
    }
    expect(skipped).toBeLessThanOrEqual(5);
    expect(worstRel).toBeLessThanOrEqual(1e-12);
    expect(worstRes).toBeLessThanOrEqual(1e-12);
  });
});
