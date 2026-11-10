// M1-E1 determinism harness: BIT-EXACT waveform goldens for a set of reference boards (DESIGN §9.8, §9.12), run on Node 18 and 22 in CI.
//
// Every board is netlist cards (+ source waves) compiled and simulated by the real engine; each recorded series is hashed over the raw
// Float64 BITS of every sample (so -0 vs 0, 1-ulp drift and NaN payloads all show), folded with core's `hashOf`. The hashes live in
// tests/golden/waveforms-initial.json and are written ONLY by the core mechanism (`GOLDEN_UPDATE=1 pnpm vitest run src/trajectory.golden.test.ts`,
// deliberate rule/physics changes only, the commit says so). INITIAL SET: boards that exist at M1; the per-ticket 10 x {expert, novice, smoker}
// trajectories of DESIGN §9.8 are added when the level data lands.
//
// Also here: an in-process run-twice test and a cross-chunking test (the resumable stepper, restarted from a JSON round trip of its state
// with a fresh workspace after every chunk, is bit-identical to one long run).
import { describe, expect, it } from 'vitest';
import { fileURLToPath } from 'node:url';
import { goldenFile } from '@core/kit/golden';
import { hashOf } from '@core/kit/hash';
import { parseNetlist } from './sim/mna/netlist';
import { compileNetlist } from './sim/mna/compile';
import { makeProbe, runTran, tranAdvance, tranInit, tranWork, type TranOptions } from './sim/mna/tran';
import { bode, logFreqs, makeAc } from './sim/mna/ac';
import { sine, type Wave } from './sim/mna/waveforms';
import type { Circuit } from './sim/mna/types';
import { partById } from './data/parts';

const GOLDEN = fileURLToPath(new URL('../tests/golden/waveforms-initial.json', import.meta.url));
const golden = goldenFile(GOLDEN);

// ---------------------------------------------------------------- hashing
/** Hash of the exact IEEE-754 bits of a series (two 32-bit words per sample, folded through core's hashOf). */
export function bitsHash(xs: ArrayLike<number>): string {
  const f = Float64Array.from(xs as ArrayLike<number>);
  const w = new Uint32Array(f.buffer);
  const parts: string[] = [];
  for (let i = 0; i < w.length; i++) parts.push(w[i].toString(16));
  return hashOf(parts.join(','));
}

// ---------------------------------------------------------------- catalogue-derived cards
const diodeCard = (id: string, name: string): string => {
  const m = partById(id).model;
  return `.model ${name} d (is=${m.Is} n=${m.N} rs=${m.Rs} bv=${m.BV} ibv=${m.Ibv})`;
};
const bjtCard = (id: string, name: string): string => {
  const m = partById(id).model;
  return `.model ${name} npn(is=${m.Is} bf=${m.Bf} br=${m.Br} vaf=${m.Vaf})`;
};
const D4007 = diodeCard('1n4007', 'd1n4007');
const Q3904 = bjtCard('2n3904', 'q3904');
const OA741 = '.model oa741 opamp (a0=2e5 gbw=1e6 sr=0.5e6 rin=2e6 ro=75 isc=0.025 headhi=2 headlo=2)\nVp vp 0 15\nVn vn 0 -15';
const REG5 = '.model r5 reg (vreg=5 vdo=2 ilim=2.1 iqgnd=5m tau=2m thetaja=54 ta=25)';

