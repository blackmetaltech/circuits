// Ticket 4-4 "Bench Supply" (DESIGN §2.8 chapter 4). Your own bench: set an LM317 to 3.3 V from a 9 V rail with two resistors (R1 from OUT to ADJ, R2 from ADJ to GND). OUT must be 3.30 V +-1 % (3.267 - 3.333 V) at loads of 0, 10 and 500 mA.
// Vout = 1.25 (1 + R2 / R1) + Iadj x R2 (Iadj 50 uA). The LM317 also needs a minimum load of about 3.5 mA: the macro injects its own 3.5 mA into OUT, and if the divider cannot sink it (large resistors) OUT rises at no load. That is why datasheets say R1 = 240 ohm.
// Numbers (src/engine/ch4.test.ts against the solver): the ref R1 = 240, R2 = 390 gives 3.3008 V at every load; 2.4 k / 3.9 k gives 3.48 V by the formula and the no-load output rises far higher (the minimum-load current has nowhere to go);
// 120 / 200 gives 3.34 V (the formula, 1.2 % high, fails); the LM317 at 500 mA dissipates 2.85 W (133 C at 25 C ambient, inside its 150 C).
// DEVIATIONS from DESIGN: the design says "the heatsink is fitted"; the catalogue has no thetaJC for the LM317 (data note), so no heatsink is modelled and the bare 37.9 C/W is used: 133 C at 500 mA, still under 150 C. E24 resistors 100 ohm - 5.6 kohm in 1/4 W.
import { eseries } from '../eseries';
import type { LevelDef } from './types';

const load = (i: number): { target: string; key: string; value: number }[] => [{ target: 'f1', key: 'i', value: i }];

export const L4_4: LevelDef = {
  id: '4-4', chapter: 4, titleKey: 'ticket.4-4.title', briefKey: 'ticket.4-4.brief', customer: 'ownbench', teaches: ['feedback-regulation', 'lm317-formula', 'minimum-load'],
  board: {
    w: 24, h: 16,
    connectors: [
      { id: 'IN', pad: [2, 2], role: 'source' }, { id: 'OUT', pad: [22, 2], role: 'load' }, { id: 'GND', pad: [22, 14], role: 'ground' },
    ],
  },
  fixed: [{ uid: 'f1', partId: 'load-cc', value: 0.01, variant: 'cc', x: 22, y: 4, rot: 1, flip: false, fixed: true }],
  fixedWires: [[[22, 2], [22, 4]], [[22, 10], [22, 14]]],
  supplies: [{ id: 'psu', kind: 'bench', plus: 'IN', minus: 'GND', fixed: 9 }],
  instruments: { supply: { v: 9, ilim: 1 }, scope: { timePerDiv: 1e-3, voltsPerDiv: [0.5, 1] } },
  bin: [
    { partId: 'lm317', max: 1 },
    { partId: 'res-cf', values: eseries('E24', 100, 5.6e3), variants: ['0.25W'], max: 2 },
  ],
  constraints: { maxParts: 3 },
  bench: {
    h: 1e-3, settle: 0.05, window: 0.01, ic: 'op', ambientC: 25,
    conditions: [{ id: '10 mA', set: load(0.01) }, { id: 'no load', set: load(0) }, { id: '500 mA', set: load(0.5) }],
    specs: [
      { kind: 'level', id: 'vout', probe: 'v(out)', lo: 3.267, hi: 3.333 },
      { kind: 'rating', id: 'ratings' },
    ],
    names: { vout: 'ticket.4-4.spec.vout' },
  },
  live: { frameSim: 0.02, h: 2e-3, thermalSpeed: 6 },
  selectors: [
    { id: 'load', labelKey: 'ticket.4-4.sel.load', initial: 0, options: [{ labelKey: 'ticket.4-4.sel.load.10', set: load(0.01) }, { labelKey: 'ticket.4-4.sel.load.0', set: load(0) }, { labelKey: 'ticket.4-4.sel.load.500', set: load(0.5) }] },
  ],
  stars: { head: 'parts', par: { cost: 99, parts: 3, power: 1e9, area: 140 } },
  explain: 'lm317',
  hints: {
    nudge: 'ticket.4-4.hint.nudge',
    equation: { key: 'ticket.4-4.hint.equation', vars: { vref: 1.25, vout: 3.3, iadj: 0.00005, r1: 240 } },
  },
  ref: {
    parts: [
      { partId: 'lm317', value: null, variant: 'TO220', x: 10, y: 8, rot: 0, flip: false },
      { partId: 'res-cf', value: 240, variant: '0.25W', x: 12, y: 12, rot: 0, flip: false },
      { partId: 'res-cf', value: 390, variant: '0.25W', x: 4, y: 12, rot: 0, flip: false },
    ],
    wires: [[[2, 2], [14, 2], [14, 8]], [[12, 8], [12, 4], [20, 4], [20, 2], [22, 2]], [[10, 8], [8, 8], [8, 12]], [[10, 8], [10, 12], [12, 12]], [[16, 12], [16, 10], [12, 10], [12, 8]], [[4, 12], [4, 14], [22, 14]]],
  },
  specShort: 'ticket.4-4.short',
  scope: 'must',
  after: ['4-2'],
  pay: { fee: 1000, perStar: 200 },
  gauge: { spec: 'vout', unit: 'V', clip: 'OUT' },
  chit: { x: 0.54, y: 0.62 },
  coach: [
    { id: 'place', key: 'coach.4-4.s1', anchor: { target: 'bin', partId: 'lm317' }, done: 'part:lm317&part:res-cf' },
    { id: 'wire', key: 'coach.4-4.s2', anchor: { target: 'part', partId: 'lm317', pin: 'ADJ' }, done: 'wired&joined:OUT' },
    { id: 'power', key: 'coach.4-4.s3', anchor: { target: 'power' }, done: 'powered', when: 'wired' },
    { id: 'clip', key: 'coach.4-4.s4', anchor: { target: 'scope' }, done: 'probing', when: 'powered' },
    { id: 'run-bench', key: 'coach.4-4.s5', anchor: { target: 'bench' }, done: 'benched', when: 'wired' },
    { id: 'done', key: 'coach.4-4.s6', anchor: { target: 'chit' }, done: '!passed', when: 'passed' },
  ],
};
