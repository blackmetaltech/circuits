// Ticket 4-5 "EB: Zener Regulator" (DESIGN §2.5, §2.8; oracle SC-02). Card: "A 12 V supply, Rs = 300 ohm, a 6 V Zener with Iz,min = 2 mA. Find Iz at RL = 1 kohm and the smallest RL that still regulates."
// Predict: Iz = 14.0 mA (20 mA through Rs, 6 mA into RL), RL,min = 333 ohm (18 mA = 20 - 2 mA into the load), and the Zener's power at no load = 120 mW (graded against the printed problem, 1 % / 5 %).
// Build (textbook bin: exact resistors, an IDEAL 6 V Zener): the 12 V ideal source and the 1 kohm load RL are soldered on (minus ends to GND); the player places the 300 ohm Rs between IN and M and the Zener from M to GND (cathode on M).
// The bench checks I(Rs) = 20.0 mA +-1 % and measures Iz = 14.0 mA.
// Reality check (the debrief, with numbers worked in the engine): a real 1N4733A-style Zener has Zzt = 7 ohm, so OUT moves 7 ohm x 18 mA = 0.13 V across the load range instead of staying put.
// DEVIATIONS from DESIGN: RL is a soldered-on fixture (not a bin part), so the Rs probe `i(@res-exact#2)` (the player's first exact resistor; the fixed RL is #1) is unambiguous; the reality check is a debrief line, not a second build.
import type { LevelDef } from './types';

export const L4_5: LevelDef = {
  id: '4-5', chapter: 4, titleKey: 'ticket.4-5.title', briefKey: 'ticket.4-5.brief', customer: 'exam', teaches: ['zener-regulator', 'zener-current-budget', 'minimum-load-resistance', 'dynamic-resistance'],
  board: {
    w: 24, h: 16,
    connectors: [{ id: 'GND', pad: [10, 12], role: 'ground' }, { id: 'IN', pad: [2, 2], role: 'source' }, { id: 'M', pad: [10, 2], role: 'probe' }],
  },
  fixed: [
    { uid: 'f1', partId: 'ideal-vsource', value: 12, variant: 'ideal', x: 2, y: 2, rot: 1, flip: false, fixed: true },
    { uid: 'f2', partId: 'res-exact', value: 1000, variant: 'ideal', x: 10, y: 2, rot: 1, flip: false, fixed: true },
  ],
  fixedWires: [[[2, 8], [2, 12], [10, 12]], [[10, 6], [10, 12]]],
  supplies: [],
  instruments: { scope: { timePerDiv: 1e-3, voltsPerDiv: [1, 1] } },
  bin: [
    { partId: 'res-exact', values: [150, 200, 300, 330, 470, 560], variants: ['ideal'], max: 1 },
    { partId: 'zener-6v-ideal', variants: ['ideal'], max: 1 },
  ],
  constraints: { maxParts: 2 },
  bench: {
    h: 1e-3, settle: 0, window: 0.002, ic: 'op', ambientC: 25,
    conditions: [{ id: 'nominal' }],
    specs: [
      { kind: 'predict', id: 'piz', entered: 0, of: { probe: 'i(@zener-6v-ideal#1)', metric: 'peak' }, truth: 14, unit: 'mA' },
      { kind: 'predict', id: 'prl', entered: 0, of: { probe: 'v(m)', metric: 'mean' }, truth: 333.33, unit: 'Ω' },
      { kind: 'predict', id: 'ppz', entered: 0, of: { probe: 'v(m)', metric: 'mean' }, truth: 120, unit: 'mW' },
      { kind: 'metric', id: 'irs', probe: 'i(@res-exact#2)', metric: 'peak', lo: 0.0198, hi: 0.0202 },
      { kind: 'rating', id: 'ratings' },
    ],
    names: { irs: 'ticket.4-5.spec.irs', piz: 'ticket.4-5.predict.iz', prl: 'ticket.4-5.predict.rl', ppz: 'ticket.4-5.predict.pz' },
  },
  live: { frameSim: 0.02, h: 2e-3, thermalSpeed: 1 },
  stars: { head: 'parts', par: { cost: 0, parts: 2, power: 0, area: 100 } },
  eb: true,
  explain: 'zenerexam',
  figure: { kind: 'zener', node: 'M', sources: [], load: { name: 'RL', ohm: 1000 }, zener: { volts: 12, rs: 300, vz: 6, izMin: 0.002, rl: 1000 } },
  hints: { nudge: 'ticket.4-5.hint.nudge' },
  ref: {
    parts: [
      { partId: 'res-exact', value: 300, variant: 'ideal', x: 4, y: 2, rot: 0, flip: false },
      { partId: 'zener-6v-ideal', value: null, variant: 'ideal', x: 12, y: 6, rot: 3, flip: false },
    ],
    wires: [[[2, 2], [4, 2]], [[8, 2], [10, 2]], [[10, 2], [12, 2]], [[12, 6], [12, 12], [10, 12]]],
    predictions: { piz: 14, prl: 333.33, ppz: 120 },
  },
  specShort: 'ticket.4-5.short',
  scope: 'must',
  after: ['4-2', '4-3|4-4'],
  pay: { fee: 900, perStar: 150 },
  chit: { x: 0.8, y: 0.42 },
  coach: [
    { id: 'predict', key: 'coach.4-5.s1', anchor: { target: 'chit' }, done: 'predicted' },
    { id: 'build', key: 'coach.4-5.s2', anchor: { target: 'bin', partId: 'zener-6v-ideal' }, done: 'part:res-exact&part:zener-6v-ideal' },
    { id: 'wire', key: 'coach.4-5.s3', anchor: { target: 'connector', connector: 'M' }, done: 'wired&joined:M' },
    { id: 'run-bench', key: 'coach.4-5.s4', anchor: { target: 'bench' }, done: 'benched', when: 'wired&predicted' },
    { id: 'done', key: 'coach.4-5.s5', anchor: { target: 'chit' }, done: '!passed', when: 'passed' },
  ],
};
