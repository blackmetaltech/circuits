// Ticket 2-3 "Black Box" (DESIGN §2.8 chapter 2). The sensor shop wants a sealed module replaced by "one adjustable source plus series resistance". Inside the box (Learner): 12 V,
// 1 kohm series, 2 kohm shunt, 470 ohm out, which is exactly Vth = 8.000 V behind Rth = 1136.7 ohm; the board holds that equivalent source as the fixed part `blackbox` (hidden
// parameters emf and r: Learner 8.000 V / 1136.67 ohm, Engineer seeds). The bench connects the same test load to the box's OUT and to the player's OUT and compares the two
// voltages: |V_yours - V_box| <= 2 % of V_box at 100 ohm, 1 kohm, 10 kohm and open (bench-only `testLoads`, set by the four conditions; the live view has no load on either output).
// The player measures the box with the DMM (open-circuit volts; short-circuit amps by putting the meter across the box as an ammeter), then sets the bench supply (0.01 V steps) and
// builds the series resistance from E24 resistors and a 1 kohm trimmer. The ticket will not bench until the meter has been used (measureFirst).
// Fail (tested): matching only the open-circuit voltage (8.00 V straight to OUT) passes "open" and fails 100 ohm by 1100 %.
// Ref: supply 8.00 V + 1.1 kohm + 33 ohm (1133 ohm, -0.3 %): worst error 0.3 % (100 ohm).
// DEVIATIONS from DESIGN:
//  1. Engineer seeds Vth 4-12 V and Rth 300-3000 ohm (design: "seeded values"): below ~300 ohm, a 100 ohm test load puts more than a quarter watt through any single quarter-watt
//     series resistor, so the ticket would not be solvable from this bin. Hence the design's "Isc above 0.4 A blows the meter fuse" case cannot occur and the DMM has no 10 A range here.
//  2. Head = parts; the reference has 2 parts (1.1 kohm + 33 ohm) and par is 2. One part also passes (7.90 V + 1.1 kohm: worst error 1.8 %), a tighter solution than the reference.
//  3. The 1 kohm trimmer is a 2-pin part set by value in steps of 100 ohm (the shoebox has no screw to turn); E24 resistors cover 10 ohm - 5.1 kohm.
import { eseries } from '../eseries';
import type { LevelDef } from './types';

export const L2_3: LevelDef = {
  id: '2-3', chapter: 2, titleKey: 'ticket.2-3.title', briefKey: 'ticket.2-3.brief', customer: 'sensorshop', teaches: ['thevenin', 'norton', 'open-circuit-voltage', 'short-circuit-current'],
  board: {
    w: 24, h: 16,
    connectors: [
      { id: 'IN', pad: [2, 2], role: 'source' }, { id: 'OUT', pad: [14, 2], role: 'load' }, { id: 'GND', pad: [14, 8], role: 'ground' }, { id: 'BOX', pad: [20, 2], role: 'probe' },
    ],
  },
  // the sealed module stands at the right: its OUT terminal is the BOX pad, its ground terminal is soldered to the GND pad
  fixed: [{ uid: 'f1', partId: 'blackbox', value: null, variant: 'sealed', x: 20, y: 2, rot: 1, flip: false, fixed: true }],
  fixedWires: [[[20, 8], [14, 8]]],
  supplies: [{ id: 'psu', kind: 'bench', plus: 'IN', minus: 'GND' }],
  instruments: { supply: { v: 5, ilim: 0.5 }, scope: { timePerDiv: 1e-3, voltsPerDiv: [2, 1] } },
  bin: [
    { partId: 'res-cf', values: eseries('E24', 10, 5.1e3), variants: ['0.25W'] },
    { partId: 'trimmer', values: [100, 200, 300, 400, 500, 600, 700, 800, 900, 1000], variants: ['0.5W'], max: 1 },
  ],
  constraints: { maxParts: 4 },
  hidden: [
    { id: 'vth', target: 'f1', key: 'emf', learner: 8, seeded: [4, 12] },
    { id: 'rth', target: 'f1', key: 'r', learner: 1136.67, seeded: [300, 3000] },
  ],
  bench: {
    h: 1e-4, settle: 1e-3, window: 1e-3, ic: 'zero', ambientC: 25,
    testLoads: [{ id: 'rl-out', a: 'out', b: '0', r: 1e9 }, { id: 'rl-box', a: 'box', b: '0', r: 1e9 }],
    conditions: [
      { id: 'open circuit', set: [{ target: 'rl-out', key: 'r', value: 1e9 }, { target: 'rl-box', key: 'r', value: 1e9 }] },
      { id: '100 ohm load', set: [{ target: 'rl-out', key: 'r', value: 100 }, { target: 'rl-box', key: 'r', value: 100 }] },
      { id: '1 kilohm load', set: [{ target: 'rl-out', key: 'r', value: 1e3 }, { target: 'rl-box', key: 'r', value: 1e3 }] },
      { id: '10 kilohm load', set: [{ target: 'rl-out', key: 'r', value: 1e4 }, { target: 'rl-box', key: 'r', value: 1e4 }] },
    ],
    specs: [
      { kind: 'match', id: 'match', a: 'v(out)', b: 'v(box)', tol: 0.02 },
      { kind: 'rating', id: 'ratings' },
    ],
    names: { match: 'ticket.2-3.spec.match' },
  },
  live: { frameSim: 0.02, h: 2e-3, thermalSpeed: 6 },
  stars: { head: 'parts', par: { cost: 40, parts: 2, power: 0, area: 40 } },
  measureFirst: true,
  measureFirstKey: 'bench.measureFirst.box',
  explain: 'blackbox',
  hints: {
    nudge: 'ticket.2-3.hint.nudge',
    equation: { key: 'ticket.2-3.hint.equation', vars: { vth: 8, rth: 1136.67 } },
  },
  ref: {
    parts: [
      { partId: 'res-cf', value: 1100, variant: '0.25W', x: 4, y: 2, rot: 0, flip: false },
      { partId: 'res-cf', value: 33, variant: '0.25W', x: 9, y: 2, rot: 0, flip: false },
    ],
    wires: [[[2, 2], [4, 2]], [[8, 2], [9, 2]], [[13, 2], [14, 2]]],
    supply: { v: 8, ilim: 0.5 },
  },
  scope: 'must',
  after: ['2-1'],
  pay: { fee: 700, perStar: 200 },
  chit: { x: 0.28, y: 0.66 },
  coach: [
    { id: 'power', key: 'coach.2-3.s0', anchor: { target: 'power' }, done: 'powered' },
    { id: 'voc', key: 'coach.2-3.s1', anchor: { target: 'dmm' }, done: 'probed' },
    { id: 'isc', key: 'coach.2-3.s2', anchor: { target: 'dmm' }, done: 'shorted', optional: true },
    { id: 'supply', key: 'coach.2-3.s3', anchor: { target: 'supplyv' }, done: 'supplyset', when: 'probed' },
    { id: 'place', key: 'coach.2-3.s4', anchor: { target: 'bin', partId: 'res-cf' }, done: 'part:res-cf|part:trimmer', when: 'probed' },
    { id: 'wire', key: 'coach.2-3.s5', anchor: { target: 'connector', connector: 'OUT' }, done: 'wired&joined:OUT', when: 'probed' },
    { id: 'run-bench', key: 'coach.2-3.s6', anchor: { target: 'bench' }, done: 'benched', when: 'wired&joined:OUT' },
    { id: 'done', key: 'coach.2-3.s7', anchor: { target: 'chit' }, done: '!passed', when: 'passed' },
  ],
};
