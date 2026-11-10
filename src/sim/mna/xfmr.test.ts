// Ideal transformer device (devices/xfmr.ts): polarity dot, reverse drive, winding losses, AC, DC blocking, energy conservation.
import { describe, expect, it } from 'vitest';
import { dmath } from '@core/numerics';
import { solveCards, near } from '../oracles/util';
import { acCards, mag, nearDeg, phaseDeg } from '../oracles/acUtil';
import { tranCards, tranNetlist, integrate } from '../oracles/tranUtil';
import { parseNetlist } from './netlist';
import { sine } from './waveforms';
import { EXPANDERS } from './netlist';
import { partById } from '../../data/parts';

describe('T device: DC', () => {
  it('polarity: the dot on s1 gives +V/n; swapping the secondary leads (or the primary leads) gives -V/n', () => {
    near(solveCards('V1 p 0 10\nT1 p 0 s 0 10\nR1 s 0 100').v('s'), 1, 1e-6);
    near(solveCards('V1 p 0 10\nT1 p 0 0 s 10\nR1 s 0 100').v('s'), -1, 1e-6);
    near(solveCards('V1 p 0 10\nT1 0 p s 0 10\nR1 s 0 100').v('s'), -1, 1e-6);
  });
  it('current ratio: 1 V on 100 Ω draws 10 mA from the secondary and 1 mA from the primary; absorbs no power', () => {
    const s = solveCards('V1 p 0 10\nT1 p 0 s 0 10\nR1 s 0 100');
    near(s.i('R1'), 0.01, 1e-6);
    near(s.i('T1'), 0.001, 1e-6);
    expect(Math.abs(s.p('T1'))).toBeLessThan(1e-9);
  });
  it('reverse driven: 12 V on the secondary appears as 120 V on the primary, load current scales by 1/n', () => {
    const s = solveCards('V1 s 0 12\nT1 p 0 s 0 10\nR1 p 0 1k');
    near(s.v('p'), 120, 1e-6);
    near(s.i('R1'), 0.12, 1e-6);
    near(s.i('T1'), -0.12, 1e-6); // the primary pushes 0.12 A OUT of p1 (passive sign: negative into the winding)
    expect(Math.abs(s.p('T1'))).toBeLessThan(1e-9);
  });
  it('winding resistances: series rp/n² + rs = 2 Ω referred to the secondary, so 1 V open → 0.8 V on 8 Ω', () => {
    near(solveCards('V1 p 0 10\nT1 p 0 s 0 10 rp=100 rs=1\nR1 s 0 8').v('s'), 0.8, 1e-6);
  });
  it('magnetising inductance is a DC short across the winding (primary current set by the series resistor)', () => {
    const s = solveCards('V1 p 0 5\nR0 p a 10\nT1 a 0 s 0 10 lm=1\nR1 s 0 100');
    expect(Math.abs(s.v('a'))).toBeLessThan(1e-9);
    near(s.i('R0'), 0.5, 1e-6);
    expect(Math.abs(s.v('s'))).toBeLessThan(1e-9);
  });
});

describe('T device: AC', () => {
  it('the dot sets the phase (0°); swapped leads give 180°', () => {
    nearDeg(phaseDeg(acCards('V1 in 0 0 ac 1\nT1 in 0 s 0 4\nR1 s 0 10').solve(1e3).v('s')), 0, 1e-6);
    nearDeg(phaseDeg(acCards('V1 in 0 0 ac 1\nT1 in 0 0 s 4\nR1 s 0 10').solve(1e3).v('s')), 180, 1e-6);
  });
  it('Lm acts as a parallel jωLm on the primary: the −3 dB corner is at |ωLm| = reflected load', () => {
    // 1 Ω load on n = 10 reflects to 100 Ω; Rsrc 100 Ω feeds the primary: the secondary voltage x n → 1/2 of the source at HF
    const g = (f: number): number => mag(acCards('V1 src 0 0 ac 1\nR0 src in 100\nT1 in 0 s 0 10 lm=0.1\nR1 s 0 1').solve(f).v('s')) * 10;
    const fc = 50 / (2 * Math.PI * 0.1); // Lm sees Rsrc || reflected load = 50 Ω, so ωLm = 50 Ω at the corner
    near(g(1e6) / 0.5, 1, 1e-4);
    near(g(fc) / g(1e6), Math.SQRT1_2, 1e-4);
  });
});

