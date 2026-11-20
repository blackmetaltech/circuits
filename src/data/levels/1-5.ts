// Ticket 1-5 "EB: Two Batteries" (DESIGN §2.5, §2.8; oracle NC-04). Exam card: E1 = 10 V with R1 = 2 ohm and E2 = 5 V with R2 = 3 ohm feed a common node A, R3 = 6 ohm to ground.
// Predict V(A) = 6.667 V and the current through E2 (0.5556 A INTO E2: it is charging). Build with the textbook bin (ideal sources are fixed on the board, exact resistors),
// then probe. The bench checks V(A) to +-0.1 % and the current into E2 to +-0.1 % (which fixes R1, R2 and R3 together; the design's "I(R3)" check is replaced by it because
// R3 has no fixed part id to probe: the player places all three resistors).
// Not built yet (needs the NiMH cell part): the one-tap "reality check" that swaps E2 for a NiMH cell (r = 0.1 ohm).
import type { LevelDef } from './types';

export const L1_5: LevelDef = {
  id: '1-5', chapter: 1, titleKey: 'ticket.1-5.title', briefKey: 'ticket.1-5.brief', customer: 'exam', teaches: ['kirchhoff', 'superposition', 'charging-cell'],
  board: {
    w: 24, h: 16,
    connectors: [{ id: 'GND', pad: [8, 12], role: 'ground' }, { id: 'A', pad: [8, 6], role: 'probe' }],
  },
  fixed: [
    { uid: 'f1', partId: 'ideal-vsource', value: 10, variant: 'ideal', x: 2, y: 2, rot: 1, flip: false, fixed: true },
    { uid: 'f2', partId: 'ideal-vsource', value: 5, variant: 'ideal', x: 14, y: 2, rot: 1, flip: false, fixed: true },
  ],
  // the exam sets E1 and E2 up for you: both minus ends are already soldered to the GND pad (the lesson is the prediction, not the wiring)
  fixedWires: [[[2, 8], [2, 12], [8, 12]], [[14, 8], [14, 12], [8, 12]]],
  supplies: [],
  instruments: { scope: { timePerDiv: 1e-3, voltsPerDiv: [2, 1] } },
  bin: [{ partId: 'res-exact', values: [2, 3, 6], variants: ['ideal'], max: 3 }],
  constraints: { maxParts: 3 },
  bench: {
    h: 1e-4, settle: 1e-3, window: 1e-3, ic: 'zero', ambientC: 25,
    conditions: [{ id: 'nominal' }],
    specs: [
      { kind: 'predict', id: 'pva', entered: 0, of: { probe: 'v(a)', metric: 'mean' } },
      { kind: 'predict', id: 'pie2', entered: 0, of: { probe: 'i(@ideal-vsource#2)', metric: 'mean' } },
      { kind: 'level', id: 'va', probe: 'v(a)', lo: 6.66, hi: 6.6733 },
      { kind: 'level', id: 'ie2', probe: 'i(@ideal-vsource#2)', lo: 0.5550, hi: 0.5561 },
      { kind: 'rating', id: 'ratings' },
    ],
    names: { va: 'ticket.1-5.spec.va', ie2: 'ticket.1-5.spec.ie2', pva: 'ticket.1-5.predict.va', pie2: 'ticket.1-5.predict.ie2' },
  },
  live: { frameSim: 0.02, h: 2e-3, thermalSpeed: 1 },
  stars: { head: 'parts', par: { cost: 0, parts: 3, power: 0, area: 143 } },
  eb: true,
  figure: { node: 'A', sources: [{ name: 'E1', volts: 10, r: { name: 'R1', ohm: 2 } }, { name: 'E2', volts: 5, r: { name: 'R2', ohm: 3 } }], load: { name: 'R3', ohm: 6 } },
  hints: { nudge: 'ticket.1-5.hint.nudge' },
  ref: {
    parts: [
      { partId: 'res-exact', value: 2, variant: 'ideal', x: 4, y: 2, rot: 0, flip: false },
      { partId: 'res-exact', value: 3, variant: 'ideal', x: 10, y: 4, rot: 0, flip: false },
      { partId: 'res-exact', value: 6, variant: 'ideal', x: 8, y: 7, rot: 1, flip: false },
    ],
    wires: [
      [[2, 2], [4, 2]], [[8, 2], [8, 6]], [[14, 2], [14, 4]], [[10, 4], [10, 6], [8, 6]],
      [[8, 6], [8, 7]], [[8, 11], [8, 12]],
    ],
    predictions: { pva: 6.6667, pie2: 0.5556 },
  },
  scope: 'must',
  after: ['1-4'],
  pay: { fee: 700, perStar: 150 },
  gauge: { spec: 'va', unit: 'V', clip: 'A' },
  chit: { x: 0.62, y: 0.68 },
  coach: [
    { id: 'predict', key: 'coach.1-5.s1', anchor: { target: 'chit' }, done: 'predicted' },
    { id: 'build', key: 'coach.1-5.s2', anchor: { target: 'bin', partId: 'res-exact' }, done: 'part:res-exact' },
    { id: 'wire', key: 'coach.1-5.s3', anchor: { target: 'connector', connector: 'A' }, done: 'wired&joined:A' },
    { id: 'ground', key: 'coach.1-5.sg', anchor: { target: 'connector', connector: 'GND' }, done: 'grounded', when: 'wired&joined:A' },
    { id: 'probe', key: 'coach.1-5.s4', anchor: { target: 'scope' }, done: 'probing', when: 'wired', optional: true },
    { id: 'run-bench', key: 'coach.1-5.s5', anchor: { target: 'bench' }, done: 'benched', when: 'wired&predicted&grounded' },
    { id: 'done', key: 'coach.1-5.s6', anchor: { target: 'chit' }, done: '!passed', when: 'passed' },
  ],
};
