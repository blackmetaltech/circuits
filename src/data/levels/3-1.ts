// Ticket 3-1 "Flash Timer" (DESIGN §2.8 chapter 3). Ines's camera shop: "the flash ready-light must come on after 1 s". An R from the 10 V supply to OUT and an electrolytic capacitor from OUT to GND:
// the capacitor starts empty, the supply steps on at t = 0, and V(OUT) must cross 6.32 V (63.2 % of 10 V) at t = 1.00 s +-5 % (0.95 - 1.05 s).
// The scope draws the real transient from power-on as one sweep (2 s at 0.2 s/div) against an amber tube around the ideal curve 10 (1 - e^-t) (+-0.10 V and +-50 ms); LOCK = the whole sweep sits in the tube and
// the crossing time is inside the spec. The clip is a real probe: its 10 Mohm is in the circuit, which is the hidden lesson (a 1 Mohm + 1 uF timer reads 1.08 s).
// Numbers (checked in src/engine/ch3.test.ts against the closed form and the stepper): 10 k + 100 uF 16 V crosses at 1.000 s; 22 k + 47 u, 4.7 k + 220 u, 2.2 k + 470 u cross at 1.034 s (all pass);
// 1 M + 1 u: Vth = 9.09 V, Rth = 0.909 Mohm, crossing 1.079 s (fails); 220 k + 4.7 u crosses at 1.052 s (the probe again; fails by 2 ms); 100 k + 10 u at 1.006 s passes and is the cheapest passing pair.
// A 6.3 V capacitor on 10 V vents (over 1.2 x its rating for 50 ms, at about 1.5 s of the sweep); a reversed electrolytic vents (below -1 V for 0.5 s).
// DEVIATIONS from DESIGN (each documented; none changes the lesson):
//  1. The bin lists E12 1 k - 1 M (37 values) and the E6 capacitors 1 - 1000 uF in 6.3 V, 16 V and 25 V (30 rows); the design says "16 V/25 V" and the 6.3 V part is the designed trap, so it is offered as a variant.
//  2. The bench runs 5 s (not 2 s): the rating check needs the capacitor to get near the supply (a 10 V part at 10 V would sit on its limit), and the tube covers the whole of it. Voltage ratings are checked on the peak.
//  3. cap-el values below 220 uF and the 6.3 V variant are generic game values (the Panasonic EEU-FR rows exist only from 220 uF); the Codex says so (data.provenance CAMPAIGN_BLOCKERS lists cap-el for 3-1).
//  4. Stars: head = cost (as designed), par = the ref's cost (10 k + 100 uF 16 V, 10 c); cheaper passing pairs exist (100 k + 10 uF at 8 c) and bring the best-cost line down, not a third star (stars 3 is the tolerance run, not built).
import { eseries } from '../eseries';
import type { LevelDef } from './types';

export const L3_1: LevelDef = {
  id: '3-1', chapter: 3, titleKey: 'ticket.3-1.title', briefKey: 'ticket.3-1.brief', customer: 'camera', teaches: ['rc-charging', 'time-constant', 'capacitor-polarity', 'probe-loading'],
  board: {
    w: 24, h: 16,
    connectors: [
      { id: 'IN', pad: [2, 2], role: 'source' }, { id: 'OUT', pad: [14, 2], role: 'load' }, { id: 'GND', pad: [14, 8], role: 'ground' },
    ],
  },
  fixed: [],
  supplies: [{ id: 'psu', kind: 'bench', plus: 'IN', minus: 'GND', fixed: 10 }],
  instruments: { supply: { v: 10, ilim: 0.5 }, scope: { timePerDiv: 0.2, voltsPerDiv: [2, 2] } },
  bin: [
    { partId: 'res-cf', values: eseries('E12', 1e3, 1e6), variants: ['0.25W'] },
    { partId: 'cap-el', values: [1e-6, 2.2e-6, 4.7e-6, 10e-6, 22e-6, 47e-6, 100e-6, 220e-6, 470e-6, 1000e-6], variants: ['6.3V', '16V', '25V'] },
  ],
  constraints: { maxParts: 4 },
  bench: {
    h: 2e-3, settle: 0, window: 5, ic: 'zero', ambientC: 25,
    conditions: [{ id: 'nominal', set: [{ target: 'psu', key: 'v', value: 10 }, { target: 'psu', key: 'ilim', value: 0.5 }] }],
    specs: [
      { kind: 'metric', id: 'tcross', probe: 'v(out)', metric: 'crossingTime', params: { level: 6.32, edge: 'rising' }, lo: 0.95, hi: 1.05 },
      { kind: 'band', id: 'tube', probe: 'v(out)', target: { k: 'exp', v0: 0, vInf: 10, tau: 1 }, dv: 0.1, dt: 0.05 },
      { kind: 'rating', id: 'ratings' },
    ],
    names: { tcross: 'ticket.3-1.spec.tcross', tube: 'ticket.3-1.spec.tube' },
  },
  live: { frameSim: 0.02, h: 5e-3, thermalSpeed: 4 },
  stars: { head: 'cost', par: { cost: 10, parts: 2, power: 1e9, area: 80 } },
  explain: 'rc',
  hints: {
    nudge: 'ticket.3-1.hint.nudge',
    equation: { key: 'ticket.3-1.hint.equation', vars: { tau: 1, vSrc: 10, level: 6.32 } },
  },
  trace: {
    probe: 'v(out)', mode: 'clip', clip: 'OUT', unit: 'V', scale: 1, vdiv: 2, label: 'OUT', times: [0.05, 0.1, 0.2, 0.5, 1],
    tube: { kind: 'exp', v0: 0, vInf: 10, tau: 1, dv: 0.1, dt: 0.05 }, lockSpecs: ['tcross'],
  },
  ref: {
    parts: [
      { partId: 'res-cf', value: 10000, variant: '0.25W', x: 4, y: 2, rot: 0, flip: false },
      { partId: 'cap-el', value: 100e-6, variant: '16V', x: 14, y: 4, rot: 1, flip: false },
    ],
    wires: [[[2, 2], [4, 2]], [[8, 2], [14, 2]], [[14, 2], [14, 4]], [[14, 6], [14, 8]]],
  },
  specShort: 'ticket.3-1.short',
  scope: 'must',
  after: ['2-3|2-4'],
  pay: { fee: 700, perStar: 200 },
  chit: { x: 0.22, y: 0.3 },
  coach: [
    { id: 'place', key: 'coach.3-1.s1', anchor: { target: 'bin', partId: 'cap-el' }, done: 'part:res-cf&part:cap-el' },
    { id: 'wire', key: 'coach.3-1.s2', anchor: { target: 'part', partId: 'cap-el', pin: '+' }, done: 'wired&joined:OUT' },
    { id: 'power', key: 'coach.3-1.s3', anchor: { target: 'power' }, done: 'powered', when: 'wired' },
    { id: 'clip', key: 'coach.3-1.s4', anchor: { target: 'scope' }, done: 'probing', when: 'powered' },
    { id: 'run-bench', key: 'coach.3-1.s5', anchor: { target: 'bench' }, done: 'benched', when: 'wired' },
    { id: 'done', key: 'coach.3-1.s6', anchor: { target: 'chit' }, done: '!passed', when: 'passed' },
  ],
};
