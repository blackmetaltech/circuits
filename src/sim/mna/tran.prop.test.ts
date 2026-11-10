// Property tests for transient analysis on random RC / RL / RLC nets (DESIGN §9.3). Seeded with core Rng; deterministic.
import { describe, expect, it } from 'vitest';
import { Rng } from '@core/kit/rng';
import { dmath } from '@core/numerics';
import type { Circuit, Element, Netlist } from './types';
import { compileNetlist } from './compile';
import { solveOp } from './op';
import { runTran, makeProbe, type TranOptions } from './tran';
import { terminalCurrents } from './stamp';
import { sine, square } from './waveforms';

const logU = (r: Rng, lo: number, hi: number): number => dmath.exp(r.range(dmath.log(lo), dmath.log(hi)));

interface Net { nl: Netlist; ckt: Circuit; tauMin: number; tauMax: number; nodes: string[]; caps: Element[]; inds: Element[] }
interface GenOpts { L?: boolean; C?: boolean; src?: 'dc' | 'sine' | 'square' }

/** Random connected R-spine driven at node n1 by V1 (n1 → 0) plus 1-4 shunt/bridge C and L. No L/V loops, no C/V-only loops, so the DC OP exists. */
function randomRlc(r: Rng, o: GenOpts = {}): Net {
  const N = r.int(2, 5), els: Element[] = [];
  let k = 0;
  const add = (kind: string, nodes: number[], p: Element['p']): Element => { const e: Element = { id: kind + ++k, kind, owner: '', nodes, p }; els.push(e); return e; };
  const v1 = add('V', [1, 0], { v: r.range(1, 10) });
  if (o.src === 'sine') v1.wave = sine(v1.p.v, logU(r, 200, 2000));
  if (o.src === 'square') v1.wave = square(0, v1.p.v, logU(r, 1e-3, 5e-3), 0.5, 1e-5);
  let rsum = 0, rmin = Infinity, rmax = 0;
  for (let j = 2; j <= N; j++) { const R = logU(r, 200, 5000); add('R', [j, r.int(1, j - 1)], { r: R }); rsum += R; rmin = Math.min(rmin, R); rmax = Math.max(rmax, R); }
  if (N === 2 || r.chance(0.3)) { const R = logU(r, 200, 5000); add('R', [r.int(1, N), 0], { r: R }); rsum += R; rmin = Math.min(rmin, R); rmax = Math.max(rmax, R); }
  else { const R = logU(r, 200, 5000); add('R', [N, 0], { r: R }); rsum += R; rmin = Math.min(rmin, R); rmax = Math.max(rmax, R); }
  const wantC = o.C ?? true, wantL = o.L ?? true;
  const uf = Array.from({ length: N + 1 }, (_, i) => i);
  const find = (a: number): number => (uf[a] === a ? a : (uf[a] = find(uf[a])));
  uf[find(1)] = find(0);                                   // V1 ties node 1 to ground for the ideal-branch loop check
  let nC = 0, nL = 0, csum = 0, lsum = 0, cmin = Infinity, lmin = Infinity;
  const extra = r.int(1, 4);
  for (let e = 0; e < extra || (wantC && nC === 0) || (o.L === true && nL === 0); e++) {
    const a = r.int(0, N), b = r.int(0, N);
    if (a === b || (a === 0 && b === 1) || (a === 1 && b === 0)) continue;
    const asL = wantL && (!wantC || (o.L === true && nL === 0 && nC > 0) || r.chance(0.4));
    if (asL) {
      if (find(a) === find(b)) continue;
      uf[find(a)] = find(b);
      const l = logU(r, 20e-3, 200e-3); add('L', [a, b], { l }); nL++; lsum += l; lmin = Math.min(lmin, l);
    } else if (wantC && a !== 1 && b !== 1) { const c = logU(r, 0.2e-6, 2e-6); add('C', [a, b], { c }); nC++; csum += c; cmin = Math.min(cmin, c); }
    if (e > 60) break;
  }
  const cands = [Infinity];
  if (nC) cands.push(cmin * rmin / 6);
  if (nL) cands.push(lmin / rsum);
  if (nC && nL) cands.push(dmath.sqrt(lmin * cmin));
  const tauMin = Math.min(...cands);
  const tauMax = 2 * (csum * rsum + (nL ? lsum / rmin : 0));
  const nl: Netlist = { nodeNames: ['0', ...Array.from({ length: N }, (_, i) => 'n' + (i + 1))], elements: els, models: {}, modelTypes: {} };
  const c = compileNetlist(nl); if (!c.ok) throw new Error(JSON.stringify(c.errors));
  return { nl, ckt: c.circuit, tauMin, tauMax, nodes: nl.nodeNames.slice(1), caps: els.filter((e) => e.kind === 'C'), inds: els.filter((e) => e.kind === 'L') };
}

const maxAbs = (a: ArrayLike<number>): number => { let m = 0; for (let i = 0; i < a.length; i++) m = Math.max(m, Math.abs(a[i])); return m; };

