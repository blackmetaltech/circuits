// Ticket 2-1 "Sensor Reference" (DESIGN §2.8 chapter 2). Kaya's weather-station ADC input needs 3.30 V (+-2 %) from the 9.0 V supply. The ADC input is a fixed 10 kohm to ground
// (the board's own fixture), so the divider must be designed WITH the load: the naive "unloaded" ratio fails.
// Band 3.234 - 3.366 V (3.30 +-2 %). Bench condition: the 9.0 V supply only (a divider scales with its supply; the sag lesson returns in 4-2 with the Zener).
// DEVIATIONS from DESIGN (each documented, none changes the lesson):
//  1. The design says "17 E12 pairs pass (reviewer re-counted)". A full count over E12 10 ohm - 1 Mohm gives 11 pairs (15k/82k 3.355 V, 15k/68k 3.308 V, 15k/56k 3.252 V,
//     12k/22k 3.278 V, 6.8k/6.8k 3.358 V, 5.6k/4.7k 3.271 V, 4.7k/3.9k 3.364 V, 2.7k/1.8k 3.249 V, 2.2k/1.5k 3.350 V, 1.8k/1.2k 3.358 V, 560/330 3.269 V). The design's
//     spot values (3.355 V at 3.39 mW for 15k/82k, 3.308 V at 3.42 mW for 15k/68k, 3.358 V at 7.5 mW for 6.8k/6.8k, 3.249 V at 19 mW for 2.7k/1.8k) are all confirmed.
//  2. The bin is E12 1 kohm - 100 kohm (25 values), not 10 ohm - 1 Mohm: nothing outside it passes except 560/330 (92 mW, the "wastes power" case: 1.8k/1.2k already shows it
//     at 28 mW), and 73 shoebox rows are not a usable list.
//  3. Stars: head = power (as the design says), par 5 mW (the lowest third of the 10 passing pairs: 15k/82k, 15k/68k, 15k/56k and 12k/22k); the reference (15k/82k, 3.39 mW) meets it.
import { eseries } from '../eseries';
import type { LevelDef } from './types';

export const L2_1: LevelDef = {
  id: '2-1', chapter: 2, titleKey: 'ticket.2-1.title', briefKey: 'ticket.2-1.brief', customer: 'weather', teaches: ['divider', 'loading', 'thevenin-intuition', 'power-vs-accuracy'],
  board: {
    w: 24, h: 16,
    connectors: [
      { id: 'IN', pad: [2, 2], role: 'source' }, { id: 'OUT', pad: [14, 2], role: 'load' }, { id: 'GND', pad: [14, 8], role: 'ground' },
    ],
  },
  fixed: [{ uid: 'f1', partId: 'adc-in', value: null, variant: '10k', x: 14, y: 2, rot: 1, flip: false, fixed: true }],
  supplies: [{ id: 'psu', kind: 'bench', plus: 'IN', minus: 'GND' }],
  instruments: { supply: { v: 9, ilim: 0.5 }, scope: { timePerDiv: 1e-3, voltsPerDiv: [0.8, 1] } },
  bin: [{ partId: 'res-cf', values: eseries('E12', 1e3, 1e5), variants: ['0.25W'] }],
  constraints: { maxParts: 4 },
  bench: {
    h: 1e-4, settle: 1e-3, window: 1e-3, ic: 'zero', ambientC: 25,
    conditions: [{ id: 'nominal', set: [{ target: 'psu', key: 'v', value: 9 }, { target: 'psu', key: 'ilim', value: 0.5 }] }],
    specs: [
      { kind: 'level', id: 'vout', probe: 'v(out)', lo: 3.234, hi: 3.366 },
      { kind: 'rating', id: 'ratings' },
    ],
    names: { vout: 'ticket.2-1.spec.vout' },
  },
  live: { frameSim: 0.02, h: 2e-3, thermalSpeed: 6 },
  stars: { head: 'power', par: { cost: 6, parts: 2, power: 5000, area: 60 } },
  explain: 'divider',
  hints: {
    nudge: 'ticket.2-1.hint.nudge',
    equation: { key: 'ticket.2-1.hint.equation', vars: { vin: 9, vOut: 3.3, rLoad: 10000 } },
  },
  ref: {
    parts: [
      { partId: 'res-cf', value: 15000, variant: '0.25W', x: 4, y: 2, rot: 0, flip: false },
      { partId: 'res-cf', value: 82000, variant: '0.25W', x: 8, y: 4, rot: 1, flip: false },
    ],
    wires: [[[2, 2], [4, 2]], [[8, 2], [14, 2]], [[8, 4], [8, 2]], [[8, 8], [14, 8]]],
  },
  specShort: 'ticket.2-1.short',
  scope: 'must',
  after: ['1-4|1-5'],
  pay: { fee: 500, perStar: 150 },
  gauge: { spec: 'vout', unit: 'V', clip: 'OUT' },
  chit: { x: 0.2, y: 0.28 },
  coach: [
    { id: 'place', key: 'coach.2-1.s1', anchor: { target: 'bin', partId: 'res-cf' }, done: 'part:res-cf' },
    { id: 'wire', key: 'coach.2-1.s2', anchor: { target: 'connector', connector: 'OUT' }, done: 'wired&joined:OUT' },
    { id: 'power', key: 'coach.2-1.s3', anchor: { target: 'power' }, done: 'powered', when: 'wired' },
    { id: 'measure', key: 'coach.2-1.s4', anchor: { target: 'dmm' }, done: 'measured', when: 'powered' },
    { id: 'clip', key: 'coach.2-1.s4b', anchor: { target: 'scope' }, done: 'probing', when: 'powered', optional: true },
    { id: 'run-bench', key: 'coach.2-1.s5', anchor: { target: 'bench' }, done: 'benched', when: 'wired' },
    { id: 'done', key: 'coach.2-1.s6', anchor: { target: 'chit' }, done: '!passed', when: 'passed' },
  ],
};
