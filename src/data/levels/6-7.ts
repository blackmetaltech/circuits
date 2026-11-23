// Ticket 6-7 "EB: Summing Amp" (DESIGN §2.5, §2.8; oracle OA-03 plus saturation). Card: "Inputs 1.0 V through 10 kohm, 2.0 V through 5 kohm, -0.5 V through 20 kohm; Rf = 10 kohm; +-15 V supply.
// Find Vout. What if every input doubles? Triples?"
// Predict: Vout = -Rf (V1/R1 + V2/R2 + V3/R3) = -10k x (0.1 + 0.4 - 0.025) mA = -4.750 V; doubled -9.500 V; tripled -14.25 V (inside the +-15 V rails, so the textbook op-amp reaches it). Graded against the
// printed problem (1 % / 5 %).
// Build (textbook bin: exact resistors and the textbook op-amp, gain 1e6, output to the rails): the three sources are soldered on (V1, V2, V3 with their minus ends on GND), the rails are fixed +-15 V
// bench supplies on VP / VN. The bench runs the card three times (inputs x1, x2, x3) and checks OUT (pad M) to +-1 %: -4.75, -9.50 and -14.25 V.
// Reality check (the debrief): a TL072 on +-15 V swings to within about 1.5 V of each rail, so the tripled case clips at about -13.5 V, not -14.25 V.
// DEVIATIONS from DESIGN: the +-1 % build check (the textbook op-amp needs no more); the TL072 case is a debrief line, not a second build.
import type { LevelDef } from './types';

const times = (k: number): { target: string; key: string; value: number }[] => [{ target: 'f1', key: 'emf', value: 1.0 * k }, { target: 'f2', key: 'emf', value: 2.0 * k }, { target: 'f3', key: 'emf', value: -0.5 * k }];

