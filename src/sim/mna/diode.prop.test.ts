import { describe, expect, it } from 'vitest';
import { Rng } from '@core/kit/rng';
import { dmath } from '@core/numerics';
import { compileNetlist } from './compile';
import { randomDiodeBoard } from './diode.fuzz';
import { solveOp } from './op';
import { StampCtx } from './stamp';
import { junctionVoltage } from './devices/diode';

// Independent re-statement of the model equations (DESIGN 3.3) used as the oracle for the stamped device.
function shockley(p: Record<string, number>, vd: number, gmin: number): number {
  const g = (x: number): number => (x > 80 ? dmath.exp(80) * (1 + (x - 80)) : dmath.exp(x));
  let i = (p.is ?? 1e-14) * (g(vd / ((p.n ?? 1) * 0.025852)) - 1);
  if (p.bv !== undefined) i -= (p.ibv ?? 1e-3) * g(-(vd + p.bv) / ((p.nbv ?? 1) * 0.025852));
  return i + gmin * vd;
}

describe('diode property tests (500 seeded random boards)', () => {
  it('device consistency: stamped companion current = model equation = terminalCurrents at the converged point (1e-12 A); KCL holds', () => {
    let solved = 0, diodes = 0, worstKcl = 0;
    for (let s = 1; s <= 500; s++) {
      const nl = randomDiodeBoard(new Rng(7000 + s));
      const c = compileNetlist(nl); if (!c.ok) throw new Error(JSON.stringify(c.errors));
      const op = solveOp(c.circuit);
      if (!op.ok) { expect(op.failure?.key, `seed ${s}`).toBe('solve.noConverge'); continue; }
      solved++;
      const x = op.x;
      for (const e of c.circuit.elements) {
        if (e.dev.kind !== 'D') continue;
        diodes++;
        const vd = junctionVoltage(e, x), want = shockley(e.el.p, vd, 1e-12);
        const t = e.dev.terminalCurrents(e, x, [])[0];
        expect(Math.abs(t - want), `seed ${s} ${e.el.id} terminal vs model`).toBeLessThanOrEqual(1e-12);
        // stamp this element alone at x and read the companion back: i = gtot·vd + Ieq with gtot = −A[j][k], Ieq from the rhs
        const ctx = new StampCtx(c.circuit.dim); ctx.x.set(x); ctx.gmin = 1e-12; e.dev.stampDC(e, ctx);
        const j = e.internal.length ? e.internal[0] : e.nodes[0], k = e.nodes[1];
        const gtot = j >= 0 && k >= 0 ? -ctx.A[j * ctx.dim + k] : j >= 0 ? ctx.A[j * ctx.dim + j] - (e.internal.length ? 1 / e.el.p.rs : 0) : ctx.A[k * ctx.dim + k];
        const ieq = j >= 0 ? -ctx.b[j] : ctx.b[k];
        expect(Math.abs(gtot * vd + ieq - want), `seed ${s} ${e.el.id} companion`).toBeLessThanOrEqual(1e-12 + 1e-12 * Math.abs(want));
      }
      // KCL at every external node from the element equations (+ gmin to ground): <= 1e-9 A + 1e-6 max|I|
      const sum = new Float64Array(c.circuit.n); let big = 0;
      for (const e of c.circuit.elements) {
        const tc = e.dev.terminalCurrents(e, x, []);
        tc.forEach((v, t) => { big = Math.max(big, Math.abs(v)); if (e.nodes[t] >= 0) sum[e.nodes[t]] += v; });
      }
      for (let i = 0; i < c.circuit.n; i++) { const r = Math.abs(sum[i] + 1e-12 * x[i]); worstKcl = Math.max(worstKcl, r - 1e-6 * big); expect(r, `seed ${s} node ${i}`).toBeLessThanOrEqual(1e-9 + 1e-6 * big); }
    }
    console.log(`diode prop: solved ${solved}/500 boards, ${diodes} diodes checked, worst KCL excess ${worstKcl.toExponential(2)}`);
    expect(solved).toBeGreaterThanOrEqual(475);
    expect(diodes).toBeGreaterThan(500);
  });
  it('determinism: the same board gives bit-identical solutions and strategy', () => {
    for (let s = 1; s <= 20; s++) {
      const c = compileNetlist(randomDiodeBoard(new Rng(9000 + s))); if (!c.ok) throw new Error();
      const a = solveOp(c.circuit), b = solveOp(c.circuit);
      expect(Array.from(a.x)).toEqual(Array.from(b.x)); expect(a.strategy).toBe(b.strategy); expect(a.iterations).toBe(b.iterations);
    }
  });
});
