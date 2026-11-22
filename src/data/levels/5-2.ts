// Ticket 5-2 "3.3 V Gate" (DESIGN §2.8 chapter 5). Tess's 3.3 V board has to light a 12 V LED strip (40 ohm, 0.3 A) through a MOSFET. The strip must pass at least 0.28 A; the FET may not run hotter than 125 C junction at 40 C ambient; and the bench repeats the test with the
// threshold voltage at its datasheet minimum, typical and maximum (the tolerance sweep IS the lesson: a 2N7000 that works on the bench of one batch cooks in another). A fourth test, "reset", lets the pin float to 1.8 V through 10 Mohm (a half-reset board leaks): the strip must stay
// off (50 mA at most), which only a gate pull-down gives.
// Numbers (src/engine/ch5.test.ts against the solver): ref IRLZ44N + 100 ohm gate resistor + 100 kohm pull-down: 0.30 A at every Vth, Rds about 0.07 - 0.1 ohm, 8 mW, reset leakage 0; 2N7000: at Vth typ (2.1 V) it saturates at 38 mA and
// drops about 10.5 V (0.4 W in a 312 C/W part: 165 C) and at Vth min it passes 0.17 A with 0.9 W; IRF540N: Vth 3 V typ, 4 V max: off at the maximum, 0.15 A at the typical; no pull-down: the reset test turns the strip on.
// DEVIATIONS from DESIGN (each documented; none changes the lesson):
//  1. The "missing pull-down floats the gate" case is a bench test, not a topology refusal: the engine's DC-floating check only warns (gmin decides), so the reset test (pin floats to 1.8 V behind 10 Mohm, strip must stay under 50 mA) is what catches it.
//  2. The Vth sweep is `{ target: '*tol', key: 'Vt', value: -1 | 0 | 1 }`: every placed part with a Vt range is put at its datasheet minimum, nominal or maximum (the catalogue ranges: 2N7000 0.8 - 3 V, IRLZ44N 1 - 2 V, IRF540N 2 - 4 V).
//  3. The strip is the catalogue fixture `led-strip` (40 ohm); the bin has the E12 resistors 47 ohm - 100 kohm in 1/4 W; stars: head = cost, par = the ref's cost.
import { eseries } from '../eseries';
import type { LevelDef } from './types';

const tol = (k: number): { target: string; key: string; value: number }[] => [{ target: '*tol', key: 'Vt', value: k }];
const reset = [{ target: 'pin', key: 'v', value: 1.8 }, { target: 'pin', key: 'r', value: 10e6 }];

