// Tests for the SPICE-reference comparison harness (synthetic data + committed CSV sanity).
import { describe, it, expect } from 'vitest';
import { dmath } from '@core/numerics';
import { readdirSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import {
  parseCsv, column, interp, resample, uniformGrid, unwrapDeg, wrapDeg,
  transientError, acError, type Series,
} from './compare';

const REF_DIR = fileURLToPath(new URL('../../../tests/ref/', import.meta.url));

function lin(n: number, x0: number, x1: number, f: (x: number) => number): Series {
  const x: number[] = [];
  const y: number[] = [];
  for (let i = 0; i < n; i++) {
    const xi = x0 + ((x1 - x0) * i) / (n - 1);
    x.push(xi);
    y.push(f(xi));
  }
  return { x, y };
}

describe('csv parsing', () => {
  it('parses header and numeric rows, skips blanks and # comments', () => {
    const t = 'time_s,v_V\n# comment\n0,1\n\n1e-3,2.5\r\n2e-3,-3\n';
    const c = parseCsv(t);
    expect(c.header).toEqual(['time_s', 'v_V']);
    expect(c.rows).toBe(3);
    expect(column(c, 'v_V')).toEqual([1, 2.5, -3]);
    expect(column(c, 0)).toEqual([0, 1e-3, 2e-3]);
  });
  it('rejects ragged rows and non-numeric cells', () => {
    expect(() => parseCsv('a,b\n1\n')).toThrow();
    expect(() => parseCsv('a,b\n1,x\n')).toThrow();
  });
  it('rejects an unknown column', () => {
    expect(() => column(parseCsv('a,b\n1,2\n'), 'z')).toThrow();
  });
});

describe('resampling', () => {
  it('is exact on linear data (interior, edges, and a different grid)', () => {
    const s = lin(11, 0, 10, (x) => 3 * x - 2);
    for (const q of [0, 0.37, 5, 9.99, 10]) expect(interp(s.x, s.y, q)).toBeCloseTo(3 * q - 2, 12);
    const g = uniformGrid(0, 10, 101);
    const r = resample(s, g);
    for (let i = 0; i < g.length; i++) expect(r[i]).toBeCloseTo(3 * g[i] - 2, 12);
  });
  it('clamps outside the range', () => {
    expect(interp([0, 1], [5, 7], -1)).toBe(5);
    expect(interp([0, 1], [5, 7], 2)).toBe(7);
  });
});

describe('transient error', () => {
  const sine = (n: number, ph = 0) => lin(n, 0, 2e-3, (t) => dmath.sin(2 * Math.PI * 1000 * t + ph));
  it('identical series give 0', () => {
    const a = sine(500);
    expect(transientError(a, a).fraction).toBe(0);
  });
  it('known offset gives offset / range', () => {
    const a = sine(500);
    const b: Series = { x: a.x, y: a.y.map((v) => v + 0.1) };
    const e = transientError(a, b);
    expect(e.range).toBeCloseTo(2, 3);
    expect(e.maxAbs).toBeCloseTo(0.1, 12);
    expect(e.fraction).toBeCloseTo(0.05, 3);
  });
  it('compares series on different grids', () => {
    const a = lin(1001, 0, 1, (x) => 4 * x);
    const b = lin(77, 0, 1, (x) => 4 * x);
    expect(transientError(a, b).fraction).toBeLessThan(1e-12);
  });
  it('periodic alignment recovers a time shift', () => {
    const a = lin(2001, 0, 4e-3, (t) => dmath.sin(2 * Math.PI * 1000 * t));
    const b = lin(2001, 0, 4e-3, (t) => dmath.sin(2 * Math.PI * 1000 * (t - 70e-6)));
    const raw = transientError(a, b);
    expect(raw.fraction).toBeGreaterThan(0.1);
    const al = transientError(a, b, { period: 1e-3 });
    expect(al.fraction).toBeLessThan(2e-3);
    expect(Math.abs((al.shift ?? 0) - 70e-6)).toBeLessThan(2e-6);
  });
  it('window restricts the comparison range', () => {
    const a = lin(101, 0, 1, () => 0);
    const b = lin(101, 0, 1, (x) => (x > 0.5 ? 1 : 0));
    const e = transientError({ x: a.x, y: a.y.map((v, i) => v + (i === 100 ? 1 : 0)) }, b, { window: [0, 0.4] });
    expect(e.maxAbs).toBe(0);
  });
});

describe('ac error', () => {
  const f = [10, 100, 1000, 10000];
  it('identical gives 0 dB, 0 deg', () => {
    const r = { freq: f, magDb: [0, -1, -3, -20], phaseDeg: [0, -10, -45, -80] };
    const e = acError(r, r);
    expect(e.maxDb).toBe(0);
    expect(e.maxDeg).toBe(0);
  });
  it('known offsets', () => {
    const r = { freq: f, magDb: [0, -1, -3, -20], phaseDeg: [0, -10, -45, -80] };
    const t = { freq: f, magDb: r.magDb.map((v) => v + 0.05), phaseDeg: r.phaseDeg.map((v) => v - 0.3) };
    const e = acError(r, t);
    expect(e.maxDb).toBeCloseTo(0.05, 9);
    expect(e.maxDeg).toBeCloseTo(0.3, 9);
  });
  it('phase wrap at +-180 does not create a spurious error', () => {
    // true phase falls through -180: ref reports it wrapped, test reports it continuous.
    const freq = [1, 2, 3, 4, 5];
    const truth = [-100, -150, -190, -230, -260];
    const wrapped = truth.map((p) => wrapDeg(p));
    expect(wrapped[2]).toBeCloseTo(170, 9);
    const e = acError(
      { freq, magDb: freq.map(() => 0), phaseDeg: wrapped },
      { freq, magDb: freq.map(() => 0), phaseDeg: truth },
    );
    expect(e.maxDeg).toBeLessThan(1e-9);
  });
  it('unwrapDeg removes 360 jumps both ways; wrapDeg maps to (-180,180]', () => {
    expect(unwrapDeg([170, -170, -150])).toEqual([170, 190, 210]);
    expect(unwrapDeg([-170, 170, 150])).toEqual([-170, -190, -210]);
    expect(wrapDeg(190)).toBeCloseTo(-170, 12);
    expect(wrapDeg(-180)).toBeCloseTo(180, 12);
    expect(wrapDeg(540)).toBeCloseTo(180, 12);
  });
  it('compares on different frequency grids (log interpolation)', () => {
    const mk = (fs: number[]): { freq: number[]; magDb: number[]; phaseDeg: number[] } => ({
      freq: fs,
      magDb: fs.map((x) => -20 * dmath.log10(x)),
      phaseDeg: fs.map(() => 0),
    });
    const a = mk([10, 100, 1000]);
    const b = mk([10, 31.6227766016838, 100, 316.227766016838, 1000]);
    expect(acError(a, b).maxDb).toBeLessThan(1e-9);
  });
});

describe('committed reference CSVs', () => {
  const files = readdirSync(REF_DIR).filter((n) => n.endsWith('.csv')).sort();
  it('has the 15 decks (plus optional extra tables)', () => {
    const decks = new Set(files.map((n) => n.split('-')[0]));
    for (let i = 1; i <= 15; i++) expect(decks.has(String(i).padStart(2, '0'))).toBe(true);
  });
  for (const name of files) {
    it(`${name} parses, is finite, has <= 2000 rows and a monotonic first column`, () => {
      const c = parseCsv(readFileSync(REF_DIR + name, 'utf8'));
      expect(c.header.length).toBeGreaterThanOrEqual(2);
      expect(c.rows).toBeGreaterThan(2);
      expect(c.rows).toBeLessThanOrEqual(2000);
      for (const col of c.cols) for (const v of col) expect(Number.isFinite(v)).toBe(true);
      if (name.includes('cases')) return; // a table, not a sweep: first column is a case label
      const x = c.cols[0];
      for (let i = 1; i < x.length; i++) expect(x[i]).toBeGreaterThanOrEqual(x[i - 1]);
    });
  }
  const load = (prefix: string) => {
    const n = files.find((f) => f.startsWith(prefix));
    if (!n) throw new Error('missing ' + prefix);
    return parseCsv(readFileSync(REF_DIR + n, 'utf8'));
  };
  it('physics sanity: clipper clamps near +-0.6..0.8 V', () => {
    const v = column(load('01-'), 2);
    expect(Math.max(...v)).toBeGreaterThan(0.55);
    expect(Math.max(...v)).toBeLessThan(0.85);
    expect(Math.min(...v)).toBeLessThan(-0.55);
  });
  it('physics sanity: RLC step matches TR-03 (35.09 % overshoot, ~1.047 ms)', () => {
    const c = load('09-');
    const t = column(c, 0);
    const v = column(c, 2);
    let k = 0;
    for (let i = 1; i < v.length; i++) if (v[i] > v[k]) k = i;
    expect(Math.abs(v[k] - 13.509) / 13.509).toBeLessThan(0.005);
    expect(Math.abs(t[k] - 1.0472e-3) / 1.0472e-3).toBeLessThan(0.005);
  });
  it('4-1 cross-check: mean 12.54/14.20/15.86 V, ripple 0.75-0.77 Vpp (1000 uF), 1.10-1.13 Vpp (680 uF)', () => {
    const c = load('14-cases');
    const get = (v: number, cuf: number, il: number) => {
      for (let i = 0; i < c.rows; i++) {
        if (c.cols[0][i] === v && c.cols[1][i] === cuf && c.cols[2][i] === il) return { mean: c.cols[3][i], rip: c.cols[4][i], max: c.cols[5][i] };
      }
      throw new Error('case missing');
    };
    const want: [number, number][] = [[207, 12.54], [230, 14.2], [253, 15.86]];
    for (const [v, mean] of want) {
      const r = get(v, 1000, 0.1);
      expect(Math.abs(r.mean - mean)).toBeLessThan(0.01);
      expect(r.rip).toBeGreaterThan(0.75 - 0.005);
      expect(r.rip).toBeLessThan(0.77 + 0.005);
      const r2 = get(v, 680, 0.1);
      expect(r2.rip).toBeGreaterThan(1.1 - 0.005);
      expect(r2.rip).toBeLessThan(1.13 + 0.005);
    }
    expect(Math.abs(get(253, 1000, 0).max - 17.4)).toBeLessThan(0.1); // no-load peak: ngspice 17.335 V; DESIGN 4-1 says "17.4 V" (rounded)
  });
  it('physics sanity: Sallen-Key is -3.01 dB / -90 deg at f0 = 1125.4 Hz', () => {
    const c = load('10-');
    const f = column(c, 0);
    const m = column(c, 1);
    const p = column(c, 2);
    const mAt = interp(f.map((x) => dmath.log(x)), m, dmath.log(1125.395));
    const pAt = interp(f.map((x) => dmath.log(x)), unwrapDeg(p), dmath.log(1125.395));
    expect(Math.abs(mAt + 3.0103)).toBeLessThan(0.05);
    expect(Math.abs(pAt + 90)).toBeLessThan(0.5);
  });
});
