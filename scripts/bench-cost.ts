/**
 * M1-E2: bench-cost. Estimated flops (src/sim/bench/cost.ts, pure) versus measured wall time (performance.now: the ONLY place a clock
 * is read) on the 10 reference boards of src/trajectory.golden.test.ts. Run: `pnpm bench:cost` (vite SSR build, then node).
 *
 * The estimate is made from the compiled circuit and the bench spec ALONE (assumed Newton iterations, no peeking at the run).
 * Time = flops / rate and the rate is machine-dependent, so the rate is calibrated as the median of estimate/time over the boards;
 * the check is that every board is within 2x of that calibration (spread, not absolute speed). Exit code 1 on a miss or when a
 * ticket board exceeds the 1.5e9 gate. Boards are copied from the golden test (keep in sync by hand; the golden file is the master).
 */
import { parseNetlist } from '../src/sim/mna/netlist';
import { compileNetlist } from '../src/sim/mna/compile';
import { runTran, type TranOptions } from '../src/sim/mna/tran';
import { bode, logFreqs, makeAc } from '../src/sim/mna/ac';
import { sine, type Wave } from '../src/sim/mna/waveforms';
import type { Circuit } from '../src/sim/mna/types';
import { partById } from '../src/data/parts';
import { BENCH_FLOP_LIMIT, costGate, estimateCost, type CostCondition } from '../src/sim/bench/cost';

const diodeCard = (id: string, name: string): string => { const m = partById(id).model; return `.model ${name} d (is=${m.Is} n=${m.N} rs=${m.Rs} bv=${m.BV} ibv=${m.Ibv})`; };
const bjtCard = (id: string, name: string): string => { const m = partById(id).model; return `.model ${name} npn(is=${m.Is} bf=${m.Bf} br=${m.Br} vaf=${m.Vaf})`; };
const D4007 = diodeCard('1n4007', 'd1n4007');
const Q3904 = bjtCard('2n3904', 'q3904');
const OA741 = '.model oa741 opamp (a0=2e5 gbw=1e6 sr=0.5e6 rin=2e6 ro=75 isc=0.025 headhi=2 headlo=2)\nVp vp 0 15\nVn vn 0 -15';
const REG5 = '.model r5 reg (vreg=5 vdo=2 ilim=2.1 iqgnd=5m tau=2m thetaja=54 ta=25)';

interface Board { id: string; cards: string; waves?: Record<string, Wave>; tran: TranOptions; ac?: { out: string; inp: string; f0: number; f1: number; perDecade: number } }
const BOARDS: Board[] = [
  { id: 'rc-step', cards: 'V1 in 0 5\nR1 in out 1k\nC1 out 0 1u', tran: { h: 1e-5, tStop: 5e-3 } },
  { id: 'rlc-step', cards: 'V1 in 0 5\nR1 in a 10\nL1 a b 1m\nC1 b 0 10u', tran: { h: 2e-6, tStop: 2e-3 } },
  { id: 'halfwave-cap', waves: { V1: sine(12, 50) }, cards: `${D4007}\nV1 in 0 0\nD1 in out d1n4007\nC1 out 0 470u\nR1 out 0 1k`, tran: { h: 20e-6, tStop: 0.1 } },
  { id: 'bridge-cap', waves: { V1: sine(17, 50) }, cards: `${D4007}\nV1 sp sn 0\nRw sp a 1.5\nD1 a out d1n4007\nD2 sn out d1n4007\nD3 0 a d1n4007\nD4 0 sn d1n4007\nC1 out 0 1000u\nRL out 0 150`, tran: { h: 20e-6, tStop: 0.1 } },
  { id: 'wallwart-4-1', waves: { V1: sine(325.27, 50) }, cards: `${D4007}\nV1 p 0 0\nT1 p 0 se sn ${230 / 12}\nRw se sp 1.5\nD1 sp out d1n4007\nD2 sn out d1n4007\nD3 0 sp d1n4007\nD4 0 sn d1n4007\nC1 out 0 1000u\nI1 out 0 0.1`, tran: { h: 40e-6, tStop: 0.1 } },
  { id: 'bjt-ce-amp', waves: { Vs: sine(0.01, 1e3) }, cards: `V1 vcc 0 12\nVs s 0 0\nCi s b 10u\nR1 vcc b 47k\nR2 b 0 10k\nRC vcc c 2.2k\nRE e 0 1k\nCe e 0 100u\nQ1 c b e q3904\n${Q3904}`, tran: { h: 5e-6, tStop: 4e-3 } },
  { id: 'sallen-key-opamp', waves: { Vin: sine(1, 1e3) }, cards: `Vin in 0 dc 0 ac 1\nR1 in n1 10k\nR2 n1 np 10k\nC2 np 0 10n\nC1 n1 out 20n\nU1 np out out vp vn oa741\n${OA741}`, tran: { h: 2e-6, tStop: 3e-3 }, ac: { out: 'out', inp: 'in', f0: 10, f1: 1e5, perDecade: 40 } },
  { id: '555-astable', cards: 'V1 vcc 0 5\nR1 vcc d 4.7k\nR2 d t 47k\nC1 t 0 100n\nU1 0 t out vcc cv t d vcc ne555\n.model ne555 555 ()', tran: { h: 1e-5, tStop: 0.03 } },
  { id: 'regulator-7805', cards: `V1 in 0 12\nCi in 0 100u\nU1 in 0 out r5\nCo out 0 10u\nRl out 0 50\n${REG5}`, tran: { h: 1e-5, tStop: 5e-3 } },
  { id: 'regulator-short-thermal', cards: `Vin in 0 15\nU1 in 0 out r5\nRs out 0 10m\n${REG5}`, tran: { h: 2e-6, tStop: 3e-3 } },
];

