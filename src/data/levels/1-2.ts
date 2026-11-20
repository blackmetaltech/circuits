// Ticket 1-2 "Tail-light" (DESIGN §2.8). Ash's bike light: three red LEDs, 14-20 mA each, battery current <= 25 mA, in a fresh (r 1.7 ohm, EMF 9.0 V)
// AND a tired (EMF 8.4 V, r 6 ohm) battery. Ref: all three LEDs in series with 150 ohm (19.65 mA fresh, 16.1 mA tired).
// The 14-20 mA band is tight by design: its E12 neighbours fail on both sides (120 ohm 23.4 mA fresh; 180 ohm 13.99 mA tired).
// Fails: three LEDs parallel on one resistor (battery current x3) and three resistor-LED branches (also x3 on the battery).
import type { LevelDef } from './types';
import { eseries } from '../eseries';

const lvl = (n: number) => ({ kind: 'level' as const, id: `led${n}`, probe: `i(@led-red-5mm#${n})`, lo: 0.014, hi: 0.020 });

export const L1_2: LevelDef = {
  id: '1-2', chapter: 1, titleKey: 'ticket.1-2.title', briefKey: 'ticket.1-2.brief', customer: 'cyclist', teaches: ['series', 'parallel', 'shared-current', 'battery-current'],
  board: {
    w: 24, h: 16,
    connectors: [{ id: 'VP', pad: [2, 2], role: 'rail' }, { id: 'GND', pad: [8, 2], role: 'ground' }],
  },
  fixed: [{ uid: 'f1', partId: 'bat-pp3', value: null, variant: 'fresh', x: 2, y: 2, rot: 0, flip: false, fixed: true }],
  supplies: [],
  instruments: { scope: { timePerDiv: 1e-3, voltsPerDiv: [1, 1] } },
  bin: [
    { partId: 'led-red-5mm', variants: ['5mm'], max: 3 },
    { partId: 'res-cf', values: eseries('E12', 10, 1e6), variants: ['0.25W'] },
  ],
  constraints: { maxParts: 8 },
  bench: {
    h: 1e-4, settle: 1e-3, window: 1e-3, ic: 'zero', ambientC: 25,
    conditions: [
      { id: 'fresh', set: [{ target: 'f1', key: 'emf', value: 9.0 }, { target: 'f1', key: 'r', value: 1.7 }] },
      { id: 'tired', set: [{ target: 'f1', key: 'emf', value: 8.4 }, { target: 'f1', key: 'r', value: 6 }] },
    ],
    specs: [
      lvl(1), lvl(2), lvl(3),
      // the battery's terminal current is negative when it delivers: at most 25 mA out
      { kind: 'level', id: 'ibat', probe: 'i(@bat-pp3#1)', lo: -0.025, hi: 0 },
      { kind: 'rating', id: 'ratings' },
    ],
    names: { led1: 'ticket.1-2.spec.led1', led2: 'ticket.1-2.spec.led2', led3: 'ticket.1-2.spec.led3', ibat: 'ticket.1-2.spec.ibat' },
  },
  live: { frameSim: 0.02, h: 2e-3, thermalSpeed: 4 },
  stars: { head: 'power', par: { cost: 11, parts: 4, power: 155100, area: 76 } },
  hints: {
    nudge: 'ticket.1-2.hint.nudge',
    equation: {
      key: 'ticket.1-2.hint.equation',
      vars: { vBat: 9, vLed: { probe: 'v(@led-red-5mm#1.A,@led-red-5mm#1.K)' }, iWant: 0.0175 },
    },
  },
  ref: {
    parts: [
      { partId: 'res-cf', value: 150, variant: '0.25W', x: 2, y: 5, rot: 0, flip: false },
      { partId: 'led-red-5mm', value: null, variant: '5mm', x: 8, y: 5, rot: 0, flip: false },
      { partId: 'led-red-5mm', value: null, variant: '5mm', x: 14, y: 5, rot: 0, flip: false },
      { partId: 'led-red-5mm', value: null, variant: '5mm', x: 18, y: 5, rot: 0, flip: false },
    ],
    wires: [[[2, 2], [2, 5]], [[6, 5], [8, 5]], [[10, 5], [14, 5]], [[16, 5], [18, 5]], [[20, 5], [20, 2], [8, 2]]],
  },
  scope: 'must',
  after: ['1-1'],
  pay: { fee: 400, perStar: 150 },
  gauge: { spec: 'led1', unit: 'A' },
  chit: { x: 0.45, y: 0.22 },
  coach: [
    { id: 'three-leds', key: 'coach.1-2.s1', anchor: { target: 'bin', partId: 'led-red-5mm' }, done: 'part:led-red-5mm' },
    { id: 'share', key: 'coach.1-2.s2', anchor: { target: 'part', partId: 'led-red-5mm', pin: 'K' }, done: 'wired' },
    { id: 'probe', key: 'coach.1-2.s3', anchor: { target: 'dmm' }, done: 'probing', when: 'part:res-cf&wired', optional: true },
    { id: 'run-bench', key: 'coach.1-2.s4', anchor: { target: 'bench' }, done: 'benched', when: 'part:res-cf&wired' },
    { id: 'tired', key: 'coach.1-2.s5', anchor: { target: 'part', partId: 'res-cf' }, done: '!failed', when: 'failed' },
    { id: 'done', key: 'coach.1-2.s6', anchor: { target: 'chit' }, done: '!passed', when: 'passed' },
  ],
};
