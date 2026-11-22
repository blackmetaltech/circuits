// Ticket 5-5 "EB: CE Amplifier" (DESIGN §2.5, §2.8; oracle SC-04). Card: "VCC = 12 V, RB = 565 kohm, RC = 3 kohm, beta = 100, VBE = 0.7 V. Find IB, IC, VCE and the voltage gain."
// Predict: IB = 20.0 uA, IC = 2.00 mA, VCE = 6.00 V, Av = -gm x RC = -232 (gm = IC / 25.85 mV = 77.4 mS); graded against the printed problem (1 % / 5 %).
// Build (textbook bin: exact resistors, the textbook transistor with a fixed 0.7 V drop and beta 100): the 12 V ideal source is soldered on (VCC pad); the player places RB 565 kohm from VCC to the base and RC 3 kohm from VCC to the collector, the emitter to GND.
// The bench checks IC = 2.00 mA and VCE = 6.00 V to +-1 % (the build, with the 0.7 V model, is exact).
// Reality check (the debrief, numbers worked in the engine's own Ebers-Moll law): a real junction drops 0.673 V at 2 mA (not 0.7), so IC reads 2.005 mA, VCE 5.985 V and the gain -232.7; swap beta for 300 and the same base current asks 6 mA of a 12 V / 3 kohm
// collector that can give only about 3.9 mA: the transistor saturates (this is why fixed bias is fragile).
// DEVIATIONS from DESIGN: the +-0.5 % build check of the design is +-1 % here (the exact textbook transistor needs no more; Ic and Vce are the two numbers the board can show); the reality check is a debrief, not a second build; the gain is an exam prediction only (no AC analysis on the exam board).
import type { LevelDef } from './types';

export const L5_5: LevelDef = {
  id: '5-5', chapter: 5, titleKey: 'ticket.5-5.title', briefKey: 'ticket.5-5.brief', customer: 'exam', teaches: ['fixed-bias', 'forced-vs-active', 'gm', 'ce-gain', 'beta-fragility'],
  board: {
    w: 24, h: 16,
    connectors: [{ id: 'GND', pad: [10, 14], role: 'ground' }, { id: 'VCC', pad: [2, 2], role: 'source' }, { id: 'M', pad: [11, 8], role: 'probe' }],
  },
  fixed: [{ uid: 'f1', partId: 'ideal-vsource', value: 12, variant: 'ideal', x: 2, y: 2, rot: 1, flip: false, fixed: true }],
  fixedWires: [[[2, 8], [2, 14], [10, 14]]],
  supplies: [],
  instruments: { scope: { timePerDiv: 1e-3, voltsPerDiv: [1, 1] } },
  bin: [
    { partId: 'res-exact', values: [565e3, 470e3, 330e3, 3e3, 2.2e3, 4.7e3], variants: ['ideal'], max: 2 },
    { partId: 'npn-textbook', variants: ['ideal'], max: 1 },
  ],
  constraints: { maxParts: 3 },
  bench: {
    h: 1e-3, settle: 0, window: 0.002, ic: 'op', ambientC: 25,
    conditions: [{ id: 'nominal' }],
    specs: [
      { kind: 'predict', id: 'pib', entered: 0, of: { probe: 'v(m)', metric: 'mean' }, truth: 20, unit: 'µA' },
      { kind: 'predict', id: 'pic', entered: 0, of: { probe: 'v(m)', metric: 'mean' }, truth: 2, unit: 'mA' },
      { kind: 'predict', id: 'pvce', entered: 0, of: { probe: 'v(m)', metric: 'mean' }, truth: 6, unit: 'V' },
      { kind: 'predict', id: 'pav', entered: 0, of: { probe: 'v(m)', metric: 'mean' }, truth: -232, unit: 'V/V' },
      { kind: 'metric', id: 'ic', probe: 'i(@npn-textbook#1)', metric: 'peak', lo: 0.00198, hi: 0.00202 },
      { kind: 'metric', id: 'vce', probe: 'v(m)', metric: 'mean', lo: 5.94, hi: 6.06 },
      { kind: 'rating', id: 'ratings' },
    ],
    names: { ic: 'ticket.5-5.spec.ic', vce: 'ticket.5-5.spec.vce', pib: 'ticket.5-5.predict.ib', pic: 'ticket.5-5.predict.ic', pvce: 'ticket.5-5.predict.vce', pav: 'ticket.5-5.predict.av' },
  },
  live: { frameSim: 0.02, h: 2e-3, thermalSpeed: 1 },
  stars: { head: 'parts', par: { cost: 0, parts: 3, power: 0, area: 100 } },
  eb: true,
  explain: 'amplifierexam',
  figure: { kind: 'amp', node: 'M', sources: [], load: { name: 'RC', ohm: 3000 }, amp: { vcc: 12, rb: 565e3, rc: 3000, beta: 100, vbe: 0.7 } },
  hints: { nudge: 'ticket.5-5.hint.nudge' },
  ref: {
    parts: [
      { partId: 'res-exact', value: 565e3, variant: 'ideal', x: 4, y: 4, rot: 0, flip: false },
      { partId: 'res-exact', value: 3e3, variant: 'ideal', x: 11, y: 2, rot: 1, flip: false },
      { partId: 'npn-textbook', value: null, variant: 'ideal', x: 11, y: 10, rot: 0, flip: false },
    ],
    wires: [[[2, 2], [2, 4], [4, 4]], [[2, 2], [11, 2]], [[8, 4], [12, 4], [12, 10]], [[11, 6], [11, 8]], [[11, 8], [11, 10]], [[13, 10], [13, 14], [10, 14]]],
    predictions: { pib: 20, pic: 2, pvce: 6, pav: -232 },
  },
  specShort: 'ticket.5-5.short',
  scope: 'must',
  after: ['5-1', '5-2|5-3|5-4'],
  pay: { fee: 1000, perStar: 150 },
  chit: { x: 0.8, y: 0.42 },
  coach: [
    { id: 'predict', key: 'coach.5-5.s1', anchor: { target: 'chit' }, done: 'predicted' },
    { id: 'build', key: 'coach.5-5.s2', anchor: { target: 'bin', partId: 'npn-textbook' }, done: 'part:res-exact&part:npn-textbook' },
    { id: 'wire', key: 'coach.5-5.s3', anchor: { target: 'connector', connector: 'M' }, done: 'wired&joined:M' },
    { id: 'run-bench', key: 'coach.5-5.s4', anchor: { target: 'bench' }, done: 'benched', when: 'wired&predicted' },
    { id: 'done', key: 'coach.5-5.s5', anchor: { target: 'chit' }, done: '!passed', when: 'passed' },
  ],
};
