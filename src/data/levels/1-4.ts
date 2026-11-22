// Ticket 1-4 "Tired Battery" (DESIGN §2.8). Bo's toy-car pack: EMF 9.0 V, internal r hidden. The player measures the open-circuit and loaded voltage with the DMM,
// finds r, and chooses the load resistor: the power into it must be >= 4.20 W. Learner r = 4.7 ohm. 3.3 ohm 4.18 W fails, 3.9 4.27, 4.7 4.31 (max), 5.6 4.28, 6.8 4.16 fails.
// Bin: 2.2-10 ohm E12 in 1 W (cheap; smokes at 4.3 W) and 5 W (wirewound).
// SEEDED RANGE (reviewed): the design text seeds r in 3.3-8.2 ohm, but the most any load can draw from a 9 V EMF is E^2/(4r) = 20.25/r W, which is below 4.20 W for r > 4.82 ohm.
// Seeded r is therefore 3.3-4.7 ohm so the ticket is always solvable (at r < 4 ohm a load near r exceeds even the 5 W rating: the player must pick a larger R).
// The pack is the tired PP3 part; its EMF is a (known) hidden entry so the live view and the bench agree.
import type { LevelDef } from './types';

const R = [2.2, 2.7, 3.3, 3.9, 4.7, 5.6, 6.8, 8.2, 10];

export const L1_4: LevelDef = {
  id: '1-4', chapter: 1, titleKey: 'ticket.1-4.title', briefKey: 'ticket.1-4.brief', customer: 'toycar', teaches: ['emf', 'internal-resistance', 'terminal-voltage', 'max-power'],
  board: {
    w: 24, h: 16,
    connectors: [{ id: 'VP', pad: [2, 2], role: 'rail' }, { id: 'GND', pad: [8, 2], role: 'ground' }],
  },
  fixed: [{ uid: 'f1', partId: 'bat-pp3-tired', value: null, variant: 'tired', x: 2, y: 2, rot: 0, flip: false, fixed: true }],
  // repair (decision 10b): the car arrives with a burnt 1 W 4.7 ohm load (it took 4.3 W)
  fault: { parts: [{ partId: 'res-cf', value: 4.7, variant: '1W', x: 2, y: 5, rot: 0, flip: false }], wires: [[[2, 2], [2, 5]], [[6, 5], [6, 2], [8, 2]]], smoked: [0] },
  supplies: [],
  instruments: { scope: { timePerDiv: 1e-3, voltsPerDiv: [2, 1] } },
  bin: [
    { partId: 'res-cf', values: R, variants: ['1W'] },
    { partId: 'res-ww5', values: R, variants: ['5W'] },
  ],
  constraints: { maxParts: 4 },
  hidden: [
    { id: 'r', target: 'f1', key: 'r', learner: 4.7, seeded: [3.3, 4.7] },
    { id: 'emf', target: 'f1', key: 'emf', learner: 9.0, seeded: [9.0, 9.0] },
  ],
  bench: {
    h: 1e-4, settle: 1e-3, window: 1e-3, ic: 'zero', ambientC: 25,
    conditions: [{ id: 'nominal' }],
    specs: [
      // power delivered at the pack's terminals = the load's power; the source's terminal power is negative when it delivers
      { kind: 'level', id: 'power', probe: 'p(@bat-pp3-tired#1)', lo: -1000, hi: -4.2 },
      { kind: 'rating', id: 'ratings' },
    ],
    names: { power: 'ticket.1-4.spec.power' },
  },
  live: { frameSim: 0.02, h: 2e-3, thermalSpeed: 6 },
  stars: { head: 'cost', par: { cost: 40, parts: 1, power: 4308600, area: 28 } },
  hints: {
    nudge: 'ticket.1-4.hint.nudge',
    equation: { key: 'ticket.1-4.hint.equation', vars: { emf: 9.0 } },
  },
  ref: {
    parts: [{ partId: 'res-ww5', value: 4.7, variant: '5W', x: 2, y: 5, rot: 0, flip: false }],
    wires: [[[2, 2], [2, 5]], [[6, 5], [6, 2], [8, 2]]],
  },
  scope: 'must',
  after: ['1-3'],
  pay: { fee: 600, perStar: 200 },
  gauge: { spec: 'power', unit: 'W', flip: true },
  chit: { x: 0.3, y: 0.62 },
  measureFirst: true,
  coach: [
    { id: 'switch-on', key: 'coach.1-4.s0', anchor: { target: 'power' }, done: 'powered' },
    { id: 'open-circuit', key: 'coach.1-4.s1', anchor: { target: 'dmm' }, done: 'probed' },
    { id: 'load', key: 'coach.1-4.s2', anchor: { target: 'bin', partId: 'res-ww5' }, done: 'part:res-ww5|part:res-cf' },
    { id: 'wire', key: 'coach.1-4.s3', anchor: { target: 'connector', connector: 'VP' }, done: 'wired' },
    { id: 'smoke', key: 'coach.1-4.s5', anchor: { target: 'bin', partId: 'res-ww5' }, done: '!smoked', when: 'smoked' },
    { id: 'run-bench', key: 'coach.1-4.s6', anchor: { target: 'bench' }, done: 'benched', when: 'wired&!smoked' },
    { id: 'done', key: 'coach.1-4.s7', anchor: { target: 'chit' }, done: '!passed', when: 'passed' },
  ],
};
