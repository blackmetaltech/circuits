// Test-only ticket tables (never shipped): a bench-supply ticket with a generator, hidden parameter and two conditions, and a big sandbox-like board.
// They are built with the same LevelDef type as a real ticket, so the engine tests exercise the data-only extension path.
import type { LevelDef } from '../data/levels/types';

/** T-1: 12 V bench supply into a fixed 50 ohm heater through a series resistor; OUT must be 7.5-8.5 V in nominal AND 11 V supply conditions. */
export const T1: LevelDef = {
  id: 'T-1', chapter: 9, titleKey: 'ticket.0-0.title', briefKey: 'ticket.0-0.brief', customer: 'aquarium', teaches: [],
  board: {
    w: 24, h: 16,
    connectors: [
      { id: 'IN', pad: [2, 2], role: 'source' }, { id: 'OUT', pad: [14, 2], role: 'load' }, { id: 'GND', pad: [14, 8], role: 'ground' }, { id: 'SIG', pad: [2, 8], role: 'probe' },
    ],
  },
  fixed: [{ uid: 'f1', partId: 'heater', value: null, variant: '12V', x: 14, y: 2, rot: 1, flip: false, fixed: true }],
  supplies: [{ id: 'psu', kind: 'bench', plus: 'IN', minus: 'GND' }, { id: 'gen', kind: 'gen', plus: 'SIG', minus: 'GND' }],
  instruments: { supply: { v: 12, ilim: 0.5 }, gen: { shape: 'sine', f: 1000, vpp: 2, offset: 0 }, scope: { timePerDiv: 1e-3, voltsPerDiv: [1, 1] } },
  bin: [
    { partId: 'res-cf', values: [22, 27, 47, 51, 100], variants: ['0.25W', '0.5W', '1W'] },
    { partId: 'pot-trim', values: [1e4], max: 1 },
    { partId: 'slidewire', max: 1 },
    { partId: 'led-red-5mm', max: 2 },
  ],
  constraints: { maxParts: 8 },
  bench: {
    h: 1e-4, settle: 1e-3, window: 1e-3, ic: 'zero', ambientC: 25,
    conditions: [{ id: 'nominal' }, { id: 'low', set: [{ target: 'psu', key: 'v', value: 11 }] }],
    specs: [
      { kind: 'level', id: 'vout', probe: 'v(out)', lo: 7.2, hi: 8.5 },
      { kind: 'rating', id: 'ratings' },
      { kind: 'predict', id: 'vguess', entered: 0, of: { probe: 'v(out)', metric: 'mean' } },
    ],
    names: { vout: 'ticket.0-0.spec.led' },
  },
  live: { frameSim: 0.01, h: 1e-3, thermalSpeed: 8 },
  hidden: [{ id: 'rh', target: 'f1', key: 'r', learner: 50, seeded: [45, 55] }],
  stars: { head: 'cost', par: { cost: 5, parts: 1, power: 3000000, area: 20 } },
  hints: { nudge: 'ticket.0-0.hint.nudge' },
  ref: { parts: [{ partId: 'res-cf', value: 22, variant: '1W', x: 4, y: 2, rot: 0, flip: false }], wires: [[[2, 2], [4, 2]], [[8, 2], [14, 2]]], predictions: { vguess: 8.33 } },
  scope: 'stretch',
};

/** T-2: an empty 60 x 40 board with ground, for the size and fuzz tests. */
export const T2: LevelDef = {
  id: 'T-2', chapter: 9, titleKey: 'ticket.0-0.title', briefKey: 'ticket.0-0.brief', customer: 'cyclist', teaches: [],
  board: { w: 60, h: 40, connectors: [{ id: 'GND', pad: [0, 39], role: 'ground' }, { id: 'IN', pad: [0, 0], role: 'source' }] },
  fixed: [], supplies: [], instruments: { scope: { timePerDiv: 1e-3, voltsPerDiv: [1, 1] } },
  bin: [{ partId: 'res-cf', values: 'E12', variants: ['0.25W'] }],
  constraints: { maxParts: 40 },
  bench: { h: 1e-4, settle: 1e-3, window: 1e-3, conditions: [{ id: 'nominal' }], specs: [], names: {}, ambientC: 25 },
  live: { frameSim: 0.01, h: 1e-3, thermalSpeed: 1 },
  stars: { head: 'cost', par: { cost: 100, parts: 40, power: 0, area: 2400 } },
  ref: { parts: [], wires: [] },
  scope: 'stretch',
};
