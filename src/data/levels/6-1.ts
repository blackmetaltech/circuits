// Ticket 6-1 "Mic Preamp" (DESIGN §2.8 chapter 6). A busker's dynamic mic (10 mV peak at 1 kHz through 150 ohm) feeds a TL072 on fixed +-12 V rails; the preamp must give an inverting gain of 47
// (+-5 %), measured as the output swing over twice the 10 mV peak. The preamp ARRIVES with its feedback resistor and its input resistor on the + input and the - input tied to GND: positive feedback,
// so the output latches to a rail and the mic never moves it. The repair: the input and feedback go to the - input, the + input to GND.
// Numbers (src/engine/ch6.test.ts against the solver; OA-10 is the same stage without the mic's 150 ohm): ref Rin 10 kohm, Rf 470 kohm: gain 470k / (10k + 150) = 46.3, OUT 0.926 Vpp (band 0.893 - 0.987,
// margin 0.033 V); the arrival sits on the +10.5 V swing limit (V+ - 1.5 V) and swings nothing; a wire from IN to OUT swings 0.02 V; 100k / 2.2k gives 42.5 (the mic's 150 ohm adds to Rin) and fails.
// DEVIATIONS from DESIGN (each documented; none changes the lesson):
//  1. The mic is a bench pin (SupplyDef 'pin' with `sine`: 10 mV peak, 1 kHz) behind 150 ohm, a dynamic mic's typical impedance (DESIGN gives no source impedance). The 150 ohm adds to Rin, so DESIGN's
//     second pair 100k / 2.2k (-3.3 % on paper) reads -9.5 % here and fails; 470k / 10k still passes. The ticket names the 150 ohm (onBoard).
//  2. The bench measures the size of the gain (the swing), not its sign: a non-inverting stage with gain 48 also passes (the busker hears no polarity). The repair the board asks for is the inverting one.
//  3. A second spec keeps OUT centred (mean within +-1 V): it is what a latched output fails first, and its words name the + input.
//  4. The rails are two fixed bench supplies (+12 V on VP, -12 V on VN): the player cannot over-volt the op-amp (the engine has no IC supply over-voltage check).
import { eseries } from '../eseries';
import type { LevelDef } from './types';

