// Ticket 6-6 "Ramp" (DESIGN §2.8 chapter 6). The bench's own function generator: its triangle comes from integrating its square, and the square is a sloppy +-1 V at 1 kHz with +50 mV of DC offset
// (-0.95 / +1.05 V). OUT must be a triangle of 2.0 Vpp (+-10 %) centred on 0 V (+-0.3 V), measured after 60 ms. TL072 on fixed +-12 V rails. The integrator ARRIVES without the resistor across its
// capacitor: nothing sets its DC gain, so the 50 mV offset integrates (50 mV / (11k x 22n) = 207 V/s) and OUT runs down to the -10.5 V swing limit, where the triangle rides clipped. The repair: Rf 56 kohm across C, a DC gain of -5.1.
// Numbers (src/engine/ch6.test.ts against the solver; OA-15 is the same stage with an ideal source): ref Rin 11 kohm, C 22 nF, Rf 56 kohm: 2.03 Vpp (the formula 2 Vin (Rf/Rin) tanh(T / (4 Rf C))
// gives 2.038 V; the generator's 50 ohm adds to Rin) centred on -0.243 V (the bench pin's square is high 1 us less than it is low, so its DC is 48 mV, not 50: -48 mV x 56k / 11.05k);
// the arrival runs down to the -10.5 V limit and its triangle rides there clipped (average -9.9 V); Rf 10 kohm rounds the triangle to 1.48 Vpp and fails.
// How it is measured: Vpp is the bench's `vpp` (max - min) over four whole periods after 60 ms of settling. The 1 ns edge of OA-15's ideal source made a 13 mV, few-ns spike on the output (2.064 V
// raw); here the generator is a bench pin whose edges take 1 us and the bench step is 2 us, so the spike is not there to read (the test checks max - min against the turning points).
// DEVIATIONS from DESIGN (each documented):
//  1. The generator is a bench pin ('pin' with the new `pwm` and `lo`: -0.95 / +1.05 V, 50 ohm), not the player's generator, so its offset cannot be dialled away.
//  2. The bench switches on with the capacitor empty and measures after 60 ms (DESIGN: "steady after 50 ms"; 49 time constants of Rf C = 1.23 ms): long enough for the arrival's
//     drift (207 V/s) to reach the rail, so the bench sees what the customer saw. The centre spec is the window's mean (-0.243 V against +-0.3 V: a 57 mV margin; DESIGN quotes 0.255 V).
//  3. The bin is E24 (11 kohm is E24) and the ceramic E6 capacitors (cap-cer, Sandbox-grade data: CAMPAIGN_BLOCKERS). Rails: two fixed bench supplies.
//  4. A shape spec DESIGN does not have: THD of OUT at most 25 % (the bench's thd over four periods). Without it, pulling the TL072 passed the
//     bench (found by checkAllLevels: deletePart x1 -> runBench): 11 k and 22 nF alone hand the square to OUT, 2.0 Vpp centred at +0.035 V.
//     The square reads 42.9 %, the ref's triangle 12.14 % (an ideal triangle is 12.1 %).
import { eseries } from '../eseries';
import type { LevelDef } from './types';

