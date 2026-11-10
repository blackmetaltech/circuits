import { describe, expect, it } from 'vitest';
import { Rng } from '@core/kit/rng';
import { compileNetlist } from './compile';
import { solveOp } from './op';
import { StampCtx } from './stamp';
import { randomTransistorBoard } from './transistor.fuzz';

const TRANSISTOR = new Set(['Q', 'M', 'DAR']);

describe('transistor property tests (seeded random boards)', () => {
  it('Jacobian: analytic stamp = central finite difference of the model residual f(x) = A(x)x - b(x), at random points; companion current = terminalCurrents', () => {
    let checked = 0, worst = 0;
    for (let s = 1; s <= 300; s++) {
      const rng = new Rng(21000 + s), nl = randomTransistorBoard(rng), c = compileNetlist(nl);
      if (!c.ok) throw new Error(JSON.stringify(c.errors));
      for (const e of c.circuit.elements) {
        if (!TRANSISTOR.has(e.el.kind)) continue;
        const dim = c.circuit.dim, ctx = new StampCtx(dim), at = (x: Float64Array) => { ctx.x.set(x); ctx.gmin = 1e-12; ctx.clear(); e.dev.stampDC(e, ctx); };
        const f = (x: Float64Array): Float64Array => { at(x); const out = new Float64Array(dim); for (let i = 0; i < dim; i++) { let a = -ctx.b[i]; for (let j = 0; j < dim; j++) a += ctx.A[i * dim + j] * x[j]; out[i] = a; } return out; };
        for (let trial = 0; trial < 4; trial++) {
          const x = new Float64Array(dim); for (let i = 0; i < dim; i++) x[i] = rng.range(trial === 3 ? -3 : -1.2, trial === 3 ? 3 : 1.2);
          if (trial === 0) for (let i = 0; i < dim; i++) x[i] = 0.7 * rng.int(0, 1);
          at(x); const J = Float64Array.from(ctx.A), f0 = f(x), mag = new Float64Array(dim);
          for (let i = 0; i < dim; i++) { mag[i] = Math.abs(ctx.b[i]); for (let j = 0; j < dim; j++) mag[i] += Math.abs(J[i * dim + j] * x[j]); }   // cancellation scale of the residual
          const idx = [...e.nodes, ...e.internal].filter((i) => i >= 0);
          for (const j of idx) {
            const h = 1e-6, xp = Float64Array.from(x), xm = Float64Array.from(x); xp[j] += h; xm[j] -= h;
            const fp = f(xp), fm = f(xm);
            for (const i of idx) {
              const num = (fp[i] - fm[i]) / (2 * h), ana = J[i * dim + j], err = Math.abs(num - ana);
              worst = Math.max(worst, err / (1e-9 + 2e-4 * Math.abs(ana) + 1e-9 * mag[i]));
              expect(err, `seed ${s} ${e.el.id} d f[${i}]/d x[${j}]: ana ${ana} num ${num}`).toBeLessThanOrEqual(1e-9 + 2e-4 * Math.abs(ana) + 1e-9 * mag[i]);
            }
          }
          const tc = e.dev.terminalCurrents(e, x, []);
          e.nodes.forEach((n, t) => { if (n >= 0 && e.el.kind !== 'DAR') expect(Math.abs(f0[n] - tc[t]), `seed ${s} ${e.el.id} companion t${t}`).toBeLessThanOrEqual(1e-12 + 1e-9 * Math.abs(tc[t])); });
          checked++;
        }
      }
    }
    console.log(`transistor prop: ${checked} (device, point) Jacobians checked, worst error / tolerance ${worst.toExponential(2)}`);
    expect(worst).toBeLessThanOrEqual(1);
    expect(checked).toBeGreaterThan(500);
  });
  it('converged random boards: KCL at every node from the terminal currents; >= 90 % solved, the rest explained', () => {
    let solved = 0, devs = 0;
    for (let s = 1; s <= 300; s++) {
      const c = compileNetlist(randomTransistorBoard(new Rng(23000 + s))); if (!c.ok) throw new Error(JSON.stringify(c.errors));
      const op = solveOp(c.circuit);
      if (!op.ok) { expect(op.failure?.key, `seed ${s}`).toMatch(/^solve\./); continue; }
      solved++;
      const sum = new Float64Array(c.circuit.n); let big = 0;
      for (const e of c.circuit.elements) {
        if (TRANSISTOR.has(e.el.kind)) devs++;
        const tc = e.dev.terminalCurrents(e, op.x, []);
        tc.forEach((v, t) => { big = Math.max(big, Math.abs(v)); if (e.nodes[t] >= 0) sum[e.nodes[t]] += v; });
      }
      for (let i = 0; i < c.circuit.n; i++) expect(Math.abs(sum[i] + 1e-12 * op.x[i]), `seed ${s} node ${i}`).toBeLessThanOrEqual(1e-9 + 1e-6 * big);
    }
    console.log(`transistor prop: solved ${solved}/300, ${devs} transistors`);
    expect(solved).toBeGreaterThanOrEqual(270); expect(devs).toBeGreaterThan(300);
  });
  it('determinism: identical bits and strategy on repeat', () => {
    for (let s = 1; s <= 20; s++) {
      const c = compileNetlist(randomTransistorBoard(new Rng(25000 + s))); if (!c.ok) throw new Error();
      const a = solveOp(c.circuit), b = solveOp(c.circuit);
      expect(Array.from(a.x)).toEqual(Array.from(b.x)); expect(a.strategy).toBe(b.strategy);
    }
  });
});