describe('transient energy balance (RC / RL / RLC)', () => {
  const run = (seed: number, cases: number, method: 'auto' | 'BE', tol: number, hDiv: number, src: GenOpts['src']): void => {
    const r = new Rng(seed); let kclSteps = 0, worst = 0;
    for (let c = 0; c < cases; c++) {
      const g = randomRlc(r, { src });
      const h = g.tauMin / hDiv, o: TranOptions = { h, tStop: 1200 * h, method };
      const ckt = g.ckt, pw = ckt.elements.map((e) => ({ e, kind: e.el.kind }));
      let pS = 0, pR = 0, Es = 0, Er = 0, tPrev = 0, first = true;
      const power = (x: Float64Array, st: number[]): [number, number] => {
        let s = 0, rr = 0;
        for (const { e, kind } of pw) {
          if (kind !== 'V' && kind !== 'R') continue;
          const i = terminalCurrents(e, x, st)[0], v = (e.nodes[0] < 0 ? 0 : x[e.nodes[0]]) - (e.nodes[1] < 0 ? 0 : x[e.nodes[1]]);
          if (kind === 'V') s -= v * i; else rr += v * i;
        }
        return [s, rr];
      };
      const res = runTran(ckt, {
        ...o, probes: [], onStep: (s) => {
          if (first) { first = false; }                              // t = 0: every source and state is 0 → p = 0
          const [ps, pr] = power(s.x, s.state), dt = s.t - tPrev;
          Es += 0.5 * (ps + pS) * dt; Er += 0.5 * (pr + pR) * dt; pS = ps; pR = pr; tPrev = s.t;
          // KCL at every accepted step
          const sum = new Array(ckt.n).fill(0); let big = 0;
          for (const e of ckt.elements) terminalCurrents(e, s.x, s.state).forEach((i, t) => { big = Math.max(big, Math.abs(i)); const nd = e.nodes[t]; if (nd >= 0 && nd < ckt.n) sum[nd] += i; });
          for (let j = 0; j < ckt.n; j++) expect(Math.abs(sum[j] + 1e-12 * s.x[j])).toBeLessThanOrEqual(1e-9 + 1e-6 * big);
          kclSteps++;
        },
      });
      expect(res.ok).toBe(true);
      const x = Float64Array.from(res.state.x);
      let Ec = 0, El = 0;
      for (const e of ckt.elements) {
        if (e.el.kind === 'C') { const v = (e.nodes[0] < 0 ? 0 : x[e.nodes[0]]) - (e.nodes[1] < 0 ? 0 : x[e.nodes[1]]); Ec += 0.5 * e.el.p.c * v * v; }
        if (e.el.kind === 'L') El += 0.5 * e.el.p.l * x[e.branch[0]] ** 2;
      }
      const scale = Math.max(Es, Er + Ec + El, 1e-12), err = Math.abs(Es - (Er + Ec + El)) / scale;
      worst = Math.max(worst, err);
      expect(err, `case ${c}: Es ${Es} Er ${Er} Ec ${Ec} El ${El}`).toBeLessThanOrEqual(tol);
    }
    expect(kclSteps).toBeGreaterThan(cases * 1000);
    if (process.env.ORACLE_LOG) console.log(`energy ${method} ${src} worst rel err ${worst}`);
  };
  it('TRAP (auto, BE restarts): E_sources = E_R + ΔE_C + ΔE_L within 0.5 %, DC step source, 120 nets', () => run(11, 120, 'auto', 5e-3, 20, 'dc'));
  it('TRAP: sine-driven nets, 50 nets', () => run(12, 50, 'auto', 5e-3, 20, 'sine'));
  it('TRAP: square-driven nets (breakpoints + BE restarts), 50 nets', () => run(13, 50, 'auto', 5e-3, 20, 'square'));
  it('BE only: within 2 %, 40 nets', () => run(14, 40, 'BE', 2e-2, 150, 'dc'));
});

describe('order of accuracy', () => {
  // Source-free RC / RLC from random initial conditions; error against a TRAP reference at h/64, no breakpoints, no BE restart.
  const orderRatio = (g: Net, r: Rng, method: 'TRAP' | 'BE'): number => {
    const ic: Record<string, number> = {};
    for (const e of g.caps) ic[e.id] = r.range(-5, 5);
    for (const e of g.inds) ic[e.id] = r.range(-5e-3, 5e-3);
    g.nl.elements.find((e) => e.kind === 'V')!.p.v = 0;
    const ckt = compileNetlist(g.nl); if (!ckt.ok) throw new Error('compile');
    const h = g.tauMin / 12, N = 96, probes = g.nodes.map((n) => `v(${n})`);
    const mk = (hh: number, m: 'TRAP' | 'BE', n: number) => runTran(ckt.circuit, { h: hh, tStop: n * hh, ic, ramp: false, method: m, probes });
    const ref = mk(h / 64, 'TRAP', N * 64);
    const err = (hh: number, stride: number): number => {
      const a = mk(hh, method, N * (64 / stride)); let e = 0;
      for (const p of probes) for (let k = 0; k < a.t.length; k++) e = Math.max(e, Math.abs(a.series[p][k] - ref.series[p][k * stride]));
      return e;
    };
    return err(h, 64) / err(h / 2, 32);
  };
  const cases = (seed: number, n: number, method: 'TRAP' | 'BE', lo: number, hi: number): void => {
    const r = new Rng(seed); const rat: number[] = [];
    for (let c = 0; c < n; c++) { const ratio = orderRatio(randomRlc(r, { L: c % 2 === 1 }), r, method); rat.push(ratio); expect(ratio, `case ${c}`).toBeGreaterThan(lo); expect(ratio, `case ${c}`).toBeLessThan(hi); }
    if (process.env.ORACLE_LOG) console.log(`order ${method}: min ${Math.min(...rat)} max ${Math.max(...rat)}`);
  };
  it('TRAP error ratio ≈ 4 (3..5) when h halves, 40 RC / RLC nets', () => cases(21, 40, 'TRAP', 3, 5));
  it('BE error ratio ≈ 2 (1.7..2.4) when h halves, 40 RC / RLC nets', () => cases(22, 40, 'BE', 1.7, 2.4));
});