export const L6_1: LevelDef = {
  id: '6-1', chapter: 6, titleKey: 'ticket.6-1.title', briefKey: 'ticket.6-1.brief', customer: 'busker', teaches: ['inverting-amplifier', 'virtual-ground', 'negative-feedback', 'positive-feedback-latch'],
  board: {
    w: 24, h: 16,
    connectors: [
      { id: 'VP', pad: [2, 1], role: 'rail' }, { id: 'IN', pad: [2, 8], role: 'source' }, { id: 'VN', pad: [2, 14], role: 'rail' },
      { id: 'OUT', pad: [22, 8], role: 'load' }, { id: 'GND', pad: [22, 14], role: 'ground' },
    ],
  },
  fixed: [],
  // repair: the preamp arrives with the input resistor and the feedback resistor on the + input (pin 3) and the - input (pin 2) wired to GND
  fault: {
    parts: [
      { partId: 'tl072', value: null, variant: 'DIP8', x: 12, y: 6, rot: 0, flip: false },
      { partId: 'res-cf', value: 10e3, variant: '0.25W', x: 5, y: 7, rot: 0, flip: false },
      { partId: 'res-cf', value: 470e3, variant: '0.25W', x: 7, y: 4, rot: 0, flip: false },
    ],
    wires: [
      [[2, 8], [4, 8], [4, 7], [5, 7]], [[9, 7], [10, 7], [10, 9], [11, 9], [11, 8], [12, 8]], [[7, 4], [7, 6], [9, 6], [9, 7]], [[11, 4], [12, 4], [12, 6]], [[11, 4], [11, 3], [22, 3], [22, 8]],
      [[12, 7], [13, 7], [13, 13], [22, 13], [22, 14]], [[12, 9], [12, 11], [6, 11], [6, 14], [2, 14]], [[15, 6], [15, 1], [2, 1]],
    ],
    smoked: [],
  },
  supplies: [
    { id: 'psp', kind: 'bench', plus: 'VP', minus: 'GND', fixed: 12 },
    { id: 'psn', kind: 'bench', plus: 'GND', minus: 'VN', fixed: 12 },
    { id: 'mic', kind: 'pin', plus: 'IN', minus: 'GND', v: 0, rOut: 150, f: 1000, sine: 0.01 },
  ],
  instruments: { supply: { v: 12, ilim: 0.1 }, scope: { timePerDiv: 2e-4, voltsPerDiv: [0.5, 0.5] } },
  bin: [
    { partId: 'tl072', max: 1 },
    { partId: 'res-cf', values: eseries('E12', 1e3, 1e6), variants: ['0.25W'], max: 4 },
  ],
  constraints: { maxParts: 5 },
  bench: {
    h: 1e-5, settle: 0.002, period: 1e-3, measurePeriods: 2, ic: 'op', ambientC: 25,
    conditions: [{ id: 'mic' }],
    specs: [
      { kind: 'metric', id: 'gain', probe: 'v(out)', metric: 'vpp', lo: 0.893, hi: 0.987 },
      { kind: 'level', id: 'centre', probe: 'v(out)', lo: -1, hi: 1 },
      { kind: 'rating', id: 'ratings' },
    ],
    names: { gain: 'ticket.6-1.spec.gain', centre: 'ticket.6-1.spec.centre' },
  },
  live: { frameSim: 0.001, h: 1e-5, thermalSpeed: 6 },
  stars: { head: 'parts', par: { cost: 99, parts: 3, power: 1e9, area: 240 } },
  explain: 'opamp',
  hints: {
    nudge: 'ticket.6-1.hint.nudge',
    equation: { key: 'ticket.6-1.hint.equation', vars: { rf: 470e3, rin: 10e3, rs: 150 } },
  },
  ref: {
    parts: [
      { partId: 'tl072', value: null, variant: 'DIP8', x: 12, y: 6, rot: 0, flip: false },
      { partId: 'res-cf', value: 10e3, variant: '0.25W', x: 5, y: 7, rot: 0, flip: false },
      { partId: 'res-cf', value: 470e3, variant: '0.25W', x: 7, y: 4, rot: 0, flip: false },
    ],
    wires: [
      [[2, 8], [4, 8], [4, 7], [5, 7]], [[9, 7], [12, 7]], [[7, 4], [7, 6], [9, 6], [9, 7]], [[11, 4], [12, 4], [12, 6]], [[11, 4], [11, 3], [22, 3], [22, 8]],
      [[12, 8], [10, 8], [10, 13], [22, 13], [22, 14]], [[12, 9], [12, 11], [6, 11], [6, 14], [2, 14]], [[15, 6], [15, 1], [2, 1]],
    ],
  },
  trace: {
    probe: 'v(out)', mode: 'clip', unit: 'V', scale: 1, clip: 'OUT', vdiv: 0.5, label: 'OUT', times: [0.2e-3, 0.5e-3, 1e-3],
    tube: { kind: 'windows', windows: [{ t0: 0, t1: 1, lo: -0.4935, hi: 0.4935 }] },   // the swing may not pass 0.987 Vpp (the gain band's top); the lower edge is the gain spec's
    lockSpecs: ['gain', 'centre'],
  },
  onBoard: 'ticket.6-1.onboard',
  specShort: 'ticket.6-1.short',
  scope: 'must',
  after: ['5-4|5-5'],
  pay: { fee: 1400, perStar: 300 },
  chit: { x: 0.2, y: 0.3 },
  coach: [
    { id: 'power', key: 'coach.6-1.s1', anchor: { target: 'power' }, done: 'powered|benched' },
    { id: 'clip', key: 'coach.6-1.s2', anchor: { target: 'scope' }, done: 'probed|benched', when: 'powered', optional: true },
    { id: 'fix', key: 'coach.6-1.s3', anchor: { target: 'part', partId: 'tl072', pin: 'IN1-' }, done: 'passed', when: 'powered|benched' },
    { id: 'done', key: 'coach.6-1.s4', anchor: { target: 'chit' }, done: '!passed', when: 'passed' },
  ],
};
