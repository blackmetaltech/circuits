// Ticket 3-2 "Debounce" (DESIGN §2.8 chapter 3). Dex's arcade button reads as a burst of presses: its contact bounces for about 2 ms on every press and release. The board has a 10 kohm pull-up
// from the 5 V rail to the SW pad, the button contact from SW to GND (a bench-driven contact: closes at 10 ms, opens at 50 ms, each time with a bounce), and a 1 Mohm logic input on OUT. The player
// builds R from SW to OUT and C from OUT to GND. OUT must cross the 2.5 V logic threshold exactly once on the press and exactly once on the release, each crossing 5 - 20 ms after the first contact.
// The bench runs FOUR bounce patterns as four conditions (each 6 bounces of 0.1 - 0.4 ms over 2 ms; the release is the mirror image of the press); every spec must pass in every pattern. The live scope shows pattern 1.
// The amber tube is two gates: OUT must still be above 2.5 V until 5 ms after the first contact and below it from 20 ms to 5 ms after the release, and the reverse for the release (the crossing count and times are
// bench `metric` specs, checked on the sweep for LOCK). Press at 10 ms, release at 50 ms: the 100 ms sweep (10 ms/div) shows both.
// Numbers (src/engine/ch3.test.ts): 47 kohm + 330 nF: press crossing 10.8 ms after first contact (OUT discharges through R alone), release 14.1 ms (it charges through R + 10 k); 10 k + 1 uF: 6.9 / 14.4 ms but the margin to the
// 5 ms edge is under 2 ms under tolerance (the design's star 3, not built); 1 k + 10 nF passes every bounce through (several crossings); 470 k + 1 uF never gets there in time.
// DEVIATIONS from DESIGN (each documented; none changes the lesson):
//  1. The "first contact" times are read from the contact's own wave, not from a ruler: press at 10 ms and release at 50 ms; the spec windows are 15 - 30 ms and 55 - 70 ms in bench time.
//  2. Stars: head = parts as designed, par 2 parts; every working design has two parts, so the second star is automatic. The tolerance star is not built (see 3-1).
//  3. Bin: E12 1 k - 1 M, ceramic 10 nF - 1 uF (E6, 50 V) and electrolytic 1, 2.2, 4.7 and 10 uF at 16 V; 1N4148 x2 for the optional asymmetric charge (not needed by the ref).
//  4. The contact is a bench element (SWT device) between the SW and GND pads, not a placed part; the stall draws the arcade button on the board over those pads.
import { eseries } from '../eseries';
import type { LevelDef } from './types';

const ms = 1e-3;
const BOUNCE = [
  [0.30, 0.50, 0.65, 0.95, 1.05, 1.25, 1.35, 1.55, 1.62, 1.74, 1.80, 2.00],
  [0.20, 0.45, 0.60, 0.90, 1.00, 1.40, 1.45, 1.60, 1.70, 1.85, 1.90, 2.00],
  [0.15, 0.40, 0.70, 0.90, 1.10, 1.30, 1.40, 1.70, 1.75, 1.85, 1.88, 2.00],
  [0.35, 0.60, 0.75, 1.05, 1.15, 1.35, 1.50, 1.65, 1.72, 1.85, 1.88, 2.00],
].map((p) => p.map((x) => x * ms));
const PRESS = 10 * ms, RELEASE = 50 * ms;
const cross = (id: string, edge: 'falling' | 'rising', t0: number) => ({ kind: 'metric' as const, id, probe: 'v(out)', metric: 'crossingTime' as const, params: { level: 2.5, edge, index: 0 }, lo: t0 + 5 * ms, hi: t0 + 20 * ms });
const count = (id: string, edge: 'falling' | 'rising') => ({ kind: 'metric' as const, id, probe: 'v(out)', metric: 'crossingCount' as const, params: { level: 2.5, edge }, lo: 1, hi: 1 });