describe('DC limit', () => {
  it('transient to 20 τ_max ends within 0.1 % of the DC operating point (240 nets)', () => {
    const r = new Rng(31); let worst = 0;
    for (let c = 0; c < 240; c++) {
      const g = randomRlc(r, { L: c % 3 !== 0 });
      const op = solveOp(g.ckt); expect(op.ok).toBe(true);
      const T = 20 * g.tauMax, res = runTran(g.ckt, { h: T / 1500, tStop: T, probes: [] });
      expect(res.ok).toBe(true);
      const scale = maxAbs(op.x.subarray(0, g.ckt.n)); let e = 0;
      for (let i = 0; i < g.ckt.dim; i++) e = Math.max(e, Math.abs(res.state.x[i] - op.x[i]) / (i < g.ckt.n ? scale : Math.max(maxAbs(op.x.subarray(g.ckt.n)), 1e-9)));
      worst = Math.max(worst, e);
      expect(e, `case ${c}`).toBeLessThanOrEqual(1e-3);
    }
    if (process.env.ORACLE_LOG) console.log(`dc limit worst rel err ${worst}`);
  });
});

describe('charge conservation', () => {
  it('capacitor-only charge sharing conserves ΣQ to 1e-9 relative at every step (240 nets)', () => {
    const r = new Rng(41); let worst = 0;
    for (let c = 0; c < 240; c++) {
      const N = r.int(2, 6), els: Element[] = [], ic: Record<string, number> = {};
      let rmin = Infinity, cmin = Infinity, k = 0;
      for (let j = 1; j <= N; j++) {
        const cc = logU(r, 1e-6, 1e-5); cmin = Math.min(cmin, cc); ic['C' + j] = r.range(-50, 50);
        els.push({ id: 'C' + j, kind: 'C', owner: '', nodes: [j, 0], p: { c: cc } });
        if (j > 1) { const R = logU(r, 100, 1000); rmin = Math.min(rmin, R); els.push({ id: 'R' + ++k, kind: 'R', owner: '', nodes: [j, r.int(1, j - 1)], p: { r: R } }); }
      }
      const nl: Netlist = { nodeNames: ['0', ...Array.from({ length: N }, (_, i) => 'n' + (i + 1))], elements: els, models: {}, modelTypes: {} };
      const cr = compileNetlist(nl); if (!cr.ok) throw new Error('compile');
      const caps = els.filter((e) => e.kind === 'C');
      let q0 = 0, qa = 0; for (const e of caps) { q0 += e.p.c * ic[e.id]; qa += Math.abs(e.p.c * ic[e.id]); }
      const h = rmin * cmin / 10;
      let n = 0;
      // gmin = 0: the 1e-12 S node shunt is numerics, not physics, and would bleed ΣQ at 1e-8 over these run lengths
      const res = runTran(cr.circuit, { h, tStop: 600 * h, ic, gmin: 0, onStep: (s) => {
        let q = 0; for (const e of caps) q += e.p.c * s.x[e.nodes[0] - 1];
        const err = Math.abs(q - q0) / qa; worst = Math.max(worst, err); n++;
        expect(err, `case ${c} step ${s.index}`).toBeLessThanOrEqual(1e-9);
      } });
      expect(res.ok).toBe(true); expect(n).toBeGreaterThan(500);
    }
    if (process.env.ORACLE_LOG) console.log(`charge worst rel err ${worst}`);
  });
});

describe('probes', () => {
  it('v(a,b), i(id) and p(id) accessors; unknown names throw', () => {
    const g = randomRlc(new Rng(5));
    expect(() => makeProbe(g.ckt, 'v(nope)')).toThrow(); expect(() => makeProbe(g.ckt, 'i(Z9)')).toThrow(); expect(() => makeProbe(g.ckt, 'x(1)')).toThrow();
    const f = makeProbe(g.ckt, 'v(n1,n2)'), x = new Float64Array(g.ckt.dim); x[0] = 3; x[1] = 1;
    expect(f(x, [])).toBe(2);
  });
});