export const L6_6: LevelDef = {
  id: '6-6', chapter: 6, titleKey: 'ticket.6-6.title', briefKey: 'ticket.6-6.brief', customer: 'ownbench', teaches: ['integrator', 'dc-drift', 'integrator-reset-resistor', 'triangle-from-square'],
  board: {
    w: 24, h: 16,
    connectors: [
      { id: 'VP', pad: [2, 1], role: 'rail' }, { id: 'IN', pad: [2, 8], role: 'source' }, { id: 'VN', pad: [2, 14], role: 'rail' },
      { id: 'OUT', pad: [22, 8], role: 'load' }, { id: 'GND', pad: [22, 14], role: 'ground' },
    ],
  },
  fixed: [],
  // repair: the integrator arrives as 11 kohm in and 22 nF from OUT to the - input, nothing else across the capacitor
  fault: {
    parts: [
      { partId: 'tl072', value: null, variant: 'DIP8', x: 12, y: 6, rot: 0, flip: false },
      { partId: 'res-cf', value: 11e3, variant: '0.25W', x: 5, y: 7, rot: 0, flip: false },
      { partId: 'cap-cer', value: 22e-9, variant: '50V', x: 7, y: 4, rot: 0, flip: false },
    ],
    wires: [
      [[2, 8], [4, 8], [4, 7], [5, 7]], [[9, 7], [12, 7]], [[7, 4], [7, 6], [9, 6], [9, 7]], [[11, 4], [12, 4]], [[12, 4], [12, 6]], [[11, 4], [11, 3], [22, 3], [22, 8]],
      [[12, 8], [10, 8], [10, 13], [22, 13], [22, 14]], [[12, 9], [12, 11], [6, 11], [6, 14], [2, 14]], [[15, 6], [15, 1], [2, 1]],
    ],
    smoked: [],
  },
  supplies: [
    { id: 'psp', kind: 'bench', plus: 'VP', minus: 'GND', fixed: 12 },
    { id: 'psn', kind: 'bench', plus: 'GND', minus: 'VN', fixed: 12 },
    { id: 'sq', kind: 'pin', plus: 'IN', minus: 'GND', v: 1.05, lo: -0.95, rOut: 50, f: 1000, duty: 0.5, pwm: 1 },
  ],
  instruments: { supply: { v: 12, ilim: 0.1 }, scope: { timePerDiv: 2e-4, voltsPerDiv: [1, 1] } },
  bin: [
    { partId: 'tl072', max: 1 },
    { partId: 'res-cf', values: eseries('E24', 1e3, 1e6), variants: ['0.25W'], max: 4 },
    { partId: 'cap-cer', values: [4.7e-9, 10e-9, 22e-9, 47e-9, 100e-9], max: 2 },
  ],
  constraints: { maxParts: 5 },
  bench: {
    h: 2e-6, settle: 0.06, period: 1e-3, measurePeriods: 4, ic: 'zero', ambientC: 25,
    conditions: [{ id: '1 kHz square' }],
    specs: [
      { kind: 'metric', id: 'vpp', probe: 'v(out)', metric: 'vpp', lo: 1.8, hi: 2.2 },
      { kind: 'level', id: 'centre', probe: 'v(out)', lo: -0.3, hi: 0.3 },
      { kind: 'metric', id: 'shape', probe: 'v(out)', metric: 'thd', params: { periods: 4 }, lo: 0, hi: 25 },   // a triangle (ref 12.14 %), not the square passed through (chip pulled: 42.9 %)
      { kind: 'rating', id: 'ratings' },
    ],
    names: { vpp: 'ticket.6-6.spec.vpp', centre: 'ticket.6-6.spec.centre', shape: 'ticket.6-6.spec.shape' },
  },
  live: { frameSim: 0.001, h: 2e-6, thermalSpeed: 6 },
  stars: { head: 'parts', par: { cost: 99, parts: 4, power: 1e9, area: 240 } },
  explain: 'opamp',
  hints: {
    nudge: 'ticket.6-6.hint.nudge',
    equation: { key: 'ticket.6-6.hint.equation', vars: { voff: 0.05, rin: 11e3, c: 22e-9, rf: 56e3 } },
  },
  ref: {
    parts: [
      { partId: 'tl072', value: null, variant: 'DIP8', x: 12, y: 6, rot: 0, flip: false },
      { partId: 'res-cf', value: 11e3, variant: '0.25W', x: 5, y: 7, rot: 0, flip: false },
      { partId: 'cap-cer', value: 22e-9, variant: '50V', x: 7, y: 4, rot: 0, flip: false },
      { partId: 'res-cf', value: 56e3, variant: '0.25W', x: 7, y: 2, rot: 0, flip: false },
    ],
    wires: [
      [[2, 8], [4, 8], [4, 7], [5, 7]], [[9, 7], [12, 7]], [[7, 4], [7, 6], [9, 6], [9, 7]], [[11, 4], [12, 4]], [[12, 4], [12, 6]], [[11, 4], [11, 3], [22, 3], [22, 8]],
      [[12, 8], [10, 8], [10, 13], [22, 13], [22, 14]], [[12, 9], [12, 11], [6, 11], [6, 14], [2, 14]], [[15, 6], [15, 1], [2, 1]],
      [[7, 2], [6, 2], [6, 4], [7, 4]], [[11, 2], [12, 2], [12, 4]],
    ],
  },
  trace: {
    probe: 'v(out)', mode: 'clip', unit: 'V', scale: 1, clip: 'OUT', vdiv: 1, label: 'OUT', times: [0.2e-3, 0.5e-3, 1e-3],
    tube: { kind: 'windows', windows: [{ t0: 0, t1: 1, lo: -1.45, hi: 0.95 }] },
    lockSpecs: ['vpp'],
  },
  onBoard: 'ticket.6-6.onboard',
  specShort: 'ticket.6-6.short',
  scope: 'stretch',
  after: ['6-1'],
  pay: { fee: 1400, perStar: 300 },
  chit: { x: 0.8, y: 0.62 },
  coach: [
    { id: 'power', key: 'coach.6-6.s1', anchor: { target: 'power' }, done: 'powered|benched' },
    { id: 'clip', key: 'coach.6-6.s2', anchor: { target: 'scope' }, done: 'probed|benched', when: 'powered', optional: true },
    { id: 'fix', key: 'coach.6-6.s3', anchor: { target: 'bin', partId: 'res-cf' }, done: 'passed', when: 'powered|benched' },
    { id: 'done', key: 'coach.6-6.s4', anchor: { target: 'chit' }, done: '!passed', when: 'passed' },
  ],
};