// ---------------------------------------------------------------- the boards
interface Board {
  id: string;
  cards: string;
  waves?: Record<string, Wave>;
  tran?: TranOptions;
  /** AC sweep out/in nodes and range (the netlist's AC source carries `ac 1`). */
  ac?: { out: string; inp: string; f0: number; f1: number; perDecade: number };
}
const BOARDS: Board[] = [
  { id: 'rc-step', cards: 'V1 in 0 5\nR1 in out 1k\nC1 out 0 1u', tran: { h: 1e-5, tStop: 5e-3, probes: ['v(in)', 'v(out)', 'i(R1)'] } },
  { id: 'rlc-step', cards: 'V1 in 0 5\nR1 in a 10\nL1 a b 1m\nC1 b 0 10u', tran: { h: 2e-6, tStop: 2e-3, probes: ['v(a)', 'v(b)', 'i(L1)'] } },
  {
    id: 'halfwave-cap', waves: { V1: sine(12, 50) },
    cards: `${D4007}\nV1 in 0 0\nD1 in out d1n4007\nC1 out 0 470u\nR1 out 0 1k`,
    tran: { h: 20e-6, tStop: 0.1, probes: ['v(in)', 'v(out)', 'i(D1)'] },
  },
  {
    id: 'bridge-cap', waves: { V1: sine(17, 50) },
    cards: `${D4007}\nV1 sp sn 0\nRw sp a 1.5\nD1 a out d1n4007\nD2 sn out d1n4007\nD3 0 a d1n4007\nD4 0 sn d1n4007\nC1 out 0 1000u\nRL out 0 150`,
    tran: { h: 20e-6, tStop: 0.1, probes: ['v(sp,sn)', 'v(out)', 'i(Rw)'] },
  },
  {
    id: 'wallwart-4-1', waves: { V1: sine(325.27, 50) },
    cards: `${D4007}\nV1 p 0 0\nT1 p 0 se sn ${230 / 12}\nRw se sp 1.5\nD1 sp out d1n4007\nD2 sn out d1n4007\nD3 0 sp d1n4007\nD4 0 sn d1n4007\nC1 out 0 1000u\nI1 out 0 0.1`,
    tran: { h: 40e-6, tStop: 0.1, probes: ['v(p)', 'v(sp,sn)', 'v(out)'] },
  },
  {
    id: 'bjt-ce-amp', waves: { Vs: sine(0.01, 1e3) },
    cards: `V1 vcc 0 12\nVs s 0 0\nCi s b 10u\nR1 vcc b 47k\nR2 b 0 10k\nRC vcc c 2.2k\nRE e 0 1k\nCe e 0 100u\nQ1 c b e q3904\n${Q3904}`,
    tran: { h: 5e-6, tStop: 4e-3, probes: ['v(b)', 'v(c)', 'v(e)', 'i(Q1)'] },
  },
  {
    id: 'sallen-key-opamp', waves: { Vin: sine(1, 1e3) },
    cards: `Vin in 0 dc 0 ac 1\nR1 in n1 10k\nR2 n1 np 10k\nC2 np 0 10n\nC1 n1 out 20n\nU1 np out out vp vn oa741\n${OA741}`,
    tran: { h: 2e-6, tStop: 3e-3, probes: ['v(in)', 'v(np)', 'v(out)'] },
    ac: { out: 'out', inp: 'in', f0: 10, f1: 1e5, perDecade: 40 },
  },
  {
    id: '555-astable',
    cards: 'V1 vcc 0 5\nR1 vcc d 4.7k\nR2 d t 47k\nC1 t 0 100n\nU1 0 t out vcc cv t d vcc ne555\n.model ne555 555 ()',
    tran: { h: 1e-5, tStop: 0.03, probes: ['v(t)', 'v(out)', 'i(U1)'] },
  },
  { id: 'regulator-7805', cards: `V1 in 0 12\nCi in 0 100u\nU1 in 0 out r5\nCo out 0 10u\nRl out 0 50\n${REG5}`, tran: { h: 1e-5, tStop: 5e-3, probes: ['v(in)', 'v(out)', 'i(U1)'] } },
  { id: 'regulator-short-thermal', cards: `Vin in 0 15\nU1 in 0 out r5\nRs out 0 10m\n${REG5}`, tran: { h: 2e-6, tStop: 3e-3, probes: ['v(out)', 'i(U1)'] } },
];

function build(b: Board): Circuit {
  const nl = parseNetlist(b.cards);
  for (const [id, w] of Object.entries(b.waves ?? {})) nl.elements.find((e) => e.id === id)!.wave = w;
  const r = compileNetlist(nl);
  if (!r.ok) throw new Error(`${b.id}: ${JSON.stringify(r.errors)}`);
  return r.circuit;
}

