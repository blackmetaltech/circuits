// Ticket 6-4 "Big Swing" (DESIGN §2.8 chapter 6). A piezo driver must turn a 4 Vpp, 50 kHz sine into 20 Vpp (+-5 %) with at most 3 % distortion: a non-inverting gain of 5 on fixed +-15 V rails,
// into the 47 kohm input of the piezo's power stage. The steepest part of a 10 V-peak sine at 50 kHz climbs 2 pi f Vp = 3.14 V per microsecond. The driver ARRIVES built on an LM741, which can only
// slew 0.5 V/us: the output is a triangle of about 5 Vpp. The repair: the TL072 (20 V/us typical, 8 minimum); it has another pinout (OUT on pin 1, V+ on pin 8), so the wiring moves too.
// Numbers (src/engine/ch6.test.ts against the solver; OA-13 is the same stage): ref TL072, Rf 33 kohm, Rg 8.2 kohm (gain 5.02): 20.05 Vpp, THD 0.1 %; the arrival (LM741, same resistors) 4.9 Vpp of
// triangle, THD 12 %; a wire from IN to OUT gives 4 Vpp.
// DEVIATIONS from DESIGN (each documented):
//  1. DESIGN's second failure ("on +-12 V rails the swing clips") is dropped: the TL072 macro's headroom is the typical 1.5 V, so 10 V peak fits under +-12 V (OA-13, the 0.7 audit). The rails are fixed
//     +-15 V bench supplies (the engine has no IC supply over-voltage check, so the player never sets them).
//  2. The gain pair is 33k / 8.2k from the E12 bin (gain 5.02); DESIGN's 40k / 10k needs E24 or a series pair. The input is a bench pin (2 V peak, 50 kHz, 50 ohm); the load is the 47 kohm fixture.
import { eseries } from '../eseries';
import type { LevelDef } from './types';

