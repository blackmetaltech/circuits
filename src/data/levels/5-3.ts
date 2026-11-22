// Ticket 5-3 "Gate Builder" (DESIGN §2.8 chapter 5). Dev's robotics club needs a NAND gate Y = NOT(A AND B) from loose parts. The bench drives A and B with a real logic low (0.4 V, NOT 0 V) or a high (5 V) through 50 ohm and tries all four vectors: with the output high
// (three vectors) it must hold at least 4.0 V while a 10 kohm fan-out load pulls it down, and with the output low (A = B = 5 V) it must hold at most 0.4 V while a 4.6 kohm resistor from the 5 V rail makes it sink 1 mA.
// Numbers (src/engine/ch5.test.ts against the solver): ref = diode-transistor logic: two input 1N4148 into node P, a 4.7 kohm pull-up to P, two series 1N4148 to the base, 10 kohm base to GND, 2N3904 with a 2.2 kohm collector pull-up: VOH 4.1 V (10 kohm load),
// VOL 0.06 V (1 mA sunk); one level-shift diode already holds a 0.4 V low (P = 0.4 + 0.65 V, the base sees 0.4 V; the second diode is the noise margin, up to a 0.8 V low); no level-shift diodes: a 0.4 V input low still turns the transistor on, VOH collapses; a 47 kohm collector pull-up gives VOH under the 10 kohm load of 0.9 V.
// DEVIATIONS from DESIGN (each documented; none changes the lesson):
//  1. The four input vectors are four bench conditions; the output high / low specs are tied to their conditions (`BenchPlan.only`); the 10 kohm fan-out load and the 1 mA sink are bench test loads (`testLoads`), the board has the 5 V rail as a fixed bench supply.
//  2. The bin has five 1N4148, one 2N3904 and E12 resistors 100 ohm - 100 kohm (at most four); "base pull-down missing: slow or weak turn-off" is a dynamic effect the DC truth table cannot show, so it is a Codex note, not a failing build.
import { eseries } from '../eseries';
import type { LevelDef } from './types';

const vec = (a: number, b: number, high: boolean): { target: string; key: string; value: number }[] => [
  { target: 'pa', key: 'v', value: a }, { target: 'pb', key: 'v', value: b },
  { target: 'tl_fan', key: 'r', value: high ? 10e3 : 1e12 }, { target: 'tl_sink', key: 'r', value: high ? 1e12 : 4.6e3 },
];
const LO = 0.4, HI = 5;

