// Thin linear-solve adapter over the flat in-place LU (./lu.ts: luWork / luFactor / luSolve). Swap the engine here only.
import { luFactor, luSolve, luWork, type LuFactorResult } from './lu';

export type FactorResult = LuFactorResult;
export interface LinearSolver {
  readonly dim: number;
  /** Factor the row-major dim×dim matrix (A is not modified). */
  factor(A: Float64Array): FactorResult;
  /** Solve with the last successful factorisation: x ← A⁻¹ b. */
  solve(b: Float64Array, x: Float64Array): void;
}

export function makeSolver(dim: number): LinearSolver {
  const w = luWork(dim);
  return { dim, factor: (A) => luFactor(w, A), solve: (b, x) => luSolve(w, b, x) };
}
