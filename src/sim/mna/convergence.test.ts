// Convergence suite (DESIGN 9.4), the parts that exist now: diode family. Every case must converge or fail gracefully with the
// explainer key, never hang (iteration-count bounded in the rules; the harness enforces the 2 s wall guard per case here).
import { describe, expect, it } from 'vitest';
import { Rng } from '@core/kit/rng';
import { compileNetlist } from './compile';
import { randomDiodeBoard } from './diode.fuzz';
import { parseNetlist } from './netlist';
import { solveOp, type OpResult, type OpStrategy } from './op';
import { elementCurrent, nodeVoltage } from './stamp';
import type { Netlist } from './types';

const WALL_MS = 2000;
const tally: Record<string, number> = { newton: 0, gmin: 0, source: 0, pseudo: 0, explained: 0 };
const compile = (nl: Netlist) => { const r = compileNetlist(nl); if (!r.ok) throw new Error(JSON.stringify(r.errors)); return r.circuit; };
const bat = (nl: Netlist, node: number, emf: number, r: number, other = 0) => nl.elements.push({ id: 'B1', kind: 'BAT', owner: 'p0', nodes: [node, other], p: { emf, r } });
function solveTimed(nl: Netlist, name: string, x0?: Float64Array): { op: OpResult; c: ReturnType<typeof compile> } {
  const c = compile(nl), t0 = performance.now();
  const op = solveOp(c, { x0 });
  expect(performance.now() - t0, `${name} wall`).toBeLessThan(WALL_MS);
  if (op.ok) tally[op.strategy]++; else { tally.explained++; expect(op.failure, name).toMatchObject({ code: 'noConverge', key: 'solve.noConverge' }); expect(op.failure!.nodes.length).toBeGreaterThan(0); }
  return { op, c };
}
const LED = '.model L led(is=1.19e-17 n=2 rs=9.9)';

