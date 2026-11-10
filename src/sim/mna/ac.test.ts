// AC analysis: sweep helper, AC-vs-transient cross-check (DESIGN §3.6, §9.3) and passivity.
import { describe, expect, it } from 'vitest';
import { dmath } from '@core/numerics';
import { acCards, acNetlist, mag, nearDeg, phaseDeg } from '../oracles/acUtil';
import { tranNetlist, interp } from '../oracles/tranUtil';
import { parseNetlist } from './netlist';
import { bode, logFreqs } from './ac';
import { sine } from './waveforms';

describe('logFreqs / bode', () => {
  it('log grid: 20 points per decade, endpoints included, ascending', () => {
    const f = logFreqs(10, 1e4, 20);
    expect(f.length).toBe(3 * 20 + 1); expect(f[0]).toBeCloseTo(10, 9); expect(f[f.length - 1]).toBeCloseTo(1e4, 6);
    for (let k = 1; k < f.length; k++) expect(f[k]).toBeGreaterThan(f[k - 1]);
    expect(f[20] / 10).toBeCloseTo(10, 6);
  });
  it('RC low-pass sweep gives dB / degrees (−3.01 dB, −45° at fc; phase unwrapped monotone)', () => {
    const ac = acCards('V1 in 0 0 ac 1\nR1 in out 1k\nC1 out 0 1u');
    const fc = 1 / (2 * Math.PI * 1e-3);
    const r = bode(ac, 'out', 'in', logFreqs(1, 1e5, 20));
    const k = r.f.findIndex((f) => f >= fc * 0.999);
    expect(Math.abs(r.magDb[k] - 20 * dmath.log10(1 / Math.sqrt(1 + (r.f[k] / fc) ** 2)))).toBeLessThan(1e-6);
    expect(r.magDb[0]).toBeGreaterThan(-0.01); expect(r.phaseDeg[r.f.length - 1]).toBeLessThan(-89);
    for (let j = 1; j < r.f.length; j++) expect(r.phaseDeg[j]).toBeLessThanOrEqual(r.phaseDeg[j - 1] + 1e-9);
  });
});

/** Steady-state amplitude and phase (re: sin ωt) of a transient probe over the last `cycles` periods, by sin/cos projection. */
function fit(t: number[], y: number[], f: number, tEnd: number, cycles: number): { amp: number; phase: number } {
  const T = 1 / f, n = 4000, t0 = tEnd - cycles * T; let a = 0, b = 0;
  for (let k = 0; k < n; k++) {
    const tt = t0 + (k + 0.5) * (cycles * T) / n, v = interp(t, y, tt), w = 2 * Math.PI * f * tt;
    a += v * dmath.sin(w); b += v * dmath.cos(w);
  }
  a *= 2 / n; b *= 2 / n;
  return { amp: Math.sqrt(a * a + b * b), phase: dmath.atan2(b, a) * 180 / Math.PI };
}

describe('AC vs transient steady state (within 1 %, phase 0.3°)', () => {
  const cases: [string, string, number, string][] = [
    ['RC low-pass at fc', 'V1 in 0 0 ac 1\nR1 in out 1k\nC1 out 0 1u', 159.155, 'out'],
    ['RC low-pass at 5 fc', 'V1 in 0 0 ac 1\nR1 in out 1k\nC1 out 0 1u', 795.775, 'out'],
    ['series RLC band-pass below f0', 'V1 in 0 0 ac 1\nL1 in a 10m\nC1 a out 1u\nR1 out 0 50', 1200, 'out'],
    ['series RLC band-pass near f0', 'V1 in 0 0 ac 1\nL1 in a 10m\nC1 a out 1u\nR1 out 0 50', 1591.5, 'out'],
  ];
  for (const [name, cards, f, probe] of cases) {
    it(name, () => {
      const nl = parseNetlist(cards);
      nl.elements.find((e) => e.id === 'V1')!.wave = sine(1, f);
      const h = acNetlist(nl).solve(f).v(probe);
      const T = 1 / f, tStop = 60 * T;
      const s = tranNetlist(nl, { h: T / 400, tStop, probes: [`v(${probe})`] });
      const m = fit(s.t, s.y(`v(${probe})`), f, tStop, 4);
      expect(Math.abs(m.amp / mag(h) - 1)).toBeLessThan(0.01);
      nearDeg(m.phase, phaseDeg(h), 0.3);
    });
  }
});

describe('passivity: input impedance of passive RLC networks has Re(Z) ≥ 0', () => {
  it('30 pseudo-random R/L/C networks over 1 Hz … 10 MHz', () => {
    let seed = 12345;
    const rnd = (): number => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 4294967296; };
    const pick = (lo: number, hi: number): number => lo * dmath.pow(hi / lo, rnd());
    for (let net = 0; net < 30; net++) {
      const lines = ['I1 0 n1 0 ac 1'];
      const nn = 3 + Math.floor(rnd() * 3);
      let id = 0;
      const add = (a: string, b: string): void => {
        const r = rnd(), k = id++;
        if (r < 0.4) lines.push(`R${k} ${a} ${b} ${pick(1, 1e5)}`);
        else if (r < 0.7) lines.push(`C${k} ${a} ${b} ${pick(1e-10, 1e-5)}`);
        else lines.push(`L${k} ${a} ${b} ${pick(1e-6, 1)}`);
      };
      for (let k = 1; k <= nn; k++) lines.push(`Rg${k} n${k} ${k === 1 ? '0' : 'n' + (k - 1)} ${pick(10, 1e5)}`);
      for (let k = 0; k < 4 + nn; k++) { const a = 1 + Math.floor(rnd() * nn), b = Math.floor(rnd() * (nn + 1)); if (a !== b) add('n' + a, b === 0 ? '0' : 'n' + b); }
      const ac = acCards(lines.join('\n'));
      for (const f of [1, 17, 300, 4e3, 6e4, 1e6, 1e7]) {
        const z = ac.solve(f).v('n1');          // 1 A in: V = Z
        expect(z.re, `net ${net} f ${f}`).toBeGreaterThanOrEqual(-1e-9 * mag(z));
      }
    }
  });
});

describe('nonlinear device linearised at the OP', () => {
  it('diode biased through 1 kΩ: small-signal divider uses rd = nVt/Id', () => {
    const ac = acCards('V1 in 0 5 ac 1\nR1 in d 1k\nD1 d 0 dm\n.model dm D(is=1e-14 n=1)');
    const vd = ac.op[1], id = (5 - vd) / 1e3, rd = 0.025852 / id;
    const h = mag(ac.solve(100).v('d'));
    expect(Math.abs(h / (rd / (rd + 1e3)) - 1)).toBeLessThan(0.01);
  });
});