const now = (): number => performance.now();
function build(b: Board): Circuit {
  const nl = parseNetlist(b.cards);
  for (const [id, w] of Object.entries(b.waves ?? {})) nl.elements.find((e) => e.id === id)!.wave = w;
  const r = compileNetlist(nl);
  if (!r.ok) throw new Error(`${b.id}: ${JSON.stringify(r.errors)}`);
  return r.circuit;
}
function run(ckt: Circuit, b: Board): void {
  const r = runTran(ckt, { ...b.tran, probes: [], decimate: 1000000 });
  if (!r.ok) throw new Error(`${b.id}: tran failed`);
  if (b.ac) { const ac = makeAc(ckt); bode(ac, b.ac.out, b.ac.inp, logFreqs(b.ac.f0, b.ac.f1, b.ac.perDecade)); }
}
/** Lower quartile of the timings (ms) after three warm-up runs, repeating until at least `reps` runs AND 250 ms of measured time.
 *  A 2-3 ms board timed five times was all JIT and GC noise (rc-step read 0.26 on CI and 0.86 here on the same code);
 *  more samples of the same run measure the same thing more precisely. The 2x tolerance is unchanged. */
function timeMs(ckt: Circuit, b: Board, reps: number): number {
  for (let i = 0; i < 3; i++) run(ckt, b);
  const xs: number[] = [];
  let total = 0;
  while (xs.length < reps || (total < 250 && xs.length < 400)) { const t0 = now(); run(ckt, b); const dt = now() - t0; xs.push(dt); total += dt; }
  xs.sort((a, c) => a - c);
  return xs[Math.floor(xs.length / 4)];
}
const median = (xs: number[]): number => { const s = xs.slice().sort((a, b) => a - b); return s[Math.floor(s.length / 2)]; };

const rows = BOARDS.map((b) => {
  const ckt = build(b);
  const cond: CostCondition = { h: b.tran.h, tStop: b.tran.tStop, acPoints: b.ac ? logFreqs(b.ac.f0, b.ac.f1, b.ac.perDecade).length : 0 };
  const est = estimateCost(ckt, [cond]);
  return { id: b.id, dim: est.dim, steps: est.steps, linear: est.linear, flops: est.flops, ms: timeMs(ckt, b, 5), gate: costGate(est).ok };
});
const rate = median(rows.map((r) => r.flops / r.ms));   // flop-equivalents per ms on this machine
const pad = (s: string | number, n: number): string => String(s).padEnd(n);
console.log(`${pad('board', 26)}${pad('dim', 5)}${pad('steps', 8)}${pad('est flops', 12)}${pad('est ms', 10)}${pad('meas ms', 10)}ratio`);
let bad = 0;
for (const r of rows) {
  const estMs = r.flops / rate, ratio = estMs / r.ms, ok = ratio <= 2 && ratio >= 0.5;
  if (!ok) bad++;
  console.log(`${pad(r.id, 26)}${pad(r.dim, 5)}${pad(r.steps, 8)}${pad(r.flops.toExponential(2), 12)}${pad(estMs.toFixed(1), 10)}${pad(r.ms.toFixed(1), 10)}${ratio.toFixed(2)}${ok ? '' : '  MISS (outside 2x)'}`);
}
console.log(`calibrated rate: ${(rate / 1e3).toFixed(1)} Mflop-eq/s; gate ${BENCH_FLOP_LIMIT.toExponential(1)} flops = about ${(BENCH_FLOP_LIMIT / rate / 1e3).toFixed(1)} s on this machine`);
const over = rows.filter((r) => !r.gate);
for (const r of over) console.log(`GATE: ${r.id} exceeds ${BENCH_FLOP_LIMIT.toExponential(1)} flops`);
if (bad > 0 || over.length > 0) { console.log(`bench-cost FAILED (${bad} outside 2x, ${over.length} over the gate)`); process.exit(1); }
console.log('bench-cost OK: all 10 boards within 2x, all under the gate');
