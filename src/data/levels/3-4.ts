// Ticket 3-4 "EB: Capacitor Bank" (DESIGN §2.5, §2.8; oracles CAP-01, CAP-02). Exam card (a): "2 uF in series with (3 uF || 6 uF) across 110 V. Find the charge and the total energy." Card (b): "A 4 uF capacitor at
// 100 V is connected to an uncharged 6 uF. Find the final voltage and the energy lost."
// Predict: Q = 180 uC, U = 9.90 mJ; V = 40.0 V, loss = 12.0 mJ (graded against the printed problem's textbook values, 1 % / 5 %).
// Build (textbook bin: exact capacitors with the built-in 1 Gohm bleeder, DESIGN §3.4): card (a) a 110 V ideal source is fixed on the board with its minus end soldered to GND; the player places the 2 uF between IN and M and
// the 3 uF and 6 uF between M and GND. Card (b): the 4 uF capacitor is soldered on, charged to 100 V (+ on the B pad), and a bench-driven switch (10 ohm, closes at 1 ms) joins the B pad to the D pad; the player places the
// 6 uF between D and GND. The bench measures V(M) = 20.0 V (2 uF carries 180 uC, 90 V), the shared voltage on D (peak 40.0 V) and the energy ledger: the heat in the switch resistance, 12.0 mJ.
// DEVIATIONS from DESIGN (each documented; none changes the lesson):
//  1. The "reality check" (vary R and see the same 12 mJ of heat) is built as the bench's ENERGY LEDGER, not as a free resistor: the switch is fixed at 10 ohm and the ledger spec checks 12.0 mJ +-2 %. The debrief says
//     why R does not matter (the same charge moves whatever the resistance), and the engine test (ch3.test.ts) runs it for 1 ohm, 10 ohm and 1 kohm.
//  2. The 6 uF of card (b) and the 6 uF of card (a) are the same bin entry (two copies, max 2); card (b)'s 4 uF is a fixture, not a bin part.
//  3. The bench window is 8 ms (the switch closes at 1 ms); the V(D) spec is the PEAK (a monotone rise to 40 V), the V(M) spec the mean (20.000 V from the first microsecond).
import type { LevelDef } from './types';

const ms = 1e-3;