describe('convergence suite: diode family', () => {
  it('diode directly across a 9 V battery (r 1.7)', () => {
    const nl = parseNetlist('D1 a 0 D\n.model D D(is=1e-14 n=1)'); bat(nl, 1, 9, 1.7);
    const { op, c } = solveTimed(nl, 'diode-on-battery'); expect(op.ok).toBe(true);
    const vd = nodeVoltage(op.x, 1), i = elementCurrent(c, op.x, 'D1');
    expect(Math.abs(i - (9 - vd) / 1.7)).toBeLessThan(1e-6 * i);
  });
  it('anti-parallel diodes across a source with 0.1 ohm, both polarities', () => {
    for (const emf of [5, -5, 12]) {
      const nl = parseNetlist('D1 a 0 D\nD2 0 a D\n.model D D(is=1e-14 n=1)'); bat(nl, 1, emf, 0.1);
      const { op } = solveTimed(nl, `antiparallel ${emf}`); expect(op.ok).toBe(true);
      expect(Math.sign(nodeVoltage(op.x, 1))).toBe(Math.sign(emf));
    }
  });
  it('10 diodes (1N4148: Rs 0.568) in series straight across an ideal 12 V', () => {
    let t = 'V1 n0 0 12\n.model D D(is=2.52n n=1.752 rs=0.568)\n';
    for (let k = 0; k < 10; k++) t += `D${k + 1} n${k} ${k === 9 ? '0' : 'n' + (k + 1)} D\n`;
    const { op, c } = solveTimed(parseNetlist(t), '10-diodes-direct'); expect(op.ok).toBe(true);
    const i = elementCurrent(c, op.x, 'D1');
    expect(i).toBeGreaterThan(0.1); expect(i).toBeLessThan(5);       // ~ (12 - 10·Vd)/(10·Rs): each Vd ≈ 1.0 V at ~ 0.4 A
  });
  it('10 ideal-Shockley diodes (no Rs) straight across an ideal 12 V: a ~1e6 A short. Solved, or failed WITH the explainer (never a hang or a throw)', () => {
    let t = 'V1 n0 0 12\n.model D D(is=1e-14 n=1)\n';
    for (let k = 0; k < 10; k++) t += `D${k + 1} n${k} ${k === 9 ? '0' : 'n' + (k + 1)} D\n`;
    const { op } = solveTimed(parseNetlist(t), '10-diodes-short');
    if (!op.ok) { expect(op.failure!.vars.node).toBeTruthy(); expect(op.failure!.elements.length).toBeGreaterThan(0); }
  });
  it('10 real (Rs 0.568) diodes in series from 12 V through 100 ohm: ~ (12 - 10 Vd)/100', () => {
    let t = 'V1 n0 0 12\nR1 n0 m 100\n.model D D(is=2.52n n=1.752 rs=0.568)\n';
    for (let k = 0; k < 10; k++) t += `D${k + 1} ${k === 0 ? 'm' : 'm' + k} ${k === 9 ? '0' : 'm' + (k + 1)} D\n`;
    const { op, c } = solveTimed(parseNetlist(t), '10-diodes-R'); expect(op.ok).toBe(true);
    expect(elementCurrent(c, op.x, 'D1')).toBeGreaterThan(1e-3);
  });
  it('Zener stepped 0 -> 50 V (1 V steps), warm-started and cold, 5.1 V / Ibv 5 mA / Rs 7, 100 ohm series', () => {
    const cards = (v: number) => `V1 a 0 ${v}\nR1 a k 100\nD1 0 k Z\n.model Z zener(bv=5.1 ibv=5m rs=7 is=1e-14)`;
    let warm: Float64Array | undefined;
    for (let v = 0; v <= 50; v++) {
      const cold = solveTimed(parseNetlist(cards(v)), `zener cold ${v}`); expect(cold.op.ok).toBe(true);
      const w = solveTimed(parseNetlist(cards(v)), `zener warm ${v}`, warm); expect(w.op.ok).toBe(true);
      warm = w.op.x;
      if (v >= 10) {   // Vz = BV + Vt·ln(Iz/Ibv) + Rs·Iz, with Iz = (v − Vz)/100
        const vz = nodeVoltage(w.op.x, w.c.nodeIndex.k), iz = (v - vz) / 100;
        expect(Math.abs(vz - (5.1 + 0.025852 * Math.log(iz / 5e-3) + 7 * iz))).toBeLessThan(0.01);
      }
      if (v <= 3) expect(Math.abs(elementCurrent(w.c, w.op.x, 'D1'))).toBeLessThan(1e-6);
    }
  });
  it('LED array 8 x 3 (8 parallel strings of 3 LEDs + 150 ohm) on a 9 V / 1.7 ohm battery', () => {
    let t = `${LED}\n`;
    for (let s = 0; s < 8; s++) t += `R${s} a x${s}\nD${s}a x${s} y${s} L\nD${s}b y${s} z${s} L\nD${s}c z${s} 0 L\n`.replace(`R${s} a x${s}`, `R${s} a x${s} 150`);
    const nl = parseNetlist(t); bat(nl, 1, 9, 1.7);
    const { op, c } = solveTimed(nl, 'led-array'); expect(op.ok).toBe(true);
    const i0 = elementCurrent(c, op.x, 'D0a');
    for (let s = 1; s < 8; s++) expect(elementCurrent(c, op.x, `D${s}a`)).toBeCloseTo(i0, 9);
    expect(i0).toBeGreaterThan(1e-3);
  });
  it('textbook ideal-diode bridge from a 10 V source: state iteration settles', () => {
    const nl = parseNetlist('V1 p q 10\nD1 p o T\nD2 q o T\nD3 0 p T\nD4 0 q T\nRL o 0 1k\n.model T d07');
    const { op } = solveTimed(nl, 'ideal bridge'); expect(op.ok).toBe(true);
  });
  it('200 seeded random diode / resistor / battery boards: >= 95 % plain Newton, 100 % solved or explained', () => {
    const own: Record<string, number> = { newton: 0, gmin: 0, source: 0, pseudo: 0, explained: 0 };
    let maxIters = 0;
    for (let s = 1; s <= 200; s++) {
      const nl = randomDiodeBoard(new Rng(31000 + s));
      const c = compile(nl), t0 = performance.now(), op = solveOp(c);
      expect(performance.now() - t0, `board ${s} wall`).toBeLessThan(WALL_MS);
      if (op.ok) { own[op.strategy]++; tally[op.strategy]++; maxIters = Math.max(maxIters, op.totalIterations ?? 0); }
      else { own.explained++; tally.explained++; expect(op.failure, `board ${s}`).toMatchObject({ code: 'noConverge', key: 'solve.noConverge' }); expect(op.failure!.nodes.length).toBeGreaterThan(0); }
    }
    console.log('convergence (200 random boards):', JSON.stringify(own), 'max total iterations', maxIters);
    expect(own.newton / 200).toBeGreaterThanOrEqual(0.95);
    expect(own.newton + own.gmin + own.source + own.pseudo + own.explained).toBe(200);
  });
  it('each homotopy stage ALONE (skip the others) on the named cases + 200 random boards: % solved per stage', () => {
    const named: Netlist[] = [];
    { const n = parseNetlist('D1 a 0 D\n.model D D(is=1e-14 n=1)'); bat(n, 1, 9, 1.7); named.push(n); }
    for (const emf of [5, -5, 12]) { const n = parseNetlist('D1 a 0 D\nD2 0 a D\n.model D D(is=1e-14 n=1)'); bat(n, 1, emf, 0.1); named.push(n); }
    { let t = 'V1 n0 0 12\n.model D D(is=2.52n n=1.752 rs=0.568)\n'; for (let k = 0; k < 10; k++) t += `D${k + 1} n${k} ${k === 9 ? '0' : 'n' + (k + 1)} D\n`; named.push(parseNetlist(t)); }
    for (const v of [0, 3, 6, 12, 30, 50]) named.push(parseNetlist(`V1 a 0 ${v}\nR1 a k 100\nD1 0 k Z\n.model Z zener(bv=5.1 ibv=5m rs=7 is=1e-14)`));
    { let t = `${LED}\n`; for (let s = 0; s < 8; s++) t += `R${s} a x${s} 150\nD${s}a x${s} y${s} L\nD${s}b y${s} z${s} L\nD${s}c z${s} 0 L\n`; const n = parseNetlist(t); bat(n, 1, 9, 1.7); named.push(n); }
    named.push(parseNetlist('V1 p q 10\nD1 p o T\nD2 q o T\nD3 0 p T\nD4 0 q T\nRL o 0 1k\n.model T d07'));
    const boards = [...named]; for (let s = 1; s <= 200; s++) boards.push(randomDiodeBoard(new Rng(31000 + s)));
    const stages: { name: OpStrategy; skip: OpStrategy[] }[] = [
      { name: 'newton', skip: ['gmin', 'source', 'pseudo'] }, { name: 'gmin', skip: ['newton', 'source', 'pseudo'] },
      { name: 'source', skip: ['newton', 'gmin', 'pseudo'] }, { name: 'pseudo', skip: ['newton', 'gmin', 'source'] },
    ];
    const pct: Record<string, string> = {};
    for (const st of stages) {
      let ok = 0;
      for (const nl of boards) { const op = solveOp(compile(nl), { skip: st.skip }); if (op.ok) { ok++; expect(op.strategy).toBe(st.name); } else expect(op.failure!.key).toMatch(/^solve\./); }
      pct[st.name] = `${((100 * ok) / boards.length).toFixed(1)}%`;
      expect(ok / boards.length, `stage ${st.name} alone`).toBeGreaterThanOrEqual(st.name === 'newton' ? 0.95 : 0.9);
    }
    console.log(`stage-alone solve rates over ${boards.length} cases:`, JSON.stringify(pct));
  });
  it('maxIter 1 starves plain Newton and gmin stepping: source stepping / pseudo-transient still solve (iteration-count bounded)', () => {
    const c = compile(parseNetlist('V1 a 0 5\nR1 a d 1k\nD1 d 0 Dx\n.model Dx D(is=1e-14 n=1)'));
    const a = solveOp(c, { maxIter: 1 }); expect(a).toMatchObject({ ok: true, strategy: 'source' });
    const b = solveOp(c, { maxIter: 1, skip: ['source'] }); expect(b).toMatchObject({ ok: true, strategy: 'pseudo' });
    expect(a.x[1]).toBeCloseTo(b.x[1], 5);
  });
  it('failure carries the last good state, the worst node and the explainer key (all stages exhausted)', () => {
    const c = compile(parseNetlist('V1 n0 0 12\n.model D D(is=1e-14 n=1)\nD1 n0 n1 D\nD2 n1 n2 D\nD3 n2 0 D'));
    const op = solveOp(c, { maxIter: 2, skip: ['source', 'pseudo'] });
    if (!op.ok) { expect(op.failure).toMatchObject({ code: 'noConverge', key: 'solve.noConverge' }); expect(op.x.length).toBe(c.dim); expect(op.tried).toEqual(['newton', 'gmin']); }
    const u = solveOp(c, { homotopy: false, maxIter: 1 });
    expect(u.ok).toBe(false); expect(u.failure).toMatchObject({ key: 'solve.noConverge' }); expect(u.failure!.nodes.length).toBe(1); expect(u.tried).toEqual(['newton']);
  });
  it('summary (all cases, by strategy that solved them)', () => { console.log('convergence tally (named + random):', JSON.stringify(tally)); });

  it.todo('BJT cross-coupled latch (deterministic state): needs the BJT device (M1-B2)');
  it.todo('BJT Schmitt trigger: needs the BJT device');
  it.todo('3-stage BJT ring oscillator (transient): needs BJT + tran');
  it.todo('MOSFET with a floating gate (expect the floating explainer): needs the MOSFET device');
  it.todo('op-amp comparator with positive feedback / op-amp with no feedback at DC: needs the op-amp macro');
  it.todo('Darlington with 8k/120 ohm, 555 with C = 100 pF, buck at 50 kHz: need those devices + tran');
});

export type { OpStrategy };
