// Ticket 1-3 "Hot Resistor" (DESIGN §2.8). Mr. Brook's 12 V aquarium heater (50 ohm, fixed on the board): the controller must put 8.0 V across it
// from the 12 V bench supply and no part may exceed its rating.
// BAND (reviewed): the design text says "8.0 V +-0.3 V" but also that Ref A (22 ohm, 8.33 V) passes and 27 ohm (7.79 V) fails; no centred +-0.3 V band does both
// (8.33 is out of 7.7-8.3). The band here is 7.85-8.40 V (about the same width, centre 8.125 V): 22 ohm 8.333 V, 2x47 ohm in parallel 8.16 V and 2x51 ohm 7.95 V pass,
// 27 ohm 7.79 V fails.
// Fail: one 22 ohm 1/4 W: right voltage, 0.61 W in a 0.25 W part (2.44x): it glows, then smokes.
// AMBIENT (reviewed): the design says smoke arrives at about 2.6x rated power at Ta 25 C (T_fail 250 C, theta 340 C/W for 1/4 W), but 0.61 W is only 2.44x, which settles at
// 233 C and never smokes. The controller sits in the aquarium hood, a warm 50 C: steady state 258 C > 250 C, so the naive part smokes (live after ~4 s, and on the bench).
// Every good design stays far under: 22 ohm 1 W settles at 102 C, 2 x 47 ohm 1/2 W at 103 C.
// PRICES: a 1 W resistor is 7 c and 2 x 1/2 W is 6 c in the price table, so Ref B (two 47 ohm 1/2 W) is cheaper than Ref A (22 ohm 1 W, DESIGN §2.8); cost par = 6 c.
import type { LevelDef } from './types';

export const L1_3: LevelDef = {
  id: '1-3', chapter: 1, titleKey: 'ticket.1-3.title', briefKey: 'ticket.1-3.brief', customer: 'aquarium', teaches: ['power', 'ratings', 'parallel-sharing'],
  board: {
    w: 24, h: 16,
    connectors: [
      { id: 'IN', pad: [2, 2], role: 'source' }, { id: 'OUT', pad: [14, 2], role: 'load' }, { id: 'GND', pad: [14, 8], role: 'ground' },
    ],
  },
  fixed: [{ uid: 'f1', partId: 'heater', value: null, variant: '12V', x: 14, y: 2, rot: 1, flip: false, fixed: true }],
  supplies: [{ id: 'psu', kind: 'bench', plus: 'IN', minus: 'GND' }],
  instruments: { supply: { v: 12, ilim: 0.5 }, scope: { timePerDiv: 1e-3, voltsPerDiv: [2, 1] } },
  bin: [{ partId: 'res-cf', values: [22, 27, 47, 51, 100], variants: ['0.25W', '0.5W', '1W'] }],
  constraints: { maxParts: 4 },
  bench: {
    h: 1e-4, settle: 1e-3, window: 1e-3, ic: 'zero', ambientC: 50,
    conditions: [{ id: 'nominal', set: [{ target: 'psu', key: 'v', value: 12 }, { target: 'psu', key: 'ilim', value: 0.5 }] }],
    specs: [
      { kind: 'level', id: 'vout', probe: 'v(out)', lo: 7.85, hi: 8.40 },
      { kind: 'rating', id: 'ratings' },
    ],
    names: { vout: 'ticket.1-3.spec.vout' },
  },
  live: { frameSim: 0.02, h: 2e-3, thermalSpeed: 6 },
  stars: { head: 'cost', par: { cost: 6, parts: 2, power: 2000100, area: 13 } },
  hints: {
    nudge: 'ticket.1-3.hint.nudge',
    equation: { key: 'ticket.1-3.hint.equation', vars: { vWant: 8.0, vIn: 12, rLoad: 50, r: { op: 'sub', a: { op: 'div', a: { op: 'mul', a: 12, b: 50 }, b: 8 }, b: 50 } } },
  },
  ref: {
    parts: [{ partId: 'res-cf', value: 22, variant: '1W', x: 4, y: 2, rot: 0, flip: false }],
    wires: [[[2, 2], [4, 2]], [[8, 2], [14, 2]]],
  },
  scope: 'must',
  after: ['1-2'],
  pay: { fee: 500, perStar: 150 },
  gauge: { spec: 'vout', unit: 'V', clip: 'OUT' },
  chit: { x: 0.7, y: 0.3 },
  coach: [
    { id: 'place', key: 'coach.1-3.s1', anchor: { target: 'bin', partId: 'res-cf' }, done: 'part:res-cf' },
    { id: 'wire', key: 'coach.1-3.s2', anchor: { target: 'connector', connector: 'OUT' }, done: 'wired' },
    { id: 'power', key: 'coach.1-3.s3', anchor: { target: 'power' }, done: 'powered', when: 'wired&!smoked' },
    { id: 'clip', key: 'coach.1-3.s4', anchor: { target: 'scope' }, done: 'probing', when: 'powered&!smoked' },
    { id: 'glow', key: 'coach.1-3.s5', anchor: { target: 'part', partId: 'res-cf' }, done: '!smoked', when: 'smoked' },
    { id: 'run-bench', key: 'coach.1-3.s6', anchor: { target: 'bench' }, done: 'benched', when: 'wired&!smoked' },
    { id: 'done', key: 'coach.1-3.s7', anchor: { target: 'chit' }, done: '!passed', when: 'passed' },
  ],
};