export const L5_3: LevelDef = {
  id: '5-3', chapter: 5, titleKey: 'ticket.5-3.title', briefKey: 'ticket.5-3.brief', customer: 'robotics', teaches: ['diode-logic', 'transistor-not', 'nand-universal', 'logic-levels', 'fan-out'],
  board: {
    w: 24, h: 16,
    connectors: [
      { id: 'VCC', pad: [2, 1], role: 'source' }, { id: 'A', pad: [2, 3], role: 'source' }, { id: 'B', pad: [2, 6], role: 'source' }, { id: 'OUT', pad: [22, 6], role: 'load' }, { id: 'GND', pad: [22, 14], role: 'ground' },
    ],
  },
  fixed: [],
  supplies: [
    { id: 'psu5', kind: 'bench', plus: 'VCC', minus: 'GND', fixed: 5 },
    { id: 'pa', kind: 'pin', plus: 'A', minus: 'GND', v: LO, rOut: 50 },
    { id: 'pb', kind: 'pin', plus: 'B', minus: 'GND', v: LO, rOut: 50 },
  ],
  instruments: { supply: { v: 5, ilim: 0.5 }, scope: { timePerDiv: 1e-3, voltsPerDiv: [1, 1] } },
  bin: [
    { partId: '1n4148', max: 5 }, { partId: '2n3904', max: 1 },
    { partId: 'res-cf', values: eseries('E12', 100, 100e3), variants: ['0.25W'], max: 4 },
  ],
  constraints: { maxParts: 9 },
  bench: {
    h: 1e-3, settle: 0.002, window: 0.002, ic: 'op', ambientC: 25,
    testLoads: [{ id: 'tl_fan', a: 'out', b: '0', r: 10e3 }, { id: 'tl_sink', a: 'vcc', b: 'out', r: 1e12 }],
    conditions: [
      { id: 'A low, B low', set: vec(LO, LO, true) }, { id: 'A low, B high', set: vec(LO, HI, true) }, { id: 'A high, B low', set: vec(HI, LO, true) }, { id: 'A high, B high', set: vec(HI, HI, false) },
    ],
    specs: [
      { kind: 'level', id: 'voh', probe: 'v(out)', lo: 4.0, hi: 5.5 },
      { kind: 'level', id: 'vol', probe: 'v(out)', lo: -0.1, hi: 0.4 },
      { kind: 'rating', id: 'ratings' },
    ],
    only: { voh: ['A low, B low', 'A low, B high', 'A high, B low'], vol: ['A high, B high'] },
    names: { voh: 'ticket.5-3.spec.voh', vol: 'ticket.5-3.spec.vol' },
  },
  live: { frameSim: 0.004, h: 1e-3, thermalSpeed: 6 },
  selectors: [
    { id: 'a', labelKey: 'ticket.5-3.sel.a', initial: 0, options: [{ labelKey: 'ticket.5-3.sel.low', cond: 'A low', set: [{ target: 'pa', key: 'v', value: LO }] }, { labelKey: 'ticket.5-3.sel.high', cond: 'A high', set: [{ target: 'pa', key: 'v', value: HI }] }] },
    { id: 'b', labelKey: 'ticket.5-3.sel.b', initial: 0, options: [{ labelKey: 'ticket.5-3.sel.low', cond: 'B low', set: [{ target: 'pb', key: 'v', value: LO }] }, { labelKey: 'ticket.5-3.sel.high', cond: 'B high', set: [{ target: 'pb', key: 'v', value: HI }] }] },
  ],
  stars: { head: 'parts', par: { cost: 99, parts: 8, power: 1e9, area: 200 } },
  explain: 'gate',
  hints: {
    nudge: 'ticket.5-3.hint.nudge',
    equation: { key: 'ticket.5-3.hint.equation', vars: { vlow: LO, vbe: 0.65, vcc: 5 } },
  },
  ref: {
    parts: [
      { partId: '1n4148', value: null, variant: 'DO35', x: 8, y: 3, rot: 2, flip: false },
      { partId: '1n4148', value: null, variant: 'DO35', x: 8, y: 6, rot: 2, flip: false },
      { partId: 'res-cf', value: 4.7e3, variant: '0.25W', x: 12, y: 2, rot: 1, flip: false },
      { partId: '1n4148', value: null, variant: 'DO35', x: 12, y: 8, rot: 0, flip: false },
      { partId: '1n4148', value: null, variant: 'DO35', x: 18, y: 8, rot: 1, flip: false },
      { partId: 'res-cf', value: 10e3, variant: '0.25W', x: 13, y: 12, rot: 0, flip: false },
      { partId: '2n3904', value: null, variant: 'TO92', x: 20, y: 11, rot: 1, flip: false },
      { partId: 'res-cf', value: 2.2e3, variant: '0.25W', x: 20, y: 5, rot: 1, flip: false },
    ],
    // (every wire joins two legs or a pad and a leg: a drop one pad off a leg snaps to the leg, so no junction pad sits next to a pin)
    wires: [
      [[2, 3], [4, 3]], [[2, 6], [4, 6]], [[8, 3], [8, 6]], [[8, 6], [12, 6]], [[12, 6], [12, 8]], [[16, 8], [18, 8]], [[18, 12], [20, 12]], [[17, 12], [18, 12]], [[13, 12], [13, 15], [22, 15], [22, 14]],
      [[2, 1], [12, 1], [12, 2]], [[12, 2], [20, 2], [20, 5]], [[20, 9], [20, 11]], [[20, 9], [22, 9], [22, 6]], [[20, 13], [20, 14], [22, 14]],
    ],
  },
  gauge: { spec: 'voh', unit: 'V', clip: 'OUT' },
  specShort: 'ticket.5-3.short',
  scope: 'must',
  after: ['5-1'],
  pay: { fee: 1200, perStar: 300 },
  chit: { x: 0.3, y: 0.3 },
  coach: [
    { id: 'place', key: 'coach.5-3.s1', anchor: { target: 'bin', partId: '1n4148' }, done: 'part:1n4148' },
    { id: 'tr', key: 'coach.5-3.s1b', anchor: { target: 'bin', partId: '2n3904' }, done: 'part:2n3904', when: 'part:1n4148' },
    { id: 'wire', key: 'coach.5-3.s2', anchor: { target: 'connector', connector: 'OUT' }, done: 'wired&joined:OUT&joined:A&joined:B', when: 'part:2n3904' },
    { id: 'power', key: 'coach.5-3.s3', anchor: { target: 'power' }, done: 'powered', when: 'wired&joined:OUT' },
    { id: 'run-bench', key: 'coach.5-3.s4', anchor: { target: 'bench' }, done: 'benched', when: 'wired&joined:OUT' },
    { id: 'done', key: 'coach.5-3.s5', anchor: { target: 'chit' }, done: '!passed', when: 'passed' },
  ],
};