export const L3_4: LevelDef = {
  id: '3-4', chapter: 3, titleKey: 'ticket.3-4.title', briefKey: 'ticket.3-4.brief', customer: 'exam', teaches: ['capacitors-series-parallel', 'charge-conservation', 'energy-half-cv2', 'energy-lost-in-switch'],
  board: {
    w: 24, h: 16,
    connectors: [
      { id: 'GND', pad: [10, 12], role: 'ground' }, { id: 'IN', pad: [2, 2], role: 'source' }, { id: 'M', pad: [8, 2], role: 'probe' }, { id: 'B', pad: [14, 2], role: 'source' }, { id: 'D', pad: [20, 2], role: 'probe' },
    ],
  },
  fixed: [
    { uid: 'f1', partId: 'ideal-vsource', value: 110, variant: 'ideal', x: 2, y: 2, rot: 1, flip: false, fixed: true },
    { uid: 'f2', partId: 'cap-charged', value: null, variant: '4uF-100V', x: 14, y: 2, rot: 1, flip: false, fixed: true },
  ],
  fixedWires: [[[2, 8], [2, 12], [10, 12]], [[14, 8], [14, 12], [10, 12]]],
  supplies: [{ id: 'sw', kind: 'contact', plus: 'B', minus: 'D', press: 1 * ms, ron: 10 }],
  instruments: { scope: { timePerDiv: 1e-3, voltsPerDiv: [10, 10] } },
  bin: [
    { partId: 'cap-ideal', values: [2e-6, 3e-6, 4e-6, 6e-6], variants: ['ideal'], max: 4 },
  ],
  constraints: { maxParts: 4 },
  bench: {
    h: 2e-6, settle: 0, window: 8 * ms, ic: 'zero', ambientC: 25,
    conditions: [{ id: 'nominal' }],
    specs: [
      { kind: 'predict', id: 'pq', entered: 0, of: { probe: 'v(m)', metric: 'mean' }, truth: 180, unit: 'µC' },
      { kind: 'predict', id: 'pu', entered: 0, of: { probe: 'v(m)', metric: 'mean' }, truth: 9.9, unit: 'mJ' },
      { kind: 'predict', id: 'pv', entered: 0, of: { probe: 'v(m)', metric: 'mean' }, truth: 40, unit: 'V' },
      { kind: 'predict', id: 'pl', entered: 0, of: { probe: 'v(m)', metric: 'mean' }, truth: 12, unit: 'mJ' },
      { kind: 'level', id: 'vm', probe: 'v(m)', lo: 19.8, hi: 20.2 },
      { kind: 'metric', id: 'vd', probe: 'v(d)', metric: 'max', lo: 39.6, hi: 40.4 },
      { kind: 'metric', id: 'heat', probe: 'p(sw)', metric: 'energy', lo: 11.76e-3, hi: 12.24e-3 },
      { kind: 'rating', id: 'ratings' },
    ],
    names: { vm: 'ticket.3-4.spec.vm', vd: 'ticket.3-4.spec.vd', heat: 'ticket.3-4.spec.heat', pq: 'ticket.3-4.predict.q', pu: 'ticket.3-4.predict.u', pv: 'ticket.3-4.predict.v', pl: 'ticket.3-4.predict.loss' },
  },
  live: { frameSim: 0.02, h: 2e-3, thermalSpeed: 1 },
  stars: { head: 'parts', par: { cost: 0, parts: 4, power: 0, area: 200 } },
  eb: true,
  explain: 'caps',
  figure: { kind: 'caps', node: 'M', sources: [], load: { name: '', ohm: 0 }, caps: { a: { c1: 2, c2: 3, c3: 6, volts: 110 }, b: { c1: 4, v1: 100, c2: 6 } } },
  hints: { nudge: 'ticket.3-4.hint.nudge' },
  ref: {
    parts: [
      { partId: 'cap-ideal', value: 2e-6, variant: 'ideal', x: 4, y: 2, rot: 0, flip: false },
      { partId: 'cap-ideal', value: 3e-6, variant: 'ideal', x: 8, y: 4, rot: 1, flip: false },
      { partId: 'cap-ideal', value: 6e-6, variant: 'ideal', x: 10, y: 4, rot: 1, flip: false },
      { partId: 'cap-ideal', value: 6e-6, variant: 'ideal', x: 20, y: 4, rot: 1, flip: false },
    ],
    wires: [
      [[2, 2], [4, 2]], [[8, 2], [8, 4]], [[8, 2], [10, 2], [10, 4]], [[8, 8], [8, 12], [10, 12]], [[10, 8], [10, 12]], [[20, 2], [20, 4]], [[20, 8], [20, 12], [10, 12]],
    ],
    predictions: { pq: 180, pu: 9.9, pv: 40, pl: 12 },
  },
  specShort: 'ticket.3-4.short',
  scope: 'must',
  after: ['3-1', '3-2|3-3'],
  pay: { fee: 900, perStar: 150 },
  chit: { x: 0.64, y: 0.68 },
  coach: [
    { id: 'predict', key: 'coach.3-4.s1', anchor: { target: 'chit' }, done: 'predicted' },
    { id: 'build', key: 'coach.3-4.s2', anchor: { target: 'bin', partId: 'cap-ideal' }, done: 'part:cap-ideal' },
    { id: 'wire', key: 'coach.3-4.s3', anchor: { target: 'connector', connector: 'M' }, done: 'wired&joined:M&joined:D' },
    { id: 'ground', key: 'coach.3-4.sg', anchor: { target: 'connector', connector: 'GND' }, done: 'grounded', when: 'wired' },
    { id: 'run-bench', key: 'coach.3-4.s4', anchor: { target: 'bench' }, done: 'benched', when: 'wired&predicted&grounded' },
    { id: 'done', key: 'coach.3-4.s5', anchor: { target: 'chit' }, done: '!passed', when: 'passed' },
  ],
};
