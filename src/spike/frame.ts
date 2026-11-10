// GATE-A SPIKE: delete after Gate A (BUILD-PLAN GA-2)
// Live-frame spike: SPIKE-ONLY module-level circuit state (a deliberate, temporary exception to "queries never mutate"; never used by
// rules, personas or verify). Advances the bridge rectifier by k TRAP steps (dt 0.1 ms) and returns a 512-point window.
import { bridge, liveFrame, trapStep, type Bridge } from './fixture';
import { runBench } from './bench';

let sim: Bridge | null = null; // GATE-A SPIKE: delete after Gate A (BUILD-PLAN GA-2)

export interface SpikeFrame { t: number; out: number[]; inp: number[]; engineMs: number; solveMs: number; serMs: number; gcMs: number }

export function spikeFrame(kIn: unknown): SpikeFrame {
  const k = Math.max(1, Math.min(5000, Math.floor(Number(kIn) || 333)));
  if (!sim) { sim = bridge(0.1e-3); for (let i = 0; i < 4000; i++) trapStep(sim.e); } // settle past the start-up transient (not timed)
  const t0 = performance.now(); // GATE-A SPIKE: wall clock allowed only here (BUILD-PLAN GA-2)
  const f = liveFrame(sim, k);
  const t1 = performance.now();
  const out = Array.from(f.vOut), inp = Array.from(f.vIn);
  const t2 = performance.now();
  return { t: f.t, out, inp, engineMs: t2 - t0, solveMs: t1 - t0, serMs: t2 - t1, gcMs: 0 }; // GATE-A SPIKE
}

export function spikeBench(): unknown { return runBench(); } // GATE-A SPIKE