describe('T device: transient', () => {
  it('ideal ratio tracks a sine instantly and absorbs zero power at every step', () => {
    const nl = parseNetlist('V1 p 0 0\nT1 p 0 s 0 5\nR1 s 0 20');
    nl.elements.find((e) => e.id === 'V1')!.wave = sine(10, 1000);
    const run = tranNetlist(nl, { h: 1e-6, tStop: 2e-3, probes: ['v(p)', 'v(s)', 'p(T1)'] });
    const vp = run.y('v(p)'), vs = run.y('v(s)'), pt = run.y('p(T1)');
    for (let k = 0; k < run.t.length; k++) { expect(Math.abs(vs[k] - vp[k] / 5)).toBeLessThan(1e-9); expect(Math.abs(pt[k])).toBeLessThan(1e-9); }
    expect(Math.max(...vs)).toBeGreaterThan(1.9);
  });
  it('energy conservation: source energy = winding + load losses + final magnetising energy (0.5 %)', () => {
    const f = 50, n = 4, rp = 2, rs = 0.5, lm = 2, RL = 3;
    const nl = parseNetlist(`V1 p 0 0\nT1 p 0 s 0 ${n} rp=${rp} rs=${rs} lm=${lm}\nR1 s 0 ${RL}`);
    nl.elements.find((e) => e.id === 'V1')!.wave = sine(20, f);
    const run = tranNetlist(nl, { h: 1 / f / 2000, tStop: 5 / f, probes: ['v(p)', 'i(T1)', 'v(s)'] });
    const t = run.t, vp = run.y('v(p)'), ip = run.y('i(T1)'), vs = run.y('v(s)');
    const is = vs.map((v) => -v / RL);                       // current INTO s1 (the load draws vs/RL out of it)
    const pin = t.map((_, k) => vp[k] * ip[k]);
    const pout = t.map((_, k) => rp * ip[k] * ip[k] + rs * is[k] * is[k] + (vs[k] * vs[k]) / RL);
    const im = ip[ip.length - 1] + is[is.length - 1] / n;     // ampere-turn balance gives the magnetising current
    const eIn = integrate(t, pin), eOut = integrate(t, pout), eL = 0.5 * lm * im * im;
    expect(eIn).toBeGreaterThan(0);
    expect(Math.abs(eIn - (eOut + eL)) / eIn).toBeLessThan(0.005);
  });
  it('DC blocking: a DC step across the primary decays on the secondary with tau = Lm/rp and ends at 0', () => {
    const rp = 10, lm = 0.1, tau = lm / rp;
    const run = tranCards(`V1 p 0 10\nT1 p 0 s 0 10 rp=${rp} lm=${lm}\nR1 s 0 100`, { h: tau / 200, tStop: 12 * tau, probes: ['v(s)'] });
    near(run.at('v(s)', tau), dmath.exp(-1), 0.02);
    near(run.at('v(s)', 3 * tau), dmath.exp(-3), 0.02);
    expect(Math.abs(run.at('v(s)', 12 * tau))).toBeLessThan(1e-4);
  });
});

describe('catalogue part xfmr-12 expander (game-defined fixture)', () => {
  it('expands to one T element: n = 230/12, rs = 1.5 (secondary), lm = 10, pins P1 P2 S1 S2 in order', () => {
    const def = partById('xfmr-12');
    const els = EXPANDERS.XFMR!({ part: { uid: 'p1', partId: 'xfmr-12' } as never, def, nodes: [1, 2, 3, 4] });
    expect(els).toHaveLength(1);
    expect(els[0]).toMatchObject({ id: 'p1', kind: 'T', owner: 'p1', nodes: [1, 2, 3, 4] });
    near(els[0].p.n, 230 / 12, 1e-12); expect(els[0].p.rs).toBe(1.5); expect(els[0].p.lm).toBe(10);
  });
  it('loaded at nominal mains the secondary is about 12 V rms minus the winding drop (AC)', () => {
    const n = 230 / 12;
    const v = mag(acCards(`V1 in 0 0 ac 230\nT1 in 0 s 0 ${n} rs=1.5 lm=10\nR1 s 0 24`).solve(50).v('s'));
    near(v, 12 * 24 / 25.5, 0.01);
  });
});
