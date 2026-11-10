// The Minkowski tube (DESIGN §3.12 `band`): square edges, sine, exp / reference targets, phase-free alignment.
import { describe, expect, it } from 'vitest';
import { dmath } from '@core/numerics';
import { checkBand } from './band';
import { sine, square } from '../mna/waveforms';
import type { Signal } from './measure';

const T = 1e-3;
const clamp01 = (x: number): number => Math.min(1, Math.max(0, x));
/** Square 0..1 (rising edges at k·T + shift, falling at k·T + T/2 + shift) with linear edges `ramp` s wide centred on the edge times. */
const slowSquare = (n: number, span: number, ramp: number, shift = 0, scale = 1): Signal => {
  const t: number[] = [], y: number[] = [];
  for (let k = 0; k <= n; k++) {
    const tt = (span * k) / n, u = ((((tt - shift) / T) % 1) + 1) % 1 * T;
    const v = u < T / 4 || u >= (3 * T) / 4 ? clamp01(0.5 + (u < T / 2 ? u : u - T) / ramp) : clamp01(0.5 - (u - T / 2) / ramp);
    t.push(tt); y.push(v * scale);
  }
  return { t, y };
};

describe('band tube', () => {
  const target = { k: 'wave', wave: square(0, 1, T, 0.5, 1e-9) } as const;
  it('square with 80 us edges: tube passes at dt 45 us, a too-tight dt fails (value-only band cannot work on edges)', () => {
    const s = slowSquare(60000, 3 * T, 80e-6);
    expect(checkBand(s, target, { dv: 0.03, dt: 45e-6 }).ok).toBe(true);
    const tight = checkBand(s, target, { dv: 0.03, dt: 10e-6 });
    expect(tight.ok).toBe(false);
    expect(tight.worst).toBeGreaterThan(0.1);
    expect(tight.bad.length).toBeGreaterThan(0);
  });
  it('wrong plateau amplitude fails even with a wide dt', () => {
    expect(checkBand(slowSquare(60000, 3 * T, 80e-6, 0, 1.2), target, { dv: 0.03, dt: 45e-6 }).ok).toBe(false);
  });
  it('sine tube: amplitude error inside dv passes, time shift inside dt passes, outside fails', () => {
    const tg = { k: 'wave', wave: sine(1, 1000) } as const;
    const mk = (amp: number, d0: number): Signal => { const t: number[] = [], y: number[] = []; for (let k = 0; k <= 4000; k++) { const tt = T + (2 * T * k) / 4000; t.push(tt); y.push(amp * dmath.sin(2 * Math.PI * 1000 * (tt - d0))); } return { t, y }; };
    expect(checkBand(mk(1.02, 0), tg, { dv: 0.03, dt: 1e-6 }).ok).toBe(true);
    expect(checkBand(mk(1.0, 20e-6), tg, { dv: 0.01, dt: 25e-6 }).ok).toBe(true);
    expect(checkBand(mk(1.0, 20e-6), tg, { dv: 0.01, dt: 5e-6 }).ok).toBe(false);
  });
  it('exp and reference-trace targets', () => {
    const tau = 1e-3, t: number[] = [], y: number[] = [];
    for (let k = 0; k <= 2000; k++) { const tt = (5 * tau * k) / 2000; t.push(tt); y.push(1 - dmath.exp(-tt / tau)); }
    expect(checkBand({ t, y }, { k: 'exp', v0: 0, vInf: 1, tau }, { dv: 1e-6, dt: 0 }).ok).toBe(true);
    expect(checkBand({ t, y }, { k: 'ref', t, y: y.map((v) => v + 0.01) }, { dv: 0.02, dt: 0 }).ok).toBe(true);
    expect(checkBand({ t, y }, { k: 'ref', t, y: y.map((v) => v + 0.05) }, { dv: 0.02, dt: 0 }).ok).toBe(false);
  });
  it('phaseFree aligns by trigger; without it a shifted square fails', () => {
    const s = slowSquare(60000, 3 * T, 40e-6, 0.3 * T);
    expect(checkBand(s, target, { dv: 0.05, dt: 50e-6 }).ok).toBe(false);
    const r = checkBand(s, target, { dv: 0.05, dt: 50e-6, phaseFree: true, period: T });
    expect(r.ok).toBe(true);
    expect(Math.abs(r.shift - 0.3 * T)).toBeLessThan(0.06 * T);
  });
});