/** Everything hashed for a board: time axis, step stats and every probe (tran), re/im/mag/phase of the sweep (ac). */
function fingerprint(b: Board): Record<string, string | number> {
  const ckt = build(b), out: Record<string, string | number> = {};
  if (b.tran) {
    const r = runTran(ckt, b.tran);
    if (!r.ok) throw new Error(`${b.id}: tran failed ${JSON.stringify(r.failure)}`);
    out['tran.samples'] = r.t.length; out['tran.steps'] = r.stats.steps; out['tran.newtonIters'] = r.stats.newtonIters; out['tran.rejected'] = r.stats.rejected;
    out['tran.t'] = bitsHash(r.t);
    for (const p of b.tran.probes ?? []) out[`tran.${p}`] = bitsHash(r.series[p]);
    out['tran.finalState'] = bitsHash(r.state.state.concat(r.state.x));
  }
  if (b.ac) {
    const ac = makeAc(ckt);
    if (!ac.ok) throw new Error(`${b.id}: AC op failed`);
    const d = bode(ac, b.ac.out, b.ac.inp, logFreqs(b.ac.f0, b.ac.f1, b.ac.perDecade));
    out['ac.points'] = d.f.length; out['ac.f'] = bitsHash(d.f);
    out['ac.re'] = bitsHash(d.h.map((z) => z.re)); out['ac.im'] = bitsHash(d.h.map((z) => z.im));
    out['ac.magDb'] = bitsHash(d.magDb); out['ac.phaseDeg'] = bitsHash(d.phaseDeg);
  }
  return out;
}

describe('golden waveforms (bit-exact; Node 18 and 22 in CI; GOLDEN_UPDATE=1 only for deliberate changes)', () => {
  it('label', () => golden.check('_note', 'INITIAL SET (M1-E1): hashes of Float64 bits per probe; written by GOLDEN_UPDATE only'));
  for (const b of BOARDS) {
    it(`${b.id}`, () => golden.check(b.id, fingerprint(b)), 120000);
  }
});

describe('determinism in-process', () => {
  for (const b of BOARDS) {
    it(`${b.id}: two runs from freshly compiled boards are bit-identical`, () => {
      expect(fingerprint(b)).toEqual(fingerprint(b));
    }, 120000);
  }
});

describe('resumable stepper', () => {
  // Chunk sizes include 1 (a restart after every accepted step) and a prime. After each chunk the state is round-tripped through JSON and a
  // FRESH workspace is built from it, so nothing may hide in the workspace: breakpoints, BE restarts, event refinement and LU caches all rebuild.
  for (const b of BOARDS.filter((x) => x.tran)) {
    for (const k of [1, 7, 64]) {
      it(`${b.id}: chunks of ${k} steps == one long run`, () => {
        const ckt = build(b), o = b.tran!, probes = o.probes ?? [];
        const whole = runTran(ckt, o);
        const init = tranInit(ckt, o);
        expect(init.ok).toBe(true);
        let st = init.st;
        const fns = probes.map((p) => makeProbe(ckt, p));
        const t: number[] = [0], series = probes.map(() => [] as number[]);
        { const x0 = Float64Array.from(st.x); fns.forEach((f, i) => series[i].push(f(x0, st.state))); }
        let guard = 0;
        while (!st.done) {
          const ws = tranWork(ckt, st);
          const r = tranAdvance(ws, st, k, (s) => { t.push(s.t); fns.forEach((f, i) => series[i].push(f(s.x, s.state))); });
          expect(r.failure).toBeNull();
          st = JSON.parse(JSON.stringify(st));
          if (++guard > 1e6) throw new Error('runaway');
        }
        expect(bitsHash(t)).toBe(bitsHash(whole.t));
        probes.forEach((p, i) => expect(bitsHash(series[i]), p).toBe(bitsHash(whole.series[p])));
        expect(st.stats).toEqual(whole.state.stats);
      }, 300000);
    }
  }
});
