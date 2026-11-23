// Ticket 6-3 "Studio Preamp" (DESIGN §2.8 chapter 6, "Bandwidth"). A studio wants 40 dB, flat from 20 Hz to 20 kHz, from an LM358 (GBW 0.7 MHz) on fixed +-12 V rails. The bench runs an AC analysis
// (a Bode mask on OUT / IN, IN being the preamp's own input pad) and a 1 kHz, 10 mV test tone for the scope. The preamp ARRIVES as one LM358 stage at gain -100 (1 kohm / 100 kohm): its closed-loop
// bandwidth is GBW / noise gain = 0.7 MHz / 101 = 6.9 kHz, so 20 kHz is 9.7 dB down and the treble is dull. The repair: split the gain over both halves of the LM358, two stages of -10.
// Numbers (src/engine/ch6.test.ts against the solver; OA-12 is the same pair of circuits): ref 10k / 100k twice: 40.00 dB at 20 Hz, 39.17 dB at 20 kHz (each stage's noise gain is 11, not 10, so its
// corner is 63.6 kHz, not 70); the arrival 40.0 dB falling to 30.2 dB at 20 kHz; one NE5532 stage at -100 (GBW 12 MHz) gives 39.88 dB at 20 kHz and passes; one stage of -10 gives 20 dB.
// DEVIATIONS from DESIGN (each documented):
//  1. THE MASK IS DESIGN'S FALLBACK, 38.5 - 41 dB, not 39 - 41 dB. Two LM358 stages of -10 give 39.17 dB at 20 kHz: 0.17 dB inside 39 dB (DESIGN's 39.32 dB used a noise gain of 10). The LM358 sheet
//     prints its 0.7 MHz GBW as a typical value only and the resistors are 5 % parts, so 0.17 dB is not a robust pass; DESIGN records 38.5 - 41 dB as the fallback for exactly this case, and the
//     ticket uses it (margin 0.67 dB). The single stage at -100 still misses it by 8.3 dB.
//  2. The mic is a bench pin (10 mV peak at 1 kHz, 150 ohm) with an AC magnitude of 1 for the analysis; the mask reads OUT / IN at the IN pad, so the mic's 150 ohm does not enter the mask.
//  3. Coupling capacitors are left out of the bin: the stage is DC coupled on +-12 V and DESIGN leaves the band below 20 Hz unconstrained. The rails are two fixed bench supplies.
import { eseries } from '../eseries';
import type { LevelDef } from './types';

