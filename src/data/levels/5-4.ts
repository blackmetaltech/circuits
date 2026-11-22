// Ticket 5-4 "Synth Preamp" (DESIGN §2.8 chapter 5). Juno's music shop: a synth line-out (600 ohm source, 100 mV peak at 1 kHz) must be turned up about tenfold into a 47 kohm amplifier input, from a 9 V supply, with one transistor. The gain from the source's EMF must be
// between 8.5 and 11 (|Av| = the output swing over twice the 0.1 V peak) with THD at most 5 %. The bench repeats the test with the transistor's current gain beta at the bottom, the middle and the top of its datasheet range (100 / 200 / 300): a bias that
// leans on beta makes the gain wander out of the band.
// Numbers (src/engine/ch5.test.ts against the solver): ref R1 68 kohm, R2 10 kohm, RC 4.7 kohm, RE 390 ohm, 10 uF in and out, 2N3904: gain 9.4 / 9.5 / 9.6 (beta 100 / 200 / 300), THD 0.3 %; RE = 0 (RC only, base bias by R1 alone): the gain is huge and the
// output clips; bias by one resistor (R1 only): the gain wanders with beta; coupling caps the wrong way round vent.
// DEVIATIONS from DESIGN (each documented; none changes the lesson):
//  1. The beta sweep is a formal bench condition (`{ target: '*tol', key: 'Bf', value: -1 | 0 | 1 }`), not the star-3 Monte Carlo of the design: every pass must survive beta 100 - 300 (the design makes the sweep a star-3 requirement; a bias that depends on beta would then pass with star 1 only).
//  2. The source is a bench pin (SupplyDef 'pin' with `sine`: 0.1 V peak, 1 kHz, 600 ohm); the 47 kohm load is the catalogue fixture `amp-load`. The electrolytics are the catalogue's `cap-el` (values below 220 uF are generic game values: CAMPAIGN_BLOCKERS).
//  3. Stars: head = parts, par = 8 parts. The 9 V supply is a fixed bench rail on the VCC pad.
import { eseries } from '../eseries';
import type { LevelDef } from './types';

const beta = (k: number): { target: string; key: string; value: number }[] => [{ target: '*tol', key: 'Bf', value: k }];

