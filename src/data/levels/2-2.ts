// Ticket 2-2 "Cable Fault" (DESIGN §2.8 chapter 2; oracle NC-07). The street's buried telephone cable has shorted somewhere. The loop resistance from the stall to the short is X
// (0.1 ohm per metre, out and back; hidden: Learner 7.5 ohm = 75 m, Engineer seeds 2-20 ohm). The metre bridge: a resistance-box plug R in the left gap (end A to junction C), the cable
// X in the right gap (C to end B), a 100 cm slide wire (10 ohm, fixed on the bench, ends A and B), a galvanometer (100 ohm) from C to the jockey J, and the 2 V cell (with its 1 ohm
// rheostat, a fixture) across A and B. Balance: R / X = l / (100 - l), l = the jockey's distance from A, so X = R (100 - l) / l. Ref: R = 5 ohm, l = 40.0 cm, X = 7.5 ohm, d = 75.0 m.
// SPEC: the galvanometer must read within 10 uA of zero at the SUBMITTED jockey position (the position the part holds when the bench runs), AND the entered distance must be within
// 1 % of X / 0.1 ohm per metre. A wrongly wired bridge never nulls; the formula the wrong way round passes the null and fails the distance. Sensitivity: about 16 uA per mm of
// jockey travel at R = 5 ohm (calibrated in ch2.test.ts), so 10 uA is about 0.6 mm either side of the balance: the null needs the fine control (wheel / arrow keys, 0.1 mm).
// DEVIATIONS from DESIGN:
//  1. The "2 V cell with 1 ohm rheostat" is ONE fixed fixture (a 2 V source behind 1 ohm): the rheostat is not a separate bin part (the player has nothing to decide with it and the
//     rheostat's real job, limiting the wire current, is done). The rheostat appears as a bin part in 2-4, where it sets the potentiometer's gradient.
//  2. The slide wire is fixed on the bench (end A, jockey terminal J, end B are pads the player wires to); the jockey slides along it (`setJockey`, 0.1 mm steps).
//  3. The resistance box is the plugs 1, 2, 5, 10, 20 ohm as a part with a value: at most two (in series they give the sums). The galvanometer is a 100 ohm resistor whose needle (+-50 uA
//     full scale) is drawn from the engine's `galvo.needle`.
//  4. HEAD = accuracy (the answer's error in ppm, the design's leaderboard metric): par 3000 ppm (0.3 %). Engineer's +-0.5 cm jockey READING resolution is not built: the jockey is
//     exact to 0.1 mm for every mode; the "keep the null near the middle" lesson is the codex note and the `accuracy` star.
import type { LevelDef } from './types';

