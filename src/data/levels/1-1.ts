// Ticket 1-1 "Torch" (DESIGN §2.8; tutorial). Lio's torch needs an LED that survives a 9 V PP3.
// Spec: LED current 10-20 mA. Cond: PP3 alkaline (EMF 9.0 V, r 1.7 ohm). Bin: red LED, 100/220/470/1k. Ref 470 ohm = 14.95 mA.
// Fails by design: LED straight on the battery (0.6 A, 20x the 30 mA absolute maximum: the die cracks at once); 100 ohm (64 mA: smokes after a few
// seconds of thermal time); 220 ohm (31 mA: warm, over the 20 mA spec); 1k (7.2 mA: too dim, fails the band).
import type { LevelDef } from './types';

export const L1_1: LevelDef = {
  id: '1-1', chapter: 1, titleKey: 'ticket.1-1.title', briefKey: 'ticket.1-1.brief', customer: 'kid_torch', teaches: ['ohm', 'kvl', 'led', 'current-limit'],
  board: {
    w: 24, h: 16,
    connectors: [{ id: 'VP', pad: [2, 2], role: 'rail' }, { id: 'GND', pad: [8, 2], role: 'ground' }],
  },
  fixed: [{ uid: 'f1', partId: 'bat-pp3', value: null, variant: 'fresh', x: 2, y: 2, rot: 0, flip: false, fixed: true }],
  supplies: [],
  instruments: { scope: { timePerDiv: 1e-3, voltsPerDiv: [1, 1] } },
  bin: [
    { partId: 'led-red-5mm', variants: ['5mm'], max: 1 },
    { partId: 'res-cf', values: [100, 220, 470, 1000], variants: ['0.25W'] },
  ],
  constraints: { maxParts: 6 },
  bench: {
    h: 1e-4, settle: 1e-3, window: 1e-3, ic: 'zero', ambientC: 25,
    conditions: [{ id: 'nominal' }],
    specs: [
      { kind: 'level', id: 'led', probe: 'i(@led-red-5mm#1)', lo: 0.010, hi: 0.020 },
      { kind: 'rating', id: 'ratings' },
    ],
    names: { led: 'ticket.1-1.spec.led' },
  },
  live: { frameSim: 0.02, h: 2e-3, thermalSpeed: 4 },
  stars: { head: 'cost', par: { cost: 5, parts: 2, power: 134300, area: 36 } },
  hints: {
    nudge: 'ticket.1-1.hint.nudge',
    equation: {
      key: 'ticket.1-1.hint.equation',
      vars: {
        vBat: { probe: 'v(@bat-pp3#1.+)' }, vLed: { probe: 'v(@led-red-5mm#1.A,@led-red-5mm#1.K)' }, iWant: 0.015,
        r: { op: 'div', a: { op: 'sub', a: { probe: 'v(@bat-pp3#1.+)' }, b: { probe: 'v(@led-red-5mm#1.A,@led-red-5mm#1.K)' } }, b: 0.015 },
      },
    },
  },
  ref: {
    parts: [
      { partId: 'res-cf', value: 470, variant: '0.25W', x: 2, y: 5, rot: 0, flip: false },
      { partId: 'led-red-5mm', value: null, variant: '5mm', x: 8, y: 5, rot: 0, flip: false },
    ],
    wires: [[[2, 2], [2, 5]], [[6, 5], [8, 5]], [[10, 5], [10, 2], [8, 2]]],
  },
  scope: 'must',
  pay: { fee: 300, perStar: 100 },
  gauge: { spec: 'led', unit: 'A' },
  chit: { x: 0.2, y: 0.3 },
  coach: [
    { id: 'place-led', key: 'coach.1-1.s1', anchor: { target: 'bin', partId: 'led-red-5mm' }, done: 'part:led-red-5mm' },
    { id: 'wire-led', key: 'coach.1-1.s2', anchor: { target: 'part', partId: 'led-red-5mm', pin: 'A' }, done: 'wired' },
    { id: 'power-on', key: 'coach.1-1.s3', anchor: { target: 'power' }, done: 'powered', when: '!part:res-cf&!smoked' },
    { id: 'undo-smoke', key: 'coach.1-1.s4a', anchor: { target: 'bin', partId: 'res-cf' }, done: 'part:res-cf', when: 'smoked' },
    { id: 'see-dots', key: 'coach.1-1.s4b', anchor: { target: 'part', partId: 'led-red-5mm', pin: 'A' }, done: 'probing', when: 'part:res-cf&wired&!smoked' },
    { id: 'run-bench', key: 'coach.1-1.s5', anchor: { target: 'bench' }, done: 'benched', when: 'part:res-cf&wired' },
    { id: 'done', key: 'coach.1-1.s6', anchor: { target: 'chit' }, done: '!passed', when: 'passed' },
  ],
};
