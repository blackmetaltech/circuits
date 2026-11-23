// Ticket 6-2 "Sensor Buffer" (DESIGN §2.8 chapter 6). A pH probe is an EMF of 0.2 - 1.0 V DC behind 100 kohm; the meter's input stage must read exactly 2 x EMF (+-1 %) on a TL072 with fixed +-12 V
// rails. The bench tries the EMF at 0.2, 0.6 and 1.0 V. The meter ARRIVES as an inverting stage (Rin 10 kohm, Rf 20 kohm): the probe's 100 kohm adds to Rin, so it reads -20k / 110k = -0.18 of the EMF,
// 9 % of what it should and the wrong sign. The repair: a non-inverting stage, whose + input draws no current, so the 100 kohm drops nothing.
// Numbers (src/engine/ch6.test.ts against the solver; OA-11 is the same stage): ref non-inverting 10k / 10k: 0.4000 / 1.2000 / 2.0000 V (gain 2 / (1 + 2 / A0)); the arrival -0.0364 / -0.109 / -0.182 V;
// a wire from IN to OUT reads 1 x EMF; a follower reads 1 x EMF; an inverting 1M / 2.2M reads -2 x EMF (the right size, the wrong sign) and fails.
// DEVIATIONS from DESIGN (each documented; none changes the lesson):
//  1. The probe is a bench pin (SupplyDef 'pin', DC) behind 100 kohm; the three EMFs are bench conditions and a live switch. Input bias current is not modelled (Codex note: a TL072's 65 pA would drop 6.5 uV).
//  2. The rails are two fixed bench supplies (+12 V on VP, -12 V on VN). Stars: head = cost.
import { eseries } from '../eseries';
import type { LevelDef } from './types';

const emf = (v: number): { target: string; key: string; value: number }[] => [{ target: 'ph', key: 'v', value: v }];

export const L6_2: LevelDef = {
  id: '6-2', chapter: 6, titleKey: 'ticket.6-2.title', briefKey: 'ticket.6-2.brief', customer: 'phlab', teaches: ['non-inverting-amplifier', 'input-impedance', 'buffer'],
  board: {
    w: 24, h: 16,
    connectors: [
      { id: 'VP', pad: [2, 1], role: 'rail' }, { id: 'IN', pad: [2, 8], role: 'source' }, { id: 'VN', pad: [2, 14], role: 'rail' },
      { id: 'OUT', pad: [22, 8], role: 'load' }, { id: 'GND', pad: [22, 14], role: 'ground' },
    ],
  },
  fixed: [],
  // repair: the meter arrives as an inverting stage, Rin 10 kohm from IN to the - input, Rf 20 kohm from OUT to the - input, + to GND
  fault: {
    parts: [
      { partId: 'tl072', value: null, variant: 'DIP8', x: 12, y: 6, rot: 0, flip: false },
      { partId: 'res-cf', value: 10e3, variant: '0.25W', x: 5, y: 7, rot: 0, flip: false },
      { partId: 'res-cf', value: 20e3, variant: '0.25W', x: 7, y: 4, rot: 0, flip: false },
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
    { id: 'ph', kind: 'pin', plus: 'IN', minus: 'GND', v: 1.0, rOut: 100e3 },
  ],
  instruments: { supply: { v: 12, ilim: 0.1 }, scope: { timePerDiv: 1e-3, voltsPerDiv: [0.5, 0.5] } },
  bin: [
    { partId: 'tl072', max: 1 },
    { partId: 'res-cf', values: eseries('E12', 1e3, 1e6), variants: ['0.25W'], max: 4 },
  ],
  constraints: { maxParts: 5 },
  bench: {
    h: 1e-4, settle: 0.001, window: 0.002, ic: 'op', ambientC: 25,
    conditions: [{ id: 'EMF 1.0 V', set: emf(1.0) }, { id: 'EMF 0.6 V', set: emf(0.6) }, { id: 'EMF 0.2 V', set: emf(0.2) }],
    specs: [
      { kind: 'level', id: 'out10', probe: 'v(out)', lo: 1.98, hi: 2.02 },
      { kind: 'level', id: 'out06', probe: 'v(out)', lo: 1.188, hi: 1.212 },
      { kind: 'level', id: 'out02', probe: 'v(out)', lo: 0.396, hi: 0.404 },
      { kind: 'rating', id: 'ratings' },
    ],
    only: { out10: ['EMF 1.0 V'], out06: ['EMF 0.6 V'], out02: ['EMF 0.2 V'] },
    names: { out10: 'ticket.6-2.spec.out10', out06: 'ticket.6-2.spec.out06', out02: 'ticket.6-2.spec.out02' },
  },
  live: { frameSim: 0.002, h: 1e-4, thermalSpeed: 6 },
  selectors: [
    { id: 'emf', labelKey: 'ticket.6-2.sel.emf', initial: 0, options: [
      { labelKey: 'ticket.6-2.sel.emf.10', cond: 'EMF 1.0 V', set: emf(1.0) }, { labelKey: 'ticket.6-2.sel.emf.06', cond: 'EMF 0.6 V', set: emf(0.6) }, { labelKey: 'ticket.6-2.sel.emf.02', cond: 'EMF 0.2 V', set: emf(0.2) },
    ] },
  ],
  stars: { head: 'cost', par: { cost: 19, parts: 3, power: 1e9, area: 240 } },
  explain: 'opamp',
  hints: {
    nudge: 'ticket.6-2.hint.nudge',
    equation: { key: 'ticket.6-2.hint.equation', vars: { rs: 100e3, rin: 10e3, rf: 20e3 } },
  },
  ref: {
    parts: [
      { partId: 'tl072', value: null, variant: 'DIP8', x: 12, y: 6, rot: 0, flip: false },
      { partId: 'res-cf', value: 10e3, variant: '0.25W', x: 7, y: 4, rot: 0, flip: false },
      { partId: 'res-cf', value: 10e3, variant: '0.25W', x: 5, y: 10, rot: 0, flip: false },
    ],
    wires: [
      [[2, 8], [12, 8]], [[12, 7], [10, 7]], [[7, 4], [7, 6], [10, 6], [10, 7]], [[10, 7], [10, 10], [9, 10]], [[5, 10], [4, 10], [4, 13], [22, 13], [22, 14]],
      [[11, 4], [12, 4], [12, 6]], [[11, 4], [11, 3], [22, 3], [22, 8]], [[12, 9], [12, 11], [6, 11], [6, 14], [2, 14]], [[15, 6], [15, 1], [2, 1]],
    ],
  },
  gauge: { spec: 'out10', unit: 'V', clip: 'OUT' },
  onBoard: 'ticket.6-2.onboard',
  specShort: 'ticket.6-2.short',
  scope: 'must',
  after: ['6-1'],
  pay: { fee: 1200, perStar: 300 },
  chit: { x: 0.5, y: 0.25 },
  coach: [
    { id: 'power', key: 'coach.6-2.s1', anchor: { target: 'power' }, done: 'powered|benched' },
    { id: 'clip', key: 'coach.6-2.s2', anchor: { target: 'scope' }, done: 'probed|benched', when: 'powered', optional: true },
    { id: 'fix', key: 'coach.6-2.s3', anchor: { target: 'part', partId: 'tl072', pin: 'IN1+' }, done: 'passed', when: 'powered|benched' },
    { id: 'done', key: 'coach.6-2.s4', anchor: { target: 'chit' }, done: '!passed', when: 'passed' },
  ],
};
