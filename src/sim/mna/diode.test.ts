import { describe, expect, it } from 'vitest';
import { dmath } from '@core/numerics';
import { compileNetlist } from './compile';
import { parseNetlist } from './netlist';
import { makeWorkspace, solveNewton, solveOp } from './op';
import { elementCurrent, elementPower, nodeVoltage } from './stamp';
import { pnjlim, vcritOf } from './limit';
import { junction, expg } from './devices/diode';

const build = (text: string, extra?: (nl: ReturnType<typeof parseNetlist>) => void) => {
  const nl = parseNetlist(text); extra?.(nl);
  const r = compileNetlist(nl); if (!r.ok) throw new Error(JSON.stringify(r.errors));
  return r.circuit;
};
const LED = '.model LEDr led(is=1.19e-17 n=2 rs=9.9)';
const battery = (nl: ReturnType<typeof parseNetlist>, node: number, emf: number, r: number) => nl.elements.push({ id: 'B1', kind: 'BAT', owner: 'p0', nodes: [node, 0], p: { emf, r } });
const mA = (x: number) => (x * 1e3).toFixed(4);

describe('pnjlim / exponential guard', () => {
  it('leaves small steps alone, compresses big forward steps, clamps big reverse steps', () => {
    const nVt = 0.025852, vc = vcritOf(nVt, 1e-14);
    expect(vc).toBeGreaterThan(0.55); expect(vc).toBeLessThan(0.75);
    expect(pnjlim(0.5, 0.49, nVt, vc)).toBe(0.5);
    expect(pnjlim(5, 0.6, nVt, vc)).toBeLessThan(0.9);
    expect(pnjlim(5, 0, nVt, vc)).toBeCloseTo(nVt * dmath.log(5 / nVt), 12);
    expect(pnjlim(-20, 0, nVt, vc)).toBe(-1);
    expect(pnjlim(-20, -1, nVt, vc)).toBe(-3);
  });
  it('expg is continuous with slope e^80 above 80 and never overflows', () => {
    expect(expg(80)).toBe(dmath.exp(80)); expect(expg(81)).toBeCloseTo(2 * dmath.exp(80), -10);
    expect(Number.isFinite(expg(1e6))).toBe(true);
    const a = junction({ is: 1e-14 }, 10, 0), b = junction({ is: 1e-14 }, 10.001, 0);
    expect(Number.isFinite(a.i) && b.i > a.i).toBe(true);
  });
  it('Zener breakdown current is -Ibv at Vd = -BV', () => {
    const q = junction({ is: 1e-14, bv: 5.1, ibv: 5e-3 }, -5.1, 0);
    expect(q.i).toBeCloseTo(-5e-3, 9);
  });
});

describe('ticket sanity (DESIGN 1-1, 1-2) with the refit red LED (N 2.0, Is 1.19e-17, Rs 9.9)', () => {
  it('1-1 Torch: 470 ohm on a 9 V / 1.7 ohm battery = 14.95 mA +- 0.05', () => {
    const c = build(`R1 a d 470\nD1 d 0 LEDr\n${LED}`, (nl) => battery(nl, 1, 9, 1.7));
    const op = solveOp(c); expect(op.ok).toBe(true);
    const i = elementCurrent(c, op.x, 'D1'); console.log('1-1 470R', mA(i), 'mA', op.strategy);
    expect(Math.abs(i - 14.95e-3)).toBeLessThan(0.05e-3);
  });
  it('1-1 Torch: other resistors (100 -> ~64 mA, 220 -> ~31 mA, 1k -> ~7.2 mA)', () => {
    const want: Record<number, number> = { 100: 64e-3, 220: 31e-3, 1000: 7.2e-3 };
    for (const r of [100, 220, 1000]) {
      const c = build(`R1 a d ${r}\nD1 d 0 LEDr\n${LED}`, (nl) => battery(nl, 1, 9, 1.7));
      const i = elementCurrent(c, solveOp(c).x, 'D1'); console.log('1-1', r, mA(i));
      expect(Math.abs(i - want[r]) / want[r]).toBeLessThan(0.03);
    }
  });
  it('1-1 Torch: LED straight on the battery draws about 0.60 A', () => {
    const c = build(`D1 a 0 LEDr\n${LED}`, (nl) => battery(nl, 1, 9, 1.7));
    const op = solveOp(c); expect(op.ok).toBe(true);
    const i = elementCurrent(c, op.x, 'D1'); console.log('1-1 straight', i.toFixed(4), 'A', op.strategy);
    expect(Math.abs(i - 0.6)).toBeLessThan(0.02);
  });
  it('1-2 Tail-light: 3 LEDs in series + 150 ohm: 19.65 mA fresh, 16.1 mA tired', () => {
    const t = (emf: number, r: number) => { const c = build(`R1 a x 150\nD1 x y LEDr\nD2 y z LEDr\nD3 z 0 LEDr\n${LED}`, (nl) => battery(nl, 1, emf, r)); const op = solveOp(c); expect(op.ok).toBe(true); return elementCurrent(c, op.x, 'D1'); };
    const f = t(9, 1.7), w = t(8.4, 6); console.log('1-2 fresh', mA(f), 'tired', mA(w));
    expect(Math.abs(f - 19.65e-3)).toBeLessThan(0.05e-3); expect(Math.abs(w - 16.1e-3)).toBeLessThan(0.05e-3);
  });
});

