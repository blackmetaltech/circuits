import { describe, expect, it } from 'vitest';
import { dmath } from '@core/numerics';
import { E_MANTISSAS, eseries, nearestInSeries, type ESeries } from './eseries';

const SERIES: ESeries[] = ['E3', 'E6', 'E12', 'E24'];
const COUNT: Record<ESeries, number> = { E3: 3, E6: 6, E12: 12, E24: 24 };

describe('IEC 60063 E-series', () => {
  it('has the right mantissa counts and is strictly increasing within [1, 10)', () => {
    for (const s of SERIES) {
      const m = E_MANTISSAS[s];
      expect(m.length).toBe(COUNT[s]);
      expect(m[0]).toBe(1);
      for (let i = 1; i < m.length; i++) expect(m[i]).toBeGreaterThan(m[i - 1]);
      expect(m[m.length - 1]).toBeLessThan(10);
    }
  });

  it('matches the published values (IEC 60063)', () => {
    expect(E_MANTISSAS.E3).toEqual([1.0, 2.2, 4.7]);
    expect(E_MANTISSAS.E6).toEqual([1.0, 1.5, 2.2, 3.3, 4.7, 6.8]);
    expect(E_MANTISSAS.E12).toEqual([1.0, 1.2, 1.5, 1.8, 2.2, 2.7, 3.3, 3.9, 4.7, 5.6, 6.8, 8.2]);
    expect(E_MANTISSAS.E24).toEqual([1.0, 1.1, 1.2, 1.3, 1.5, 1.6, 1.8, 2.0, 2.2, 2.4, 2.7, 3.0, 3.3, 3.6, 3.9, 4.3, 4.7, 5.1, 5.6, 6.2, 6.8, 7.5, 8.2, 9.1]);
  });

  it('is nested: E3 within E6 within E12 within E24', () => {
    for (const [small, big] of [['E3', 'E6'], ['E6', 'E12'], ['E12', 'E24']] as const) {
      for (const m of E_MANTISSAS[small]) expect(E_MANTISSAS[big]).toContain(m);
    }
  });

  it('tracks the 10^(k/N) geometric ideal within 5 %; the classic deviations are the rounded-up 2.7 3.3 3.9 4.7 8.2', () => {
    for (const s of SERIES) {
      const n = COUNT[s];
      E_MANTISSAS[s].forEach((m, k) => {
        const ideal = dmath.exp((k * Math.LN10) / n);
        expect(Math.abs(m / ideal - 1)).toBeLessThan(0.05);
      });
    }
    // Plain 2-s.f. rounding of the ideal gives 2.6 3.2 3.8 4.6 8.3; the standard's E12 keeps 2.7 3.3 3.9 4.7 8.2.
    const naive = E_MANTISSAS.E12.map((_, k) => Math.round(dmath.exp((k * Math.LN10) / 12) * 10) / 10);
    expect(E_MANTISSAS.E12.filter((m, k) => m !== naive[k])).toEqual([2.7, 3.3, 3.9, 4.7, 8.2]);
  });

  it('generates decades with exact decimal values', () => {
    const v = eseries('E12', 10, 1e6);
    expect(v.length).toBe(61); // 5 decades x 12 + 1e6
    expect(v[0]).toBe(10);
    expect(v[v.length - 1]).toBe(1e6);
    expect(v).toContain(4.7e3);
    expect(v).toContain(4.7e-6 * 1e9); // 4700
    expect(eseries('E24', 10, 1e6).length).toBe(121);
    expect(eseries('E6', 1e-6, 4.7e-3)).toContain(4.7e-6);
    expect(eseries('E6', 1, 4700).length).toBe(23); // 3 full decades x 6 + 1000,1500,2200,3300,4700
    for (let i = 1; i < v.length; i++) expect(v[i]).toBeGreaterThan(v[i - 1]);
  });

  it('finds the nearest member', () => {
    expect(nearestInSeries('E12', 4600)).toBe(4700);
    expect(nearestInSeries('E12', 3.9)).toBe(3.9);
    expect(nearestInSeries('E24', 0.0182)).toBe(0.018);
  });
});
