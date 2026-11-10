// Signal metrics on synthetic (t, y) data (DESIGN §3.12 `metric`): known answers, no circuit needed.
import { describe, expect, it } from 'vitest';
import { dmath } from '@core/numerics';
import { crossings, measure, type Signal } from './measure';

const TWO_PI = 2 * Math.PI;
const make = (n: number, T: number, f: (t: number) => number, span = T): Signal => {
  const t: number[] = [], y: number[] = [];
  for (let k = 0; k <= n; k++) { const tt = (span * k) / n; t.push(tt); y.push(f(tt)); }
  return { t, y };
};
/** Square wave ±1 of period T, evaluated exactly at sample times (no edges inside). */
const sq = (tt: number, T: number): number => (((tt / T) % 1) + 1) % 1 < 0.5 ? 1 : -1;

describe('basic window metrics', () => {
  const T = 1e-3, sig = make(40000, T, (t) => 2 + 3 * dmath.sin((TWO_PI * t) / T), 4 * T);
  it('mean / rms / vpp / peak of a sine over 4 periods', () => {
    expect(measure('mean', sig)).toBeCloseTo(2, 4);
    expect(measure('rms', sig)).toBeCloseTo(Math.sqrt(4 + 4.5), 4);
    expect(measure('vpp', sig)).toBeCloseTo(6, 3);
    expect(measure('max', sig)).toBeCloseTo(5, 3);
    expect(measure('min', sig)).toBeCloseTo(-1, 3);
    expect(measure('peak', sig)).toBeCloseTo(5, 3);
  });
  it('freq from interpolated zero crossings', () => {
    const s = make(8000, T, (t) => dmath.sin((TWO_PI * 1234 * t) / 1), 0.01);
    expect(Math.abs(measure('freq', s) / 1234 - 1)).toBeLessThan(1e-5);
  });
  it('duty of a 25 % pulse', () => {
    const s = make(40000, T, (t) => (((t / T) % 1) < 0.25 ? 1 : 0), 4 * T);
    expect(measure('duty', s)).toBeCloseTo(0.25, 3);
  });
});

describe('crossing count with hysteresis', () => {
  const y = [-1, -1, -0.1, 0.1, -0.1, 0.1, 1, 1, 0.1, -0.1, 0.1, -0.1, -1];
  const s: Signal = { t: y.map((_, k) => k), y };
  it('no hysteresis counts every chatter', () => {
    expect(measure('crossingCount', s, { level: 0, hyst: 0, edge: 'rising' })).toBe(3);
    expect(measure('crossingCount', s, { level: 0, hyst: 0, edge: 'falling' })).toBe(3);
    expect(measure('crossingCount', s, { level: 0, hyst: 0, edge: 'both' })).toBe(6);
  });
  it('a 0.5 hysteresis band sees one clean up and one clean down', () => {
    expect(measure('crossingCount', s, { level: 0, hyst: 0.5, edge: 'rising' })).toBe(1);
    expect(measure('crossingCount', s, { level: 0, hyst: 0.5, edge: 'falling' })).toBe(1);
  });
  it('crossing times are interpolated at the level', () => {
    const c = crossings({ t: [0, 1, 2], y: [-1, 1, 3] }, 0, 0);
    expect(c).toEqual([{ t: 0.5, rising: true }]);
    expect(measure('crossingTime', { t: [10, 11, 12], y: [-1, 1, 3] }, { level: 1 })).toBeCloseTo(1, 12);
  });
});

describe('THD by DFT over a known number of periods', () => {
  const T = 1e-3, N = 4;
  const oddSum = (H: number): number => { let s = 0; for (let k = 3; k <= H; k += 2) s += 1 / (k * k); return 100 * Math.sqrt(s); };
  it('square wave: 48.3 % in the limit, finite sum over odd harmonics up to H', () => {
    const s = make(N * 8192, T, (t) => sq(t + 1e-12, T), N * T);
    const thd99 = measure('thd', s, { harmonics: 99 }, { periods: N });
    expect(Math.abs(thd99 / oddSum(99) - 1)).toBeLessThan(0.01);
    expect(thd99).toBeGreaterThan(47.5); expect(thd99).toBeLessThan(48.4);
    expect(Math.abs(oddSum(1999) - 48.3)).toBeLessThan(0.1);   // the 48.3 % of the Fourier series (sqrt(pi^2/8 - 1) = 48.34 %)
  });
  it('pure sine: ~0', () => {
    const s = make(N * 4096, T, (t) => dmath.sin((TWO_PI * t) / T), N * T);
    expect(measure('thd', s, { harmonics: 10 }, { periods: N })).toBeLessThan(0.01);
  });
  it('sine with a 10 % third harmonic: 10 %, and the harmonic ratio is -20 dB', () => {
    const s = make(N * 4096, T, (t) => dmath.sin((TWO_PI * t) / T) + 0.1 * dmath.sin((3 * TWO_PI * t) / T), N * T);
    expect(measure('thd', s, { harmonics: 10 }, { periods: N })).toBeCloseTo(10, 1);
    expect(measure('harmonic', s, { k: 3 }, { periods: N })).toBeCloseTo(-20, 1);
  });
});

describe('step response metrics', () => {
  const tau = 1e-3, s = make(20000, tau, (t) => 1 - dmath.exp(-t / tau), 12 * tau);
  it('10-90 % rise time = tau ln 9', () => {
    expect(Math.abs(measure('riseTime', s) / (tau * dmath.log(9)) - 1)).toBeLessThan(0.01);
  });
  it('overshoot of a monotone step is ~0; of an overshooting ring it is positive', () => {
    expect(measure('overshoot', s)).toBeLessThan(0.1);
    const ring = make(20000, tau, (t) => 1 - dmath.exp(-t / tau) * dmath.cos((TWO_PI * t) / tau), 12 * tau);
    expect(measure('overshoot', ring)).toBeGreaterThan(5);
  });
  it('settling time to 2 %: tau ln 50', () => {
    expect(Math.abs(measure('settlingTime', s, { tol: 0.02 }) / (tau * dmath.log(50)) - 1)).toBeLessThan(0.02);
  });
});
