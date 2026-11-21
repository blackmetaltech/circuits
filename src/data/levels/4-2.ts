// Ticket 4-2 "Zener Shunt" (DESIGN §2.8 chapter 4). Iris's radio needs a 5.1 V rail from an unregulated 13 - 17 V supply: a series resistor from IN to OUT and a Zener from OUT to GND (cathode on OUT). The customer's radio is a constant-current load of 0 to 30 mA
// (a constant-current stand-in for the radio's audio stage). OUT must stay inside 5.1 V +-5 % (4.845 - 5.355 V) for the input at 13 V and at 17 V and the load at 0 and at 30 mA (four conditions); no part may be over its rating.
// Numbers (src/engine/ch4.test.ts against the solver): the ref 220 ohm 1 W + 1N4733A: OUT 5.09 - 5.19 V in all four tests (Iz 5.9 mA at 13 V / 30 mA, 54 mA at 17 V / no load, Pz 276 mW, P_R 0.64 W); R = 470 (too big) falls to about 4.7 V at 13 V / 30 mA
// (Iz = 0); R = 100 puts the Zener at 119 mA and 0.6 W at 17 V / no load (rated 1.3 W, so it survives, but R itself makes 1.19 W: a 1 W resistor over its rating); a 1/4 W 220 ohm resistor smokes (0.64 W); the BZX55 with R = 220 reads 6.3 V at 17 V / no load
// (its 25 ohm slope: 54 mA x 25 ohm is 1.2 V more than at its 5 mA test current).
// DEVIATIONS from DESIGN (each documented; none changes the lesson):
//  1. The radio is a constant-current load (the same fixture as chapter 4's other loads); DESIGN gives "loads 0 and 30 mA" and does not say what the load is.
//  2. The bin offers E12 47 ohm - 1 kohm in 1/4, 1/2 and 1 W; the Zeners are the two of DESIGN (1N4733A, BZX55C5V1), one of each at most. Stars: head = cost, par = the ref (11 c).
import { eseries } from '../eseries';
import type { LevelDef } from './types';

const psu = (v: number): { target: string; key: string; value: number }[] => [{ target: 'psu', key: 'v', value: v }];
const load = (i: number): { target: string; key: string; value: number }[] => [{ target: 'f1', key: 'i', value: i }];

export const L4_2: LevelDef = {
  id: '4-2', chapter: 4, titleKey: 'ticket.4-2.title', briefKey: 'ticket.4-2.brief', customer: 'radio', teaches: ['zener-breakdown', 'series-resistor-worst-case', 'zener-power'],
  board: {
    w: 24, h: 16,
    connectors: [
      { id: 'IN', pad: [2, 2], role: 'source' }, { id: 'OUT', pad: [22, 2], role: 'load' }, { id: 'GND', pad: [22, 14], role: 'ground' },
    ],
  },
  fixed: [{ uid: 'f1', partId: 'load-cc', value: 0.03, variant: 'cc', x: 22, y: 4, rot: 1, flip: false, fixed: true }],
  fixedWires: [[[22, 2], [22, 4]], [[22, 10], [22, 14]]],
  supplies: [{ id: 'psu', kind: 'bench', plus: 'IN', minus: 'GND', fixed: 13 }],
  instruments: { supply: { v: 13, ilim: 0.5 }, scope: { timePerDiv: 1e-3, voltsPerDiv: [1, 1] } },
  bin: [
    { partId: 'res-cf', values: eseries('E12', 47, 1e3), variants: ['0.25W', '0.5W', '1W'], max: 2 },
    { partId: '1n4733a', max: 1 }, { partId: 'bzx55c5v1', max: 1 },
  ],
  constraints: { maxParts: 4 },
  bench: {
    h: 1e-3, settle: 0.05, window: 0.01, ic: 'zero', ambientC: 25,
    conditions: [
      { id: '13 V, 30 mA', set: [...psu(13), ...load(0.03)] }, { id: '13 V, no load', set: [...psu(13), ...load(0)] },
      { id: '17 V, 30 mA', set: [...psu(17), ...load(0.03)] }, { id: '17 V, no load', set: [...psu(17), ...load(0)] },
    ],
    specs: [
      { kind: 'level', id: 'vout', probe: 'v(out)', lo: 4.845, hi: 5.355 },
      { kind: 'rating', id: 'ratings' },
    ],
    names: { vout: 'ticket.4-2.spec.vout' },
  },
  live: { frameSim: 0.02, h: 2e-3, thermalSpeed: 6 },
  selectors: [
    { id: 'input', labelKey: 'ticket.4-2.sel.input', initial: 0, options: [{ labelKey: 'ticket.4-2.sel.input.13', set: psu(13) }, { labelKey: 'ticket.4-2.sel.input.17', set: psu(17) }] },
    { id: 'load', labelKey: 'ticket.4-2.sel.load', initial: 0, options: [{ labelKey: 'ticket.4-2.sel.load.30', set: load(0.03) }, { labelKey: 'ticket.4-2.sel.load.0', set: load(0) }] },
  ],
  stars: { head: 'cost', par: { cost: 11, parts: 2, power: 1e9, area: 120 } },
  explain: 'zener',
  hints: {
    nudge: 'ticket.4-2.hint.nudge',
    equation: { key: 'ticket.4-2.hint.equation', vars: { vz: 5.1, vlo: 13, vhi: 17, il: 0.03, izmin: 0.005 } },
  },
  ref: {
    parts: [
      { partId: 'res-cf', value: 220, variant: '1W', x: 4, y: 2, rot: 0, flip: false },
      { partId: '1n4733a', value: null, variant: 'DO41', x: 12, y: 8, rot: 3, flip: false },
    ],
    wires: [],
  },
  specShort: 'ticket.4-2.short',
  scope: 'must',
  after: ['4-1'],
  pay: { fee: 900, perStar: 200 },
  gauge: { spec: 'vout', unit: 'V', clip: 'OUT' },
  chit: { x: 0.56, y: 0.27 },
  coach: [
    { id: 'place', key: 'coach.4-2.s1', anchor: { target: 'bin', partId: 'res-cf' }, done: 'part:res-cf' },
    { id: 'zener', key: 'coach.4-2.s1b', anchor: { target: 'bin', partId: '1n4733a' }, done: 'part:1n4733a|part:bzx55c5v1', when: 'part:res-cf' },
    { id: 'wire', key: 'coach.4-2.s2', anchor: { target: 'connector', connector: 'OUT' }, done: 'wired&joined:OUT', when: 'part:1n4733a|part:bzx55c5v1' },
    { id: 'power', key: 'coach.4-2.s3', anchor: { target: 'power' }, done: 'powered', when: 'wired' },
    { id: 'clip', key: 'coach.4-2.s4', anchor: { target: 'scope' }, done: 'probing', when: 'powered' },
    { id: 'run-bench', key: 'coach.4-2.s5', anchor: { target: 'bench' }, done: 'benched', when: 'wired' },
    { id: 'done', key: 'coach.4-2.s6', anchor: { target: 'chit' }, done: '!passed', when: 'passed' },
  ],
};