export const L3_2: LevelDef = {
  id: '3-2', chapter: 3, titleKey: 'ticket.3-2.title', briefKey: 'ticket.3-2.brief', customer: 'arcade', teaches: ['rc-lowpass', 'threshold-crossing', 'contact-bounce', 'charge-discharge-paths'],
  board: {
    w: 24, h: 16,
    connectors: [
      { id: 'VCC', pad: [2, 2], role: 'source' }, { id: 'SW', pad: [2, 8], role: 'probe' }, { id: 'OUT', pad: [14, 8], role: 'load' }, { id: 'GND', pad: [14, 13], role: 'ground' },
    ],
  },
  fixed: [
    { uid: 'f1', partId: 'pullup-10k', value: null, variant: '10k', x: 2, y: 2, rot: 1, flip: false, fixed: true },
    { uid: 'f2', partId: 'logic-in', value: null, variant: '1M', x: 18, y: 8, rot: 1, flip: false, fixed: true },
  ],
  // the logic input's ground end and the button's far side are soldered to the GND pad already (the lesson is the filter, not the ground wiring)
  fixedWires: [[[18, 8], [14, 8]], [[18, 14], [14, 14], [14, 13]]],
  supplies: [
    { id: 'psu', kind: 'bench', plus: 'VCC', minus: 'GND', fixed: 5 },
    { id: 'btn', kind: 'contact', plus: 'SW', minus: 'GND', press: PRESS, release: RELEASE, bounce: BOUNCE },
  ],
  instruments: { supply: { v: 5, ilim: 0.1 }, scope: { timePerDiv: 10 * ms, voltsPerDiv: [1, 1] } },
  bin: [
    { partId: 'res-cf', values: eseries('E12', 1e3, 1e6), variants: ['0.25W'] },
    { partId: 'cap-cer', values: eseries('E6', 10e-9, 1e-6), variants: ['50V'] },
    { partId: 'cap-el', values: [1e-6, 2.2e-6, 4.7e-6, 10e-6], variants: ['16V'] },
    { partId: '1n4148', variants: ['DO35'], max: 2 },
  ],
  constraints: { maxParts: 5 },
  bench: {
    h: 5e-5, settle: 0, window: 80 * ms, ic: 'op', ambientC: 25,
    conditions: BOUNCE.map((_, k) => ({ id: `bounce pattern ${k + 1}`, set: [{ target: 'btn', key: 'pattern', value: k }] })),
    specs: [
      count('npress', 'falling'), count('nrelease', 'rising'), cross('press', 'falling', PRESS), cross('release', 'rising', RELEASE),
      { kind: 'rating', id: 'ratings' },
    ],
    names: { press: 'ticket.3-2.spec.press', release: 'ticket.3-2.spec.release', npress: 'ticket.3-2.spec.npress', nrelease: 'ticket.3-2.spec.nrelease' },
  },
  live: { frameSim: 0.8 * ms, h: 0.2 * ms, thermalSpeed: 1 },
  stars: { head: 'parts', par: { cost: 99, parts: 2, power: 1e9, area: 90 } },
  explain: 'debounce',
  hints: {
    nudge: 'ticket.3-2.hint.nudge',
    equation: { key: 'ticket.3-2.hint.equation', vars: { tLo: 5, tHi: 20, rPull: 10000 } },
  },
  trace: {
    probe: 'v(out)', mode: 'clip', clip: 'OUT', unit: 'V', scale: 1, vdiv: 1, label: 'OUT', times: [2 * ms, 5 * ms, 10 * ms, 20 * ms],
    tube: { kind: 'windows', windows: [
      { t0: 0, t1: PRESS + 5 * ms, lo: 2.5, hi: 6 },
      { t0: PRESS + 20 * ms, t1: RELEASE + 5 * ms, lo: -1, hi: 2.5 },
      { t0: RELEASE + 20 * ms, t1: 0.2, lo: 2.5, hi: 6 },
    ] },
    lockSpecs: ['npress', 'nrelease', 'press', 'release'],
  },
  ref: {
    parts: [
      { partId: 'res-cf', value: 47000, variant: '0.25W', x: 4, y: 8, rot: 0, flip: false },
      { partId: 'cap-cer', value: 330e-9, variant: '50V', x: 14, y: 9, rot: 1, flip: false },
    ],
    wires: [[[2, 8], [4, 8]], [[8, 8], [14, 8]], [[14, 8], [14, 9]]],
  },
  specShort: 'ticket.3-2.short',
  scope: 'must',
  after: ['3-1'],
  pay: { fee: 800, perStar: 200 },
  chit: { x: 0.58, y: 0.3 },
  coach: [
    { id: 'place', key: 'coach.3-2.s1', anchor: { target: 'bin', partId: 'res-cf' }, done: 'part:res-cf&part:cap-cer|part:cap-el' },
    { id: 'wire', key: 'coach.3-2.s2', anchor: { target: 'connector', connector: 'OUT' }, done: 'wired&joined:OUT' },
    { id: 'power', key: 'coach.3-2.s3', anchor: { target: 'power' }, done: 'powered', when: 'wired' },
    { id: 'clip', key: 'coach.3-2.s4', anchor: { target: 'scope' }, done: 'probing', when: 'powered' },
    { id: 'run-bench', key: 'coach.3-2.s5', anchor: { target: 'bench' }, done: 'benched', when: 'wired' },
    { id: 'done', key: 'coach.3-2.s6', anchor: { target: 'chit' }, done: '!passed', when: 'passed' },
  ],
};
