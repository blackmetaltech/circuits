// Ticket 0-0 "Torch warm-up": the minimal sample ticket the engine is tested on (DESIGN §7.1 shape). One red LED and a resistor on a 9 V battery.
// Not a campaign ticket: the real chapter-1 tickets (M2-2) are separate files. Numbers: PP3 9 V / 1.7 ohm, red LED fit (catalogue), 470 ohm gives ~14.9 mA.
import type { LevelDef } from './types';

export const L0_0: LevelDef = {
  id: '0-0', chapter: 0, titleKey: 'ticket.0-0.title', briefKey: 'ticket.0-0.brief', customer: 'kid_torch', teaches: ['ohm', 'led'],
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
    names: { led: 'ticket.0-0.spec.led' },
  },
  live: { frameSim: 0.02, h: 2e-3, thermalSpeed: 4 },
  stars: { head: 'cost', par: { cost: 5, parts: 2, power: 150000, area: 60 } },
  hints: {
    nudge: 'ticket.0-0.hint.nudge',
    equation: {
      key: 'ticket.0-0.hint.equation',
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
};