export const L2_2: LevelDef = {
  id: '2-2', chapter: 2, titleKey: 'ticket.2-2.title', briefKey: 'ticket.2-2.brief', customer: 'cablecrew', teaches: ['wheatstone', 'metre-bridge', 'null-method', 'balance-ratio'],
  board: {
    w: 24, h: 16,
    connectors: [{ id: 'GND', pad: [22, 2], role: 'ground' }],
  },
  fixed: [
    { uid: 'f1', partId: 'cell-2v', value: null, variant: '2V', x: 2, y: 2, rot: 0, flip: false, fixed: true },
    { uid: 'f2', partId: 'cable-loop', value: null, variant: 'loop', x: 11, y: 5, rot: 0, flip: false, fixed: true },
    { uid: 'f3', partId: 'slidewire-m', value: null, variant: '100cm', x: 2, y: 11, rot: 0, flip: false, fixed: true },
  ],
  // the cell's minus end is soldered to the GND pad along the top of the board (the lesson is the bridge, not that wire)
  fixedWires: [[[8, 2], [22, 2]]],
  supplies: [],
  instruments: { scope: { timePerDiv: 1e-3, voltsPerDiv: [1, 1] } },
  bin: [
    { partId: 'res-box', values: [1, 2, 5, 10, 20], variants: ['plug'], max: 2 },
    { partId: 'galvanometer', variants: ['100ohm'], max: 1 },
  ],
  constraints: { maxParts: 3 },
  hidden: [{ id: 'x', target: 'f2', key: 'r', learner: 7.5, seeded: [2, 20] }],
  bench: {
    h: 1e-4, settle: 1e-3, window: 1e-3, ic: 'zero', ambientC: 25,
    conditions: [{ id: 'nominal' }],
    specs: [
      { kind: 'level', id: 'ig', probe: 'i(@galvanometer#1)', lo: -10e-6, hi: 10e-6 },
      { kind: 'rating', id: 'ratings' },
    ],
    names: { ig: 'ticket.2-2.spec.ig', dist: 'ticket.2-2.spec.dist' },
  },
  answers: [{ id: 'dist', hidden: 'x', per: 0.1, tol: 0.01, unit: 'm', wire: 'f3' }],
  live: { frameSim: 0.02, h: 2e-3, thermalSpeed: 6 },
  stars: { head: 'accuracy', par: { cost: 600, parts: 2, power: 0, area: 140, accuracy: 3000 } },
  explain: 'bridge',
  hints: {
    nudge: 'ticket.2-2.hint.nudge',
    equation: { key: 'ticket.2-2.hint.equation', vars: { r: 5, l: 40 } },
  },
  ref: {
    parts: [
      { partId: 'res-box', value: 5, variant: 'plug', x: 3, y: 5, rot: 0, flip: false },
      { partId: 'galvanometer', value: null, variant: '100ohm', x: 13, y: 8, rot: 0, flip: false },
    ],
    wires: [
      [[2, 2], [2, 11]], [[22, 11], [22, 2]], [[3, 5], [3, 11], [2, 11]], [[7, 5], [11, 5]], [[17, 5], [20, 5], [20, 11], [22, 11]],
      [[11, 5], [11, 8], [13, 8]], [[19, 8], [19, 10], [12, 10], [12, 9]],
    ],
    jockeys: { f3: 400 },
    predictions: { dist: 75 },
  },
  slots: [{ id: 'plug', partId: 'res-box', a: [3, 5], b: [7, 5], textKey: 'slot.plug' }, { id: 'galvo', partId: 'galvanometer', a: [13, 8], b: [19, 8], textKey: 'slot.galvo' }],
  specShort: 'ticket.2-2.short',
  scope: 'must',
  after: ['2-1'],
  pay: { fee: 600, perStar: 200 },
  nullCheck: { wire: 'f3', faults: [
    { key: 'bridge.fault.cell', need: ['link:f1.+~f3.A', 'link:f3.B~GND'] },
    { key: 'bridge.fault.galvoJ', need: ['shared:f3.J'] },
    { key: 'bridge.fault.galvoC', need: ['shared:f2.1'] },
  ] },
  gauge: { spec: 'ig', unit: 'uA', abs: true },
  chit: { x: 0.62, y: 0.3 },
  coach: [
    { id: 'galvo', key: 'coach.2-2.s1', anchor: { target: 'bin', partId: 'galvanometer' }, done: 'part:galvanometer' },
    { id: 'box', key: 'coach.2-2.s2', anchor: { target: 'bin', partId: 'res-box' }, done: 'part:res-box' },
    { id: 'wire', key: 'coach.2-2.s3', anchor: { target: 'part', partId: 'cable-loop', pin: '1' }, done: 'wired&shared:f2.1&shared:f3.J&link:f1.+~f3.A' },
    { id: 'ground', key: 'coach.2-2.sg', anchor: { target: 'connector', connector: 'GND' }, done: 'link:f3.B~GND', when: 'wired&shared:f2.1&shared:f3.J&link:f1.+~f3.A' },
    { id: 'power', key: 'coach.2-2.s4', anchor: { target: 'power' }, done: 'powered', when: 'wired&link:f3.B~GND' },
    { id: 'null', key: 'coach.2-2.s5', anchor: { target: 'jockey' }, done: 'jockey', when: 'powered' },
    { id: 'answer', key: 'coach.2-2.s6', anchor: { target: 'chit' }, done: 'answered', when: 'powered&jockey' },
    { id: 'run-bench', key: 'coach.2-2.s7', anchor: { target: 'bench' }, done: 'benched', when: 'wired&answered' },
    { id: 'done', key: 'coach.2-2.s8', anchor: { target: 'chit' }, done: '!passed', when: 'passed' },
  ],
};