export const L6_4: LevelDef = {
  id: '6-4', chapter: 6, titleKey: 'ticket.6-4.title', briefKey: 'ticket.6-4.brief', customer: 'maker', teaches: ['slew-rate', 'full-power-bandwidth', 'non-inverting-amplifier'],
  board: {
    w: 24, h: 16,
    connectors: [
      { id: 'VP', pad: [2, 1], role: 'rail' }, { id: 'IN', pad: [2, 8], role: 'source' }, { id: 'VN', pad: [2, 14], role: 'rail' },
      { id: 'OUT', pad: [22, 8], role: 'load' }, { id: 'GND', pad: [22, 14], role: 'ground' },
    ],
  },
  fixed: [{ uid: 'f1', partId: 'amp-load', value: null, variant: '47k', x: 22, y: 8, rot: 1, flip: false, fixed: true }],
  // repair: the driver arrives on an LM741 (pin 2 -, pin 3 +, pin 4 V-, pin 6 OUT, pin 7 V+), wired as the same non-inverting gain of 5
  fault: {
    parts: [
      { partId: 'lm741', value: null, variant: 'DIP8', x: 12, y: 6, rot: 0, flip: false },
      { partId: 'res-cf', value: 33e3, variant: '0.25W', x: 7, y: 4, rot: 0, flip: false },
      { partId: 'res-cf', value: 8.2e3, variant: '0.25W', x: 5, y: 10, rot: 0, flip: false },
    ],
    wires: [
      [[2, 8], [12, 8]], [[12, 7], [10, 7]], [[7, 4], [7, 6], [10, 6], [10, 7]], [[10, 7], [10, 10], [9, 10]], [[5, 10], [4, 10], [4, 13], [22, 13], [22, 14]],
      [[11, 4], [11, 3], [22, 3], [22, 8]], [[15, 8], [22, 8]], [[12, 9], [12, 11], [6, 11], [6, 14], [2, 14]], [[15, 7], [16, 7], [16, 1], [2, 1]],
    ],
    smoked: [],
  },
  supplies: [
    { id: 'psp', kind: 'bench', plus: 'VP', minus: 'GND', fixed: 15 },
    { id: 'psn', kind: 'bench', plus: 'GND', minus: 'VN', fixed: 15 },
    { id: 'sig', kind: 'pin', plus: 'IN', minus: 'GND', v: 0, rOut: 50, f: 50e3, sine: 2 },
  ],
  instruments: { supply: { v: 15, ilim: 0.1 }, scope: { timePerDiv: 5e-6, voltsPerDiv: [5, 5] } },
  bin: [
    { partId: 'lm741', max: 1 }, { partId: 'tl072', max: 1 },
    { partId: 'res-cf', values: eseries('E12', 1e3, 1e6), variants: ['0.25W'], max: 4 },
  ],
  constraints: { maxParts: 5 },
  bench: {
    h: 1e-7, settle: 2e-4, period: 2e-5, measurePeriods: 4, ic: 'op', ambientC: 25,
    conditions: [{ id: '50 kHz' }],
    specs: [
      { kind: 'metric', id: 'swing', probe: 'v(out)', metric: 'vpp', lo: 19, hi: 21 },
      { kind: 'metric', id: 'thd', probe: 'v(out)', metric: 'thd', params: { periods: 4 }, lo: 0, hi: 3 },
      { kind: 'rating', id: 'ratings' },
    ],
    names: { swing: 'ticket.6-4.spec.swing', thd: 'ticket.6-4.spec.thd' },
  },
  live: { frameSim: 2e-5, h: 1e-7, thermalSpeed: 6 },
  stars: { head: 'cost', par: { cost: 99, parts: 3, power: 1e9, area: 240 } },
  explain: 'opamp',
  hints: {
    nudge: 'ticket.6-4.hint.nudge',
    equation: { key: 'ticket.6-4.hint.equation', vars: { f: 50e3, vp: 10, sr741: 0.5, sr072: 20 } },
  },
  ref: {
    parts: [
      { partId: 'tl072', value: null, variant: 'DIP8', x: 12, y: 6, rot: 0, flip: false },
      { partId: 'res-cf', value: 33e3, variant: '0.25W', x: 7, y: 4, rot: 0, flip: false },
      { partId: 'res-cf', value: 8.2e3, variant: '0.25W', x: 5, y: 10, rot: 0, flip: false },
    ],
    wires: [
      [[2, 8], [12, 8]], [[12, 7], [10, 7]], [[7, 4], [7, 6], [10, 6], [10, 7]], [[10, 7], [10, 10], [9, 10]], [[5, 10], [4, 10], [4, 13], [22, 13], [22, 14]],
      [[11, 4], [12, 4], [12, 6]], [[11, 4], [11, 3], [22, 3], [22, 8]], [[12, 9], [12, 11], [6, 11], [6, 14], [2, 14]], [[15, 6], [15, 1], [2, 1]],
    ],
  },
  trace: {
    probe: 'v(out)', mode: 'clip', unit: 'V', scale: 1, clip: 'OUT', vdiv: 5, label: 'OUT', times: [5e-6, 1e-5, 2e-5],
    tube: { kind: 'windows', windows: [{ t0: 0, t1: 1, lo: -10.5, hi: 10.5 }] },
    lockSpecs: ['swing'],
  },
  onBoard: 'ticket.6-4.onboard',
  specShort: 'ticket.6-4.short',
  scope: 'stretch',
  after: ['6-3'],
  pay: { fee: 1400, perStar: 300 },
  chit: { x: 0.3, y: 0.62 },
  coach: [
    { id: 'power', key: 'coach.6-4.s1', anchor: { target: 'power' }, done: 'powered|benched' },
    { id: 'clip', key: 'coach.6-4.s2', anchor: { target: 'scope' }, done: 'probed|benched', when: 'powered', optional: true },
    { id: 'fix', key: 'coach.6-4.s3', anchor: { target: 'bin', partId: 'tl072' }, done: 'passed', when: 'powered|benched' },
    { id: 'done', key: 'coach.6-4.s4', anchor: { target: 'chit' }, done: '!passed', when: 'passed' },
  ],
};
