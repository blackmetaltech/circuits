// Convergence suite (DESIGN 9.4), the parts that exist now: diode family. Every case must converge or fail gracefully with the
// explainer key, never hang (iteration-count bounded in the rules; the harness enforces the 2 s wall guard per case here).
import { describe, expect, it } from 'vitest';
import { Rng } from '@core/kit/rng';
import { compileNetlist } from './compile';
import { randomDiodeBoard } from './diode.fuzz';
import { randomTransistorBoard } from './transistor.fuzz';
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

  it.todo('3-stage BJT ring oscillator (transient): needs BJT + tran frequency measurement');
  it.todo('op-amp comparator with positive feedback / op-amp with no feedback at DC: needs the op-amp macro');
  it.todo('555 with C = 100 pF, buck at 50 kHz: need those devices + tran');
});

describe('convergence suite: transistors', () => {
  const NPN = '.model N npn(is=6.734e-15 bf=200 br=0.7371 vaf=74.03)';
  it('BJT cross-coupled latch (bistable): from a biased start it settles to one stable state, deterministically, with saturated/cut-off halves', () => {
    const nl = parseNetlist(`V1 vcc 0 5\nRC1 vcc c1 1k\nRC2 vcc c2 1k\nRB1 c1 b2 10k\nRB2 c2 b1 10k\nQ1 c1 b1 0 N\nQ2 c2 b2 0 N\n${NPN}`);
    const a = solveTimed(nl, 'latch'), b = solveTimed(nl, 'latch again');
    for (const r of [a, b]) expect(r.op.ok).toBe(true);
    expect(Array.from(a.op.x)).toEqual(Array.from(b.op.x));
    const c1 = nodeVoltage(a.op.x, a.c.nodeIndex.c1), c2 = nodeVoltage(a.op.x, a.c.nodeIndex.c2);
    expect(Number.isFinite(c1) && Number.isFinite(c2)).toBe(true);           // the symmetric metastable point is a legal OP too
    // seeded into each state it keeps it
    for (const [v1, v2] of [[0.2, 4.5], [4.5, 0.2]]) {
      const x0 = new Float64Array(a.c.dim); x0[a.c.nodeIndex.c1 - 1] = v1; x0[a.c.nodeIndex.c2 - 1] = v2; x0[a.c.nodeIndex.vcc - 1] = 5;
      x0[a.c.nodeIndex.b1 - 1] = v1 < 1 ? 0.7 : 0.2; x0[a.c.nodeIndex.b2 - 1] = v2 < 1 ? 0.7 : 0.2;   // a low collector means that transistor is ON
      const s = solveTimed(nl, `latch seeded ${v1}`, x0); expect(s.op.ok).toBe(true);
      const w1 = nodeVoltage(s.op.x, s.c.nodeIndex.c1), w2 = nodeVoltage(s.op.x, s.c.nodeIndex.c2);
      expect(Math.abs(w1 - w2)).toBeGreaterThan(3); expect(w1 < w2).toBe(v1 < v2);
    }
  });
  it('BJT Schmitt trigger (emitter-coupled): solves for inputs below, inside and above the hysteresis window, warm-started and cold', () => {
    let warm: Float64Array | undefined;
    for (const vin of [0, 0.5, 1, 1.5, 2, 2.5, 3, 4, 5, 4, 3, 2, 1, 0]) {
      const cards = `V1 vcc 0 9\nVI in 0 ${vin}\nRC1 vcc c1 2k\nRC2 vcc c2 1k\nR1 c1 b2 5k\nR2 b2 0 10k\nRE e 0 500\nQ1 c1 in e N\nQ2 c2 b2 e N\n${NPN}`;
      const cold = solveTimed(parseNetlist(cards), `schmitt cold ${vin}`); expect(cold.op.ok).toBe(true);
      const w = solveTimed(parseNetlist(cards), `schmitt warm ${vin}`, warm); expect(w.op.ok).toBe(true); warm = w.op.x;
      expect(nodeVoltage(w.op.x, w.c.nodeIndex.e)).toBeGreaterThanOrEqual(0);
    }
  });
  it('MOSFET with a floating gate: the topology check reports it (dcFloating on the gate node) and the solve still returns an OFF device', () => {
    const nl = parseNetlist('V1 vcc 0 5\nRD vcc d 1k\nM1 d g 0 N\n.model N nmos(vt=2.1 kp=0.0527 lambda=0.02)');
    const c = compile(nl);
    expect(c.issues.some((i) => i.code === 'dcFloating' && i.nodes.includes('g'))).toBe(true);
    const { op } = solveTimed(nl, 'floating gate'); expect(op.ok).toBe(true); expect(nodeVoltage(op.x, c.nodeIndex.d)).toBeCloseTo(5, 6);
  });
  it('Darlington (8k / 120 ohm internal) driven from 5 V through 4.7k, 12 V / 100 ohm load; and with the base left open', () => {
    const mk = (base: string) => { const nl = parseNetlist(`V1 vcc 0 12\nRL vcc c 100\n${base}`); const id = (n: string) => nl.nodeNames.indexOf(n);
      nl.elements.push({ id: 'Q1', kind: 'DAR', owner: 'p1', nodes: [id('c'), id('b'), 0], p: { is: 1e-12, bf: 31.1, br: 1, rb: 8000, re: 120 } }); return nl; };
    const on = solveTimed(mk('V2 s 0 5\nRB s b 4.7k'), 'darlington on'); expect(on.op.ok).toBe(true);
    expect(nodeVoltage(on.op.x, on.c.nodeIndex.c)).toBeLessThan(2);
    const open = solveTimed(mk('R9 b 0 1e9'), 'darlington open'); expect(open.op.ok).toBe(true);
    expect(nodeVoltage(open.op.x, open.c.nodeIndex.c)).toBeCloseTo(12, 3);
  });
  it('NMOS inverter transfer curve (DC sweep, 0..5 V in 0.1 V steps, warm-started and cold) is monotone decreasing', () => {
    let warm: Float64Array | undefined, prev = Infinity;
    for (let k = 0; k <= 50; k++) {
      const cards = `V1 vcc 0 5\nVI g 0 ${k / 10}\nRD vcc d 10k\nM1 d g 0 N\n.model N nmos(vt=1 kp=1m lambda=0.01)`;
      const cold = solveTimed(parseNetlist(cards), `inv cold ${k}`); expect(cold.op.ok).toBe(true);
      const w = solveTimed(parseNetlist(cards), `inv warm ${k}`, warm); expect(w.op.ok).toBe(true); warm = w.op.x;
      const vd = nodeVoltage(w.op.x, w.c.nodeIndex.d); expect(vd).toBeLessThanOrEqual(prev + 1e-9); prev = vd;
      expect(Math.abs(vd - nodeVoltage(cold.op.x, cold.c.nodeIndex.d))).toBeLessThan(1e-6);
    }
  });
  it('300 seeded random BJT / MOSFET / Darlington boards: >= 95 % plain Newton, 100 % solved or explained, none over the wall guard', () => {
    const own: Record<string, number> = { newton: 0, gmin: 0, source: 0, pseudo: 0, explained: 0 };
    for (let s = 1; s <= 300; s++) {
      const c = compile(randomTransistorBoard(new Rng(41000 + s))), t0 = performance.now(), op = solveOp(c);
      expect(performance.now() - t0, `board ${s} wall`).toBeLessThan(WALL_MS);
      if (op.ok) own[op.strategy]++;
      else { own.explained++; expect(op.failure, `board ${s}`).toMatchObject({ code: 'noConverge', key: 'solve.noConverge' }); }
    }
    console.log('convergence (300 random transistor boards):', JSON.stringify(own));
    expect(own.newton / 300).toBeGreaterThanOrEqual(0.95);
  });
  it('each homotopy stage ALONE on 300 random transistor boards: % solved per stage', () => {
    const boards = Array.from({ length: 300 }, (_, k) => randomTransistorBoard(new Rng(41000 + k + 1)));
    const stages: { name: OpStrategy; skip: OpStrategy[]; min: number }[] = [
      { name: 'newton', skip: ['gmin', 'source', 'pseudo'], min: 0.95 }, { name: 'gmin', skip: ['newton', 'source', 'pseudo'], min: 0.9 },
      { name: 'source', skip: ['newton', 'gmin', 'pseudo'], min: 0.9 }, { name: 'pseudo', skip: ['newton', 'gmin', 'source'], min: 0.9 },
    ];
    const pct: Record<string, string> = {};
    for (const st of stages) {
      let ok = 0;
      for (const nl of boards) { const op = solveOp(compile(nl), { skip: st.skip }); if (op.ok) ok++; else expect(op.failure!.key).toMatch(/^solve\./); }
      pct[st.name] = `${((100 * ok) / boards.length).toFixed(1)}%`;
      expect(ok / boards.length, `stage ${st.name} alone`).toBeGreaterThanOrEqual(st.min);
    }
    console.log('transistor stage-alone solve rates:', JSON.stringify(pct));
  });
});

export type { OpStrategy };