export const L5_2: LevelDef = {
  id: '5-2', chapter: 5, titleKey: 'ticket.5-2.title', briefKey: 'ticket.5-2.brief', customer: 'strip', teaches: ['mosfet-threshold', 'logic-level-fet', 'conduction-loss', 'gate-pulldown'],
  board: {
    w: 24, h: 16,
    connectors: [
      { id: 'V12', pad: [2, 2], role: 'source' }, { id: 'GATE', pad: [2, 8], role: 'source' }, { id: 'DRAIN', pad: [22, 4], role: 'load' }, { id: 'GND', pad: [22, 14], role: 'ground' },
    ],
  },
  fixed: [{ uid: 'f1', partId: 'led-strip', value: null, variant: '12V', x: 16, y: 2, rot: 0, flip: false, fixed: true }],
  fixedWires: [[[2, 2], [16, 2]], [[22, 2], [22, 4]]],
  supplies: [
    { id: 'psu12', kind: 'bench', plus: 'V12', minus: 'GND', fixed: 12 },
    { id: 'pin', kind: 'pin', plus: 'GATE', minus: 'GND', v: 3.3, rOut: 25 },
  ],
  instruments: { supply: { v: 12, ilim: 1 }, scope: { timePerDiv: 2e-3, voltsPerDiv: [5, 5] } },
  bin: [
    { partId: '2n7000', max: 1 }, { partId: 'irlz44n', max: 1 }, { partId: 'irf540n', max: 1 },
    { partId: 'res-cf', values: eseries('E12', 47, 100e3), variants: ['0.25W'], max: 2 },
  ],
  constraints: { maxParts: 4 },
  bench: {
    h: 1e-3, settle: 0.01, window: 0.01, ic: 'op', ambientC: 40, tjLimit: 125,
    conditions: [
      { id: 'Vth typical', set: tol(0) }, { id: 'Vth minimum', set: tol(-1) }, { id: 'Vth maximum', set: tol(1) },
      { id: 'reset', set: [...reset, ...tol(-1)] },
    ],
    specs: [
      { kind: 'level', id: 'istrip', probe: 'i(@led-strip#1)', lo: 0.28, hi: 0.35 },
      { kind: 'level', id: 'ioff', probe: 'i(@led-strip#1)', lo: -0.01, hi: 0.05 },
      { kind: 'rating', id: 'ratings' },
    ],
    only: { istrip: ['Vth typical', 'Vth minimum', 'Vth maximum'], ioff: ['reset'] },
    names: { istrip: 'ticket.5-2.spec.istrip', ioff: 'ticket.5-2.spec.ioff' },
  },
  live: { frameSim: 0.004, h: 1e-3, thermalSpeed: 6 },
  selectors: [
    { id: 'vth', labelKey: 'ticket.5-2.sel.vth', initial: 0, options: [{ labelKey: 'ticket.5-2.sel.vth.typ', set: tol(0) }, { labelKey: 'ticket.5-2.sel.vth.min', set: tol(-1) }, { labelKey: 'ticket.5-2.sel.vth.max', set: tol(1) }] },
  ],
  stars: { head: 'cost', par: { cost: 56, parts: 3, power: 1e9, area: 120 } },
  explain: 'fet',
  hints: {
    nudge: 'ticket.5-2.hint.nudge',
    equation: { key: 'ticket.5-2.hint.equation', vars: { vgs: 3.3, istrip: 0.3, vstrip: 12 } },
  },
  ref: {
    parts: [
      { partId: 'res-cf', value: 100, variant: '0.25W', x: 4, y: 8, rot: 0, flip: false },
      { partId: 'irlz44n', value: null, variant: 'TO220', x: 12, y: 8, rot: 0, flip: false },
      { partId: 'res-cf', value: 100e3, variant: '0.25W', x: 10, y: 10, rot: 1, flip: false },
    ],
    wires: [[[2, 8], [4, 8]], [[8, 8], [10, 8]], [[10, 8], [12, 8]], [[10, 8], [10, 10]], [[10, 14], [16, 14]], [[16, 8], [16, 14]], [[16, 14], [22, 14]], [[14, 8], [14, 6], [22, 6], [22, 4]]],
  },
  specShort: 'ticket.5-2.short',
  scope: 'must',
  after: ['5-1'],
  pay: { fee: 1100, perStar: 250 },
  chit: { x: 0.3, y: 0.3 },
  coach: [
    { id: 'place', key: 'coach.5-2.s1', anchor: { target: 'bin', partId: 'irlz44n' }, done: 'part:2n7000|part:irlz44n|part:irf540n' },
    { id: 'wire', key: 'coach.5-2.s2', anchor: { target: 'connector', connector: 'GATE' }, done: 'wired&joined:GATE&joined:DRAIN', when: 'part:2n7000|part:irlz44n|part:irf540n' },
    { id: 'pull', key: 'coach.5-2.s2b', anchor: { target: 'bin', partId: 'res-cf' }, done: 'part:res-cf', when: 'wired&joined:GATE', optional: true },
    { id: 'power', key: 'coach.5-2.s3', anchor: { target: 'power' }, done: 'powered', when: 'wired&joined:GATE' },
    { id: 'run-bench', key: 'coach.5-2.s4', anchor: { target: 'bench' }, done: 'benched', when: 'wired&joined:GATE' },
    { id: 'done', key: 'coach.5-2.s5', anchor: { target: 'chit' }, done: '!passed', when: 'passed' },
  ],
};
