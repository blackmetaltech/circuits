/**
 * Gate A microbenchmark: flat-array dense LU, DC Newton, TRAP transients, bridge-rectifier live frames.
 *
 * Run (desktop):  pnpm bench:lu        (= node --experimental-strip-types scripts/bench-lu.ts)
 * Android spike:  import { runBench } from './bench-lu.ts' and call it inside the engine sidecar (returns plain JSON).
 * Uses only `performance.now()` (falls back to Date.now()) and relative `.ts` imports, so it runs unbundled on Node >= 22.6
 * and bundles with vite for nodejs-mobile.
 */
import { luWork, luFactor, luSolve } from '../src/sim/mna/lu.ts';
import { diode3, rcLadder, bridge, dcSolve, trapStep, liveFrame } from './bench/mna-fixture.ts';

export interface Stat { median: number; p95: number; min: number; samples: number }
export interface BenchReport {
  node: string;
  lu: Record<string, Stat & { unit: string }>;
  dcNewton3Diodes: Stat & { unit: string; iterations: number };
  rcLadder24: { steps: number; n: number; totalMs: Stat; stepsPerSec: number };
  bridge: { steps: number; n: number; totalMs: Stat; stepsPerSec: number; meanNewtonIters: number; vOutFinal: number };
  liveFrame: Record<string, Stat & { k: number; unit: string; meanNewtonIters: number }>;
}

const now = (): number => (typeof performance !== 'undefined' ? performance.now() : Date.now());
function stat(xs: number[]): Stat {
  const s = xs.slice().sort((a, b) => a - b);
  const q = (p: number): number => s[Math.min(s.length - 1, Math.floor(p * s.length))]!;
  return { median: s.length % 2 ? s[s.length >> 1]! : (s[(s.length >> 1) - 1]! + s[s.length >> 1]!) / 2, p95: q(0.95), min: s[0]!, samples: s.length };
}
const r3 = (x: number): number => Math.round(x * 1000) / 1000;
const round = (s: Stat): Stat => ({ median: r3(s.median), p95: r3(s.p95), min: r3(s.min), samples: s.samples });
function sample(fn: () => void, reps: number, warm: number): number[] {
  for (let i = 0; i < warm; i++) fn();
  const out: number[] = [];
  for (let i = 0; i < reps; i++) { const t0 = now(); fn(); out.push(now() - t0); }
  return out;
}

function luMatrix(n: number): { A: Float64Array; b: Float64Array } {
  let s = 12345;
  const rnd = (): number => { s = (Math.imul(s, 1664525) + 1013904223) >>> 0; return s / 4294967296 - 0.5; };
  const A = new Float64Array(n * n), b = new Float64Array(n);
  for (let i = 0; i < n * n; i++) A[i] = rnd();
  for (let i = 0; i < n; i++) { A[i * n + i] += n * 0.3 * (i % 2 ? 1 : -1); b[i] = rnd(); }
  return { A, b };
}

export function runBench(): BenchReport {
  const rep: BenchReport = {
    node: typeof process !== 'undefined' ? process.version : 'unknown',
    lu: {}, dcNewton3Diodes: null as never, rcLadder24: null as never, bridge: null as never, liveFrame: {},
  };

  // 1. dense LU factor + solve (one op = refactor from A + solve), batch of ops per sample for timer resolution
  for (const n of [8, 16, 24, 32, 48, 64]) {
    const { A, b } = luMatrix(n); const w = luWork(n); const x = new Float64Array(n);
    const batch = Math.max(20, Math.floor(2e6 / (n * n * n)));
    const ms = sample(() => { for (let i = 0; i < batch; i++) { luFactor(w, A); luSolve(w, b, x); } }, 40, 20).map((t) => t / batch);
    rep.lu[`n${n}`] = { ...round2(stat(ms)), unit: 'ms per factor+solve' };
  }

  // 2. DC Newton, 3 diodes
  {
    const e = diode3(); let iters = 0; const batch = 500;
    const ms = sample(() => { for (let i = 0; i < batch; i++) iters = dcSolve(e); }, 40, 10).map((t) => t / batch);
    rep.dcNewton3Diodes = { ...round2(stat(ms)), unit: 'ms per DC solve', iterations: iters };
  }

  // 3. RC ladder, n = 24, 25 000 TRAP steps (factor once)
  {
    const steps = 25000;
    const run = (): number => { const e = rcLadder(24); dcSolve(e); for (let i = 0; i < steps; i++) trapStep(e); return e.x[e.c.nodes - 1]!; };
    const tot = sample(() => { run(); }, 7, 2);
    rep.rcLadder24 = { steps, n: 24, totalMs: round(stat(tot)), stepsPerSec: Math.round(steps / (stat(tot).median / 1000)) };
  }

  // 4. Bridge rectifier, 25 000 TRAP steps, Newton refactoring every iteration
  {
    const steps = 25000; let iters = 0, vo = 0, n = 0;
    const run = (): void => {
      const b = bridge(); n = b.e.n; iters = 0;
      for (let i = 0; i < steps; i++) { const it = trapStep(b.e); iters += it; if (it < 0) throw new Error('bridge: Newton failed'); }
      vo = b.e.x[b.outp]!;
    };
    const tot = sample(run, 7, 2);
    rep.bridge = { steps, n, totalMs: round(stat(tot)), stepsPerSec: Math.round(steps / (stat(tot).median / 1000)), meanNewtonIters: r3(iters / steps), vOutFinal: r3(vo) };
  }

  // 5. Live frames: k = 333 (one 1/30 s frame at dt = 0.1 ms) and k = 100
  for (const k of [333, 100]) {
    const s = bridge(); for (let i = 0; i < 4000; i++) trapStep(s.e); // settle past the start-up transient
    let iters = 0, frames = 0;
    const ms = sample(() => { iters += liveFrame(s, k).iters; frames++; }, 200, 30);
    rep.liveFrame[`k${k}`] = { ...round2(stat(ms)), k, unit: 'ms per frame', meanNewtonIters: r3(iters / (frames * k)) };
  }
  return rep;
}
function round2<T extends Stat>(s: T): T { return { ...s, median: Math.round(s.median * 1e5) / 1e5, p95: Math.round(s.p95 * 1e5) / 1e5, min: Math.round(s.min * 1e5) / 1e5 }; }

// Run when executed directly (not when imported).
if (typeof process !== 'undefined' && process.argv[1] && import.meta.url.endsWith(process.argv[1].split('/').pop()!)) {
  console.log(JSON.stringify(runBench(), null, 2));
}