export const L6_7: LevelDef = {
  id: '6-7', chapter: 6, titleKey: 'ticket.6-7.title', briefKey: 'ticket.6-7.brief', customer: 'exam', teaches: ['summing-amplifier', 'virtual-ground', 'superposition', 'output-saturation'],
  board: {
    w: 24, h: 16,
    connectors: [{ id: 'GND', pad: [10, 14], role: 'ground' }, { id: 'VP', pad: [22, 2], role: 'rail' }, { id: 'VN', pad: [22, 15], role: 'rail' }, { id: 'M', pad: [20, 8], role: 'probe' }],
  },
  fixed: [
    { uid: 'f1', partId: 'ideal-vsource', value: 1.0, variant: 'ideal', x: 2, y: 2, rot: 1, flip: false, fixed: true },
    { uid: 'f2', partId: 'ideal-vsource', value: 2.0, variant: 'ideal', x: 4, y: 2, rot: 1, flip: false, fixed: true },
    { uid: 'f3', partId: 'ideal-vsource', value: -0.5, variant: 'ideal', x: 6, y: 2, rot: 1, flip: false, fixed: true },
  ],
  fixedWires: [[[2, 8], [2, 14], [4, 14]], [[4, 8], [4, 14]], [[4, 14], [6, 14]], [[6, 8], [6, 14]], [[6, 14], [10, 14]]],
  supplies: [
    { id: 'psp', kind: 'bench', plus: 'VP', minus: 'GND', fixed: 15 },
    { id: 'psn', kind: 'bench', plus: 'GND', minus: 'VN', fixed: 15 },
  ],
  instruments: { supply: { v: 15, ilim: 0.1 }, scope: { timePerDiv: 1e-3, voltsPerDiv: [5, 5] } },
  bin: [
    { partId: 'res-exact', values: [2e3, 5e3, 10e3, 15e3, 20e3], variants: ['ideal'], max: 4 },
    { partId: 'opamp-textbook', variants: ['ideal'], max: 1 },
  ],
  constraints: { maxParts: 5 },
  bench: {
    h: 1e-3, settle: 0, window: 0.002, ic: 'op', ambientC: 25,
    conditions: [{ id: 'inputs x1', set: times(1) }, { id: 'inputs x2', set: times(2) }, { id: 'inputs x3', set: times(3) }],
    specs: [
      { kind: 'predict', id: 'pv1', entered: 0, of: { probe: 'v(m)', metric: 'mean' }, truth: -4.75, unit: 'V' },
      { kind: 'predict', id: 'pv2', entered: 0, of: { probe: 'v(m)', metric: 'mean' }, truth: -9.5, unit: 'V' },
      { kind: 'predict', id: 'pv3', entered: 0, of: { probe: 'v(m)', metric: 'mean' }, truth: -14.25, unit: 'V' },
      { kind: 'level', id: 'v1', probe: 'v(m)', lo: -4.7975, hi: -4.7025 },
      { kind: 'level', id: 'v2', probe: 'v(m)', lo: -9.595, hi: -9.405 },
      { kind: 'level', id: 'v3', probe: 'v(m)', lo: -14.3925, hi: -14.1075 },
      { kind: 'rating', id: 'ratings' },
    ],
    only: { v1: ['inputs x1'], v2: ['inputs x2'], v3: ['inputs x3'] },
    names: { v1: 'ticket.6-7.spec.v1', v2: 'ticket.6-7.spec.v2', v3: 'ticket.6-7.spec.v3', pv1: 'ticket.6-7.predict.v1', pv2: 'ticket.6-7.predict.v2', pv3: 'ticket.6-7.predict.v3' },
  },
  live: { frameSim: 0.02, h: 2e-3, thermalSpeed: 1 },
  selectors: [
    { id: 'inputs', labelKey: 'ticket.6-7.sel.inputs', initial: 0, options: [
      { labelKey: 'ticket.6-7.sel.x1', cond: 'inputs x1', set: times(1) }, { labelKey: 'ticket.6-7.sel.x2', cond: 'inputs x2', set: times(2) }, { labelKey: 'ticket.6-7.sel.x3', cond: 'inputs x3', set: times(3) },
    ] },
  ],
  stars: { head: 'parts', par: { cost: 0, parts: 5, power: 0, area: 100 } },
  eb: true,
  explain: 'opamp',
  figure: {
    kind: 'sum', node: 'M',
    sources: [{ name: 'V1', volts: 1.0, r: { name: 'R1', ohm: 10e3 } }, { name: 'V2', volts: 2.0, r: { name: 'R2', ohm: 5e3 } }, { name: 'V3', volts: -0.5, r: { name: 'R3', ohm: 20e3 } }],
    load: { name: 'Rf', ohm: 10e3 },
    sum: { rails: 15 },
  },
  hints: { nudge: 'ticket.6-7.hint.nudge' },
  ref: {
    parts: [
      { partId: 'res-exact', value: 10e3, variant: 'ideal', x: 8, y: 1, rot: 0, flip: false },
      { partId: 'res-exact', value: 5e3, variant: 'ideal', x: 8, y: 3, rot: 0, flip: false },
      { partId: 'res-exact', value: 20e3, variant: 'ideal', x: 8, y: 5, rot: 0, flip: false },
      { partId: 'opamp-textbook', value: null, variant: 'ideal', x: 14, y: 6, rot: 0, flip: false },
      { partId: 'res-exact', value: 10e3, variant: 'ideal', x: 13, y: 12, rot: 0, flip: false },
    ],
    wires: [
      [[2, 2], [2, 1], [8, 1]], [[4, 2], [5, 2], [5, 3], [8, 3]], [[6, 2], [7, 2], [7, 5], [8, 5]],
      [[12, 1], [13, 1], [13, 3]], [[12, 3], [13, 3]], [[13, 3], [13, 5]], [[12, 5], [13, 5]], [[13, 5], [13, 7]], [[13, 7], [14, 7]],
      [[13, 7], [12, 7], [12, 12], [13, 12]], [[17, 12], [20, 12], [20, 8]], [[17, 8], [20, 8]],
      [[14, 8], [11, 8], [11, 14], [10, 14]], [[14, 9], [14, 10], [19, 10], [19, 15], [22, 15]], [[17, 7], [19, 7], [19, 2], [22, 2]],
    ],
    predictions: { pv1: -4.75, pv2: -9.5, pv3: -14.25 },
  },
  specShort: 'ticket.6-7.short',
  scope: 'must',
  after: ['6-1', '6-2|6-3|6-5'],
  pay: { fee: 1200, perStar: 200 },
  chit: { x: 0.8, y: 0.42 },
  coach: [
    { id: 'predict', key: 'coach.6-7.s1', anchor: { target: 'chit' }, done: 'predicted' },
    { id: 'build', key: 'coach.6-7.s2', anchor: { target: 'bin', partId: 'opamp-textbook' }, done: 'part:res-exact&part:opamp-textbook' },
    { id: 'wire', key: 'coach.6-7.s3', anchor: { target: 'connector', connector: 'M' }, done: 'wired&joined:M' },
    { id: 'run-bench', key: 'coach.6-7.s4', anchor: { target: 'bench' }, done: 'benched', when: 'wired&predicted' },
    { id: 'done', key: 'coach.6-7.s5', anchor: { target: 'chit' }, done: '!passed', when: 'passed' },
  ],
};
