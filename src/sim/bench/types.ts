// Bench spec vocabulary (DESIGN §3.12, §8.3). Plain JSON: it lives in level files and solution codes.
import type { Target } from './band';
import type { MeasureParams, MetricName } from './measure';

export type { Target, MeasureParams, MetricName };

export interface MaskRegion {
  f1: number; f2: number; lo: number; hi: number;
  /** 'mag' (dB, default) or 'phase' (degrees). */
  quantity?: 'mag' | 'phase';
  /** mag only: subtract the gain at this frequency (Hz) first ("-3 dB relative to the 20 Hz gain"). */
  relativeTo?: number;
}
export interface Measure { probe: string; metric: MetricName; params?: MeasureParams }

export type SafetyRule =
  /** A resistor of at most `maxOhm` between nodes a and b (bleeder present). */
  | { rule: 'resistorAcross'; a: string; b: string; maxOhm: number }
  /** At least one element of `kind` exists and every one has param `key` within [min, max] (capacitor class, fuse rating...). */
  | { rule: 'partParam'; kind: string; key: string; min?: number; max?: number };

export type BenchSpec =
  | { kind: 'level'; id: string; probe: string; lo: number; hi: number }
  | { kind: 'band'; id: string; probe: string; target: Target; dv: number; dt: number; phaseFree?: boolean }
  | { kind: 'metric'; id: string; probe: string; metric: MetricName; params?: MeasureParams; lo: number; hi: number }
  | { kind: 'mask'; id: string; out: string; inp: string; regions: MaskRegion[]; perDecade?: number }
  /** Always-on ratings check (§3.8). The verdict comes from `BenchOptions.ratings`; `probes` are recorded for a ratings callback. */
  | { kind: 'rating'; id: string; probes?: string[] }
  | { kind: 'safety'; id: string; rule: SafetyRule }
  /** Exam-bridge prediction: scored against the solver's value, never pass/fail. */
  | { kind: 'predict'; id: string; entered: number; of: Measure; tol1?: number; tol5?: number };

export interface RatingViolation { part: string; what: string; value: number; limit: number }
export interface RatingReport { violations: RatingViolation[]; smoked: string[] }
export interface BenchWindow { t: number[]; series: Record<string, number[]>; t0: number; t1: number }

export interface BenchOptions {
  /** Transient base step, s. */
  h: number;
  /** Fundamental period, s (periodic settle, THD, phase-free bands). */
  period?: number;
  /** Fixed seconds to discard (default 0) or 'periodic'. */
  settle?: number | 'periodic';
  settleProbe?: string;
  /** Periodic: relative RMS cycle-to-cycle difference (default 0.005, DESIGN 0.5 %). */
  settleTol?: number;
  /** Periodic: maximum settling periods (default 50). */
  maxPeriods?: number;
  /** Periods measured after settling (default 1). */
  measurePeriods?: number;
  /** Fixed-settle window length, s (default measurePeriods x period). */
  window?: number;
  ic?: 'zero' | 'op' | Record<string, number>;
  /** Ratings verdict from the power model, or a pure function of the measured window. */
  ratings?: RatingReport | ((w: BenchWindow) => RatingReport);
  /** Condition label copied into every failure's vars (`cond`). */
  condition?: string;
}

export interface BenchFailure { key: string; vars: Record<string, string | number> }
export interface PredictionScore { id: string; entered: number; truth: number; relErr: number; grade: 'exact' | 'close' | 'miss' }
export interface BenchResult {
  pass: boolean;
  /** Per spec id: level/metric value, band worst excess (V), mask worst margin (dB or deg, negative = outside). */
  metrics: Record<string, number>;
  failures: BenchFailure[];
  predictions: PredictionScore[];
  settle: { settled: boolean; periods: number; t0: number; t1: number };
  /** Band failing sample times per band id (scope overlay). */
  badSamples: Record<string, number[]>;
}