export const L5_4: LevelDef = {
  id: '5-4', chapter: 5, titleKey: 'ticket.5-4.title', briefKey: 'ticket.5-4.brief', customer: 'musician', teaches: ['ce-amplifier', 'voltage-divider-bias', 'emitter-degeneration', 'coupling-caps', 'input-impedance'],
  board: {
    w: 24, h: 16,
    connectors: [
      { id: 'VCC', pad: [2, 1], role: 'source' }, { id: 'IN', pad: [2, 8], role: 'source' }, { id: 'OUT', pad: [22, 8], role: 'load' }, { id: 'GND', pad: [22, 14], role: 'ground' },
    ],
  },
  fixed: [{ uid: 'f1', partId: 'amp-load', value: null, variant: '47k', x: 22, y: 8, rot: 1, flip: false, fixed: true }],
  supplies: [
    { id: 'psu9', kind: 'bench', plus: 'VCC', minus: 'GND', fixed: 9 },
    { id: 'src', kind: 'pin', plus: 'IN', minus: 'GND', v: 0, rOut: 600, f: 1000, sine: 0.1 },
  ],
  instruments: { supply: { v: 9, ilim: 0.2 }, scope: { timePerDiv: 5e-4, voltsPerDiv: [0.5, 0.5] } },
  bin: [
    { partId: '2n3904', max: 1 }, { partId: 'bc547b', max: 1 },
    { partId: 'res-cf', values: eseries('E12', 100, 1e6), variants: ['0.25W'], max: 5 },
    { partId: 'cap-el', values: [1e-6, 2.2e-6, 4.7e-6, 10e-6, 22e-6, 47e-6, 100e-6], variants: ['16V', '25V'], max: 3 },
  ],
  constraints: { maxParts: 9 },
  bench: {
    h: 2e-5, settle: 0.02, period: 1e-3, measurePeriods: 4, ic: 'op', ambientC: 25,
    conditions: [{ id: 'beta 200', set: beta(0) }, { id: 'beta 100', set: beta(-1) }, { id: 'beta 300', set: beta(1) }],
    specs: [
      { kind: 'metric', id: 'gain', probe: 'v(out)', metric: 'vpp', lo: 1.7, hi: 2.2 },
      { kind: 'metric', id: 'thd', probe: 'v(out)', metric: 'thd', params: { periods: 4 }, lo: 0, hi: 5 },
      { kind: 'rating', id: 'ratings' },
    ],
    names: { gain: 'ticket.5-4.spec.gain', thd: 'ticket.5-4.spec.thd' },
  },
  live: { frameSim: 0.001, h: 2e-5, thermalSpeed: 6 },
  selectors: [
    { id: 'beta', labelKey: 'ticket.5-4.sel.beta', initial: 0, options: [{ labelKey: 'ticket.5-4.sel.beta.200', set: beta(0) }, { labelKey: 'ticket.5-4.sel.beta.100', set: beta(-1) }, { labelKey: 'ticket.5-4.sel.beta.300', set: beta(1) }] },
  ],
  stars: { head: 'parts', par: { cost: 99, parts: 8, power: 1e9, area: 240 } },
  explain: 'amp',
  hints: {
    nudge: 'ticket.5-4.hint.nudge',
    equation: { key: 'ticket.5-4.hint.equation', vars: { rc: 4700, re: 390, ie: 0.00128, rs: 600, rin: 7900 } },
  },
  ref: {
    parts: [
      { partId: 'res-cf', value: 68e3, variant: '0.25W', x: 8, y: 3, rot: 1, flip: false },
      { partId: 'res-cf', value: 10e3, variant: '0.25W', x: 8, y: 9, rot: 1, flip: false },
      { partId: '2n3904', value: null, variant: 'TO92', x: 12, y: 8, rot: 1, flip: false },
      { partId: 'res-cf', value: 4.7e3, variant: '0.25W', x: 12, y: 3, rot: 1, flip: false },
      { partId: 'res-cf', value: 390, variant: '0.25W', x: 12, y: 11, rot: 1, flip: false },
      { partId: 'cap-el', value: 10e-6, variant: '16V', x: 6, y: 8, rot: 2, flip: false },
      { partId: 'cap-el', value: 10e-6, variant: '16V', x: 14, y: 8, rot: 0, flip: false },
    ],
    // (every wire joins two legs or a pad and a leg: a drop one pad off a leg snaps to the leg, so no junction pad sits next to a pin)
    wires: [
      [[2, 1], [8, 1], [8, 3]], [[8, 3], [12, 3]], [[8, 7], [8, 9]], [[8, 9], [12, 9]], [[6, 8], [6, 7], [8, 7]], [[2, 8], [4, 8]],
      [[12, 7], [12, 8]], [[12, 8], [14, 8]], [[16, 8], [22, 8]], [[12, 10], [12, 11]], [[12, 15], [22, 15], [22, 14]], [[8, 13], [8, 15], [12, 15]],
    ],
  },
  trace: {
    probe: 'v(out)', mode: 'clip', unit: 'V', scale: 1, clip: 'OUT', vdiv: 0.5, label: 'OUT', times: [0.5e-3, 1e-3, 2e-3],
    tube: { kind: 'windows', windows: [{ t0: 0, t1: 1, lo: -1.12, hi: 1.12 }] },   // the swing may not pass 2.2 Vpp (the gain band's top); the lower edge (1.7 Vpp) is the gain spec's
    lockSpecs: ['gain'],   // (the distortion is checked by the formal bench: its FFT needs whole periods)
  },
  specShort: 'ticket.5-4.short',
  scope: 'must',
  after: ['5-1'],
  pay: { fee: 1300, perStar: 300 },
  chit: { x: 0.3, y: 0.3 },
  coach: [
    { id: 'place', key: 'coach.5-4.s1', anchor: { target: 'bin', partId: '2n3904' }, done: 'part:2n3904|part:bc547b' },
    { id: 'bias', key: 'coach.5-4.s2', anchor: { target: 'bin', partId: 'res-cf' }, done: 'part:res-cf', when: 'part:2n3904|part:bc547b' },
    { id: 'wire', key: 'coach.5-4.s3', anchor: { target: 'connector', connector: 'IN' }, done: 'wired&joined:IN&joined:OUT', when: 'part:res-cf' },
    { id: 'power', key: 'coach.5-4.s4', anchor: { target: 'power' }, done: 'powered', when: 'wired&joined:OUT' },
    { id: 'clip', key: 'coach.5-4.s4b', anchor: { target: 'scope' }, done: 'probing', when: 'powered', optional: true },
    { id: 'run-bench', key: 'coach.5-4.s5', anchor: { target: 'bench' }, done: 'benched', when: 'wired&joined:OUT' },
    { id: 'done', key: 'coach.5-4.s6', anchor: { target: 'chit' }, done: '!passed', when: 'passed' },
  ],
};