export const L6_3: LevelDef = {
  id: '6-3', chapter: 6, titleKey: 'ticket.6-3.title', briefKey: 'ticket.6-3.brief', customer: 'studio', teaches: ['gain-bandwidth', 'closed-loop-bandwidth', 'cascading-stages', 'bode-plot'],
  board: {
    w: 24, h: 16,
    connectors: [
      { id: 'VP', pad: [2, 1], role: 'rail' }, { id: 'IN', pad: [2, 8], role: 'source' }, { id: 'VN', pad: [2, 14], role: 'rail' },
      { id: 'OUT', pad: [22, 8], role: 'load' }, { id: 'GND', pad: [22, 14], role: 'ground' },
    ],
  },
  fixed: [],
  // repair: the preamp arrives as one LM358 stage at -100 (1 kohm in, 100 kohm feedback); the second half of the chip is unused
  fault: {
    parts: [
      { partId: 'lm358', value: null, variant: 'DIP8', x: 12, y: 6, rot: 0, flip: false },
      { partId: 'res-cf', value: 1e3, variant: '0.25W', x: 5, y: 7, rot: 0, flip: false },
      { partId: 'res-cf', value: 100e3, variant: '0.25W', x: 7, y: 4, rot: 0, flip: false },
    ],
    wires: [
      [[2, 8], [4, 8], [4, 7], [5, 7]], [[9, 7], [12, 7]], [[7, 4], [7, 6], [9, 6], [9, 7]], [[11, 4], [12, 4], [12, 6]], [[11, 4], [11, 3], [22, 3], [22, 8]],
      [[12, 8], [10, 8], [10, 13], [22, 13], [22, 14]], [[12, 9], [12, 11], [6, 11], [6, 14], [2, 14]], [[15, 6], [15, 1], [2, 1]],
    ],
    smoked: [],
  },
  supplies: [
    { id: 'psp', kind: 'bench', plus: 'VP', minus: 'GND', fixed: 12 },
    { id: 'psn', kind: 'bench', plus: 'GND', minus: 'VN', fixed: 12 },
    { id: 'mic', kind: 'pin', plus: 'IN', minus: 'GND', v: 0, rOut: 150, f: 1000, sine: 0.01, ac: 1 },
  ],
  instruments: { supply: { v: 12, ilim: 0.1 }, scope: { timePerDiv: 2e-4, voltsPerDiv: [1, 1] } },
  bin: [
    { partId: 'lm358', max: 1 }, { partId: 'ne5532', max: 1 },
    { partId: 'res-cf', values: eseries('E12', 1e3, 1e6), variants: ['0.25W'], max: 6 },
  ],
  constraints: { maxParts: 7 },
  bench: {
    h: 1e-5, settle: 0.002, period: 1e-3, measurePeriods: 2, ic: 'op', ambientC: 25,
    conditions: [{ id: 'sweep' }],
    specs: [
      { kind: 'mask', id: 'flat', out: 'out', inp: 'in', regions: [{ f1: 20, f2: 20e3, lo: 38.5, hi: 41 }] },
      { kind: 'metric', id: 'tone', probe: 'v(out)', metric: 'vpp', lo: 1.65, hi: 2.3 },
      { kind: 'rating', id: 'ratings' },
    ],
    names: { flat: 'ticket.6-3.spec.flat', tone: 'ticket.6-3.spec.tone' },
  },
  live: { frameSim: 0.001, h: 1e-5, thermalSpeed: 6 },
  stars: { head: 'cost', par: { cost: 99, parts: 5, power: 1e9, area: 240 } },
  explain: 'opamp',
  hints: {
    nudge: 'ticket.6-3.hint.nudge',
    equation: { key: 'ticket.6-3.hint.equation', vars: { gbw: 0.7e6, gain: 100 } },
  },
  ref: {
    parts: [
      { partId: 'lm358', value: null, variant: 'DIP8', x: 12, y: 6, rot: 0, flip: false },
      { partId: 'res-cf', value: 10e3, variant: '0.25W', x: 5, y: 7, rot: 0, flip: false },
      { partId: 'res-cf', value: 100e3, variant: '0.25W', x: 7, y: 4, rot: 0, flip: false },
      { partId: 'res-cf', value: 10e3, variant: '0.25W', x: 16, y: 2, rot: 0, flip: false },
      { partId: 'res-cf', value: 100e3, variant: '0.25W', x: 16, y: 11, rot: 0, flip: false },
    ],
    wires: [
      [[2, 8], [4, 8], [4, 7], [5, 7]], [[9, 7], [12, 7]], [[7, 4], [7, 6], [9, 6], [9, 7]], [[11, 4], [12, 4], [12, 6]],
      [[12, 8], [10, 8], [10, 13], [22, 13], [22, 14]], [[12, 9], [12, 11], [6, 11], [6, 14], [2, 14]], [[15, 6], [15, 1], [2, 1]],
      [[11, 4], [11, 3], [16, 3], [16, 2]], [[20, 2], [20, 5], [17, 5], [17, 8], [16, 8]], [[15, 8], [16, 8]], [[16, 8], [16, 11]],
      [[20, 11], [20, 8], [22, 8]], [[15, 7], [21, 7], [21, 8], [22, 8]], [[15, 9], [14, 9], [14, 12], [23, 12], [23, 14], [22, 14]],
    ],
  },
  trace: {
    probe: 'v(out)', mode: 'clip', unit: 'V', scale: 1, clip: 'OUT', vdiv: 1, label: 'OUT', times: [0.2e-3, 0.5e-3, 1e-3],
    tube: { kind: 'windows', windows: [{ t0: 0, t1: 1, lo: -1.15, hi: 1.15 }] },
    lockSpecs: ['tone'],
  },
  onBoard: 'ticket.6-3.onboard',
  specShort: 'ticket.6-3.short',
  scope: 'must',
  after: ['6-1'],
  pay: { fee: 1500, perStar: 300 },
  chit: { x: 0.75, y: 0.3 },
  coach: [
    { id: 'power', key: 'coach.6-3.s1', anchor: { target: 'power' }, done: 'powered|benched' },
    { id: 'bench', key: 'coach.6-3.s2', anchor: { target: 'bench' }, done: 'benched', when: 'powered' },
    { id: 'fix', key: 'coach.6-3.s3', anchor: { target: 'part', partId: 'lm358', pin: 'IN2-' }, done: 'passed', when: 'benched' },
    { id: 'done', key: 'coach.6-3.s4', anchor: { target: 'chit' }, done: '!passed', when: 'passed' },
  ],
};