describe('solveNewton (reusable at a given lambda / gmin / mode)', () => {
  const c = build('V1 a 0 5\nR1 a d 1k\nD1 d 0 Dx\n.model Dx D(is=1e-14 n=1)');
  it('converges from a poor start and reports its work', () => {
    const r = solveNewton(c, new Float64Array(c.dim));
    expect(r).toMatchObject({ ok: true, reason: 'converged' });
    expect(r.iterations).toBeGreaterThan(1); expect(r.iterations).toBeLessThan(40); expect(r.limitedIters).toBeGreaterThan(0);
    expect(r.residual).toBeLessThan(1e-9);
  });
  it('the previous solution converges in 2 iterations; lambda scales the source; workspace reuse is allowed', () => {
    const ws = makeWorkspace(c);
    const a = solveNewton(c, new Float64Array(c.dim), { ws });
    const b = solveNewton(c, a.x, { ws }); expect(b.ok).toBe(true); expect(b.iterations).toBeLessThanOrEqual(2);
    const h = solveNewton(c, a.x, { ws, lambda: 0.5 }); expect(h.ok).toBe(true);
    expect(nodeVoltage(h.x, c.nodeIndex.a)).toBeCloseTo(2.5, 6);
  });
  it('maxIter exhaustion is a result, not a throw', () => {
    const r = solveNewton(c, new Float64Array(c.dim), { maxIter: 2 });
    expect(r.ok).toBe(false); expect(r.reason).toBe('maxIter');
  });
  it('a limited step is never accepted as converged (first step from 0 is limited)', () => {
    const r = solveNewton(c, new Float64Array(c.dim), { maxIter: 1 });
    expect(r.ok).toBe(false);
  });
});

describe('textbook ideal diode variant', () => {
  it('forward: 0.7 V + 1 mOhm; reverse: open; power matches', () => {
    const c = build('V1 a 0 5\nR1 a d 1k\nD1 d 0 T\n.model T d07');
    const op = solveOp(c); expect(op.ok).toBe(true);
    expect(nodeVoltage(op.x, c.nodeIndex.d)).toBeCloseTo(0.7 + 4.3e-6, 5);
    expect(elementPower(c, op.x, 'D1')).toBeCloseTo(3.01e-3, 5);
  });
  it('Zener ideal conducts in breakdown at exactly BV', () => {
    const c = build('V1 a 0 12\nR1 a o 300\nD1 0 o Z\n.model Z ideal(bv=6)');
    const op = solveOp(c); expect(nodeVoltage(op.x, c.nodeIndex.o)).toBeCloseTo(6, 3);
  });
});

describe('board expander', () => {
  it('maps def.model keys of every diode kind to a D element', async () => {
    const { EXPANDERS } = await import('./netlist');
    for (const k of ['D', 'LED', 'Z', 'SCHOTTKY'] as const) {
      const ex = EXPANDERS[k]!;
      const els = ex({ part: { uid: 'p1' } as never, def: { model: { Is: 1e-14, N: 2, Rs: 3, BV: 5.1 } } as never, nodes: [1, 2] });
      expect(els).toEqual([{ id: 'p1', kind: 'D', owner: 'p1', nodes: [1, 2], p: { is: 1e-14, n: 2, rs: 3, bv: 5.1 } }]);
    }
  });
});
