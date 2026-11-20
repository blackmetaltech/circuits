// Ticket 2-4 "EB: Slide-wire Potentiometer" (DESIGN §2.5, §2.8; oracle NC-08b). Problem card: "Driver cell 4 V, rheostat 10 ohm, wire 100 cm, 10 ohm. A cell balances at 75.0 cm
// on open circuit and at 67.5 cm when shunted by 4.5 ohm. Find its internal resistance." Predict: gradient 0.02 V/cm, EMF 1.500 V, r = 0.500 ohm.
// Build (textbook bin): the driver cell and the cell under test (EMF 1.5 V, r 0.5 ohm) are fixed on the board with their minus ends / the slide wire already placed; the player
// places the rheostat (5, 10 or 20 ohm: only 10 ohm gives 0.02 V/cm) and the galvanometer and draws the wires: driver + through the rheostat to wire end A, wire end B to GND;
// the cell's + to end A, its - through the galvanometer to the jockey J. The bench checks the BALANCE LENGTHS to +-0.1 cm: two conditions put the fixed wire's jockey at 75.0 cm
// (open circuit) and at 67.5 cm (the 4.5 ohm shunt across the cell, bench-only `testLoads`); the galvanometer must read within 19.5 uA of zero in each (0.1 cm = 2 mV across
// 100.5 ohm = 19.9 uA; the same band as the live LOCK, which shows the open-circuit balance as you slide the jockey).
// DEVIATIONS from DESIGN (as in 1-5): the one-tap "reality check" (an actual driver cell with r = 0.3 ohm) is not built as a UI action; its lesson (the gradient changes, the ratio
// method still gives r) is tested in ch2.test.ts and is in the debrief text and the codex. The three predictions are graded against the textbook values of the printed problem.
import type { LevelDef } from './types';

export const L2_4: LevelDef = {
  id: '2-4', chapter: 2, titleKey: 'ticket.2-4.title', briefKey: 'ticket.2-4.brief', customer: 'exam', teaches: ['potentiometer', 'potential-gradient', 'internal-resistance', 'null-method'],
  board: {
    w: 24, h: 16,
    connectors: [{ id: 'GND', pad: [22, 14], role: 'ground' }],
  },
  fixed: [
    { uid: 'f1', partId: 'ideal-vsource', value: 4, variant: 'ideal', x: 16, y: 14, rot: 0, flip: false, fixed: true },
    { uid: 'f2', partId: 'cell-test', value: null, variant: '1.5V', x: 4, y: 5, rot: 0, flip: false, fixed: true },
    { uid: 'f3', partId: 'slidewire-m', value: null, variant: '100cm', x: 2, y: 12, rot: 0, flip: false, fixed: true },
  ],
  supplies: [],
  instruments: { scope: { timePerDiv: 1e-3, voltsPerDiv: [0.5, 1] } },
  bin: [
    { partId: 'rheostat', values: [5, 10, 20], variants: ['ideal'], max: 1 },
    { partId: 'galvanometer', variants: ['100ohm'], max: 1 },
  ],
  constraints: { maxParts: 2 },
  bench: {
    h: 1e-4, settle: 1e-3, window: 1e-3, ic: 'zero', ambientC: 25,
    testLoads: [{ id: 'shunt', a: '@cell-test#1.+', b: '@cell-test#1.-', r: 1e9 }],
    conditions: [
      { id: 'open circuit', set: [{ target: 'shunt', key: 'r', value: 1e9 }, { target: 'f3', key: 'pos', value: 0.75 }] },
      { id: 'shunted by 4.5 ohm', set: [{ target: 'shunt', key: 'r', value: 4.5 }, { target: 'f3', key: 'pos', value: 0.675 }] },
    ],
    specs: [
      { kind: 'predict', id: 'pgrad', entered: 0, of: { probe: 'v(ep)', metric: 'mean' }, truth: 0.02, unit: 'V/cm' },
      { kind: 'predict', id: 'pemf', entered: 0, of: { probe: 'v(ep)', metric: 'mean' }, truth: 1.5, unit: 'V' },
      { kind: 'predict', id: 'pr', entered: 0, of: { probe: 'v(ep)', metric: 'mean' }, truth: 0.5, unit: 'ohm' },
      { kind: 'level', id: 'ig', probe: 'i(@galvanometer#1)', lo: -19.5e-6, hi: 19.5e-6 },
      { kind: 'rating', id: 'ratings' },
    ],
    names: { ig: 'ticket.2-4.spec.ig', pgrad: 'ticket.2-4.predict.grad', pemf: 'ticket.2-4.predict.emf', pr: 'ticket.2-4.predict.r' },
  },
  live: { frameSim: 0.02, h: 2e-3, thermalSpeed: 1 },
  stars: { head: 'parts', par: { cost: 0, parts: 2, power: 0, area: 160 } },
  eb: true,
  explain: 'pot',
  figure: { kind: 'pot', node: 'wire', sources: [], load: { name: '', ohm: 0 }, pot: { driverV: 4, rheostat: 10, wireCm: 100, wireOhm: 10, l1Cm: 75, l2Cm: 67.5, shunt: 4.5 } },
  hints: { nudge: 'ticket.2-4.hint.nudge' },
  ref: {
    parts: [
      { partId: 'rheostat', value: 10, variant: 'ideal', x: 6, y: 14, rot: 0, flip: false },
      { partId: 'galvanometer', value: null, variant: '100ohm', x: 12, y: 7, rot: 0, flip: false },
    ],
    wires: [
      [[16, 14], [10, 14]], [[6, 14], [2, 14], [2, 12]], [[22, 12], [22, 14]], [[4, 5], [2, 5], [2, 12]], [[10, 5], [10, 7], [12, 7]], [[18, 7], [18, 10], [12, 10]],
    ],
    jockeys: { f3: 750 },
    predictions: { pgrad: 0.02, pemf: 1.5, pr: 0.5 },
  },
  specShort: 'ticket.2-4.short',
  scope: 'must',
  after: ['2-1', '2-2|2-3'],
  pay: { fee: 800, perStar: 150 },
  gauge: { spec: 'ig', unit: 'uA', abs: true },
  chit: { x: 0.64, y: 0.68 },
  coach: [
    { id: 'predict', key: 'coach.2-4.s1', anchor: { target: 'chit' }, done: 'predicted' },
    { id: 'build', key: 'coach.2-4.s2', anchor: { target: 'bin', partId: 'rheostat' }, done: 'part:rheostat&part:galvanometer' },
    { id: 'wire', key: 'coach.2-4.s3', anchor: { target: 'part', partId: 'cell-test', pin: '+' }, done: 'wired&shared:f2.+&shared:f3.J&link:f2.+~f3.A&link:f3.B~GND' },
    { id: 'null', key: 'coach.2-4.s4', anchor: { target: 'jockey' }, done: 'jockey', when: 'wired&powered', optional: true },
    { id: 'power', key: 'coach.2-4.s5', anchor: { target: 'power' }, done: 'powered', when: 'wired' },
    { id: 'run-bench', key: 'coach.2-4.s6', anchor: { target: 'bench' }, done: 'benched', when: 'wired&predicted' },
    { id: 'done', key: 'coach.2-4.s7', anchor: { target: 'chit' }, done: '!passed', when: 'passed' },
  ],
};
