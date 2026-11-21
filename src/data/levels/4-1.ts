// Ticket 4-1 "Wall Wart" (DESIGN §2.8 chapter 4). Mrs. Dale's hum-y 12 V adapter. SIMULATED MAINS (DESIGN §1.2, user decision 4): the ticket opens with the safety card in Wren's hand; the wall socket is an isolation transformer on the bench; the mains section of
// the board (the transformer's primary) sits behind a red hatched keep-out with "HIGH VOLTAGE" silkscreen and no part or wire may enter it; the Bench Card carries the "do not try this at home" ribbon. No step ever tells anyone to build on real mains.
// The player builds the rectifier and the reservoir on the SECONDARY side: a mains:12 V rms transformer (fixed: ideal ratio 230:12, winding R 1.5 ohm on the 12 V side, 6 VA) drives the bridge (4 x 1N4007) and a smoothing electrolytic; the customer's gadget is a
// constant-current load (100 mA, and the no-load test). OUT must have mean >= 12.0 V and ripple <= 1.0 Vpp at 100 mA for mains of 207 / 230 / 253 V (-10 % / nominal / +10 %, 50 Hz), and the capacitor must stay inside its voltage rating at no load.
// Numbers (docs/API-CH4.md, src/engine/ch4.test.ts against the solver; the catalogue Vishay 1N4007 model): the ref 4 x 1N4007 + 1000 uF 25 V: mean 12.6 / 14.3 / 15.9 V and ripple 0.75 - 0.77 Vpp at 207 / 230 / 253 V (100 mA); no-load peak 17.4 V at 253 V.
// 680 uF fails (1.1 Vpp); a 16 V capacitor is over its rating at 253 V, no load (17.4 V); a 10 V part vents; 1N4148s exceed their repetitive peak current (the charging surges, 0.5 A rating); a diode the wrong way round puts two diodes across the winding.
// DEVIATIONS from DESIGN (each documented; none changes the lesson):
//  1. The bin offers the electrolytics 220 - 2200 uF at 10 / 16 / 25 / 35 V only: every pair is a verified Panasonic EEU-FR row (330 uF, 3300 and 4700 uF have unverified pairs: data/parts CAMPAIGN_BLOCKERS), so "220-4700 uF" shrinks to 220-2200 uF.
//  2. The 1N4148 rule: the design says the 4148s "exceed IF(AV) 150 mA during charging surges", but the AVERAGE current of a diode in a 100 mA bridge is 50 mA. The honest rating is the REPETITIVE PEAK current IFRM = 0.5 A (the charging pulses are 1 A and more),
//     so the ratings check gained that rule ('rating.diode.peak') and the explainer says "peak", not "average".
//  3. Only the `global` mains (230 V / 50 Hz) is built: the `refByRuleset` `na` ref (680 uF at 120 V / 60 Hz) needs a region-aware level (DESIGN §12.3) and is listed as open. The mains tolerance comes from the pack (+-10 %), written into the conditions here.
//  4. Half-wave (one 1N4007 and 2200 uF 25 V) also passes, at 25 c against the bridge's 26 c: the price table is a game estimate and the ripple numbers, not the price, carry the lesson (the explainer shows I / (f C) for half-wave and I / (2 f C) for the bridge).
//  5. The constant-current load switches on 30 ms after power-on (the supply charges first); the live scope sweep measures the lock specs from 120 ms on, when the capacitor has charged.
import { eseries } from '../eseries';
import type { LevelDef } from './types';

const loads = (i: number): { target: string; key: string; value: number }[] => [{ target: 'f2', key: 'i', value: i }];
const mains = (v: number): { target: string; key: string; value: number }[] => [{ target: 'mains', key: 'vrms', value: v }];
const cond = (id: string, v: number, i: number): { id: string; set: { target: string; key: string; value: number }[] } => ({ id, set: [...mains(v), ...loads(i)] });

export const L4_1: LevelDef = {
  id: '4-1', chapter: 4, titleKey: 'ticket.4-1.title', briefKey: 'ticket.4-1.brief', customer: 'wallwart', teaches: ['transformer-ratio', 'rms-vs-peak', 'bridge-rectifier', 'ripple', 'capacitor-rating', 'mains-tolerance'], mains: true,
  board: {
    w: 24, h: 16,
    connectors: [
      { id: 'L', pad: [2, 2], role: 'mains' }, { id: 'N', pad: [2, 6], role: 'mains' }, { id: 'OUT', pad: [22, 2], role: 'load' }, { id: 'GND', pad: [22, 14], role: 'ground' },
    ],
    keepOut: [{ x: 0, y: 0, w: 10, h: 8 }],
  },
  // the transformer is soldered on: primary pins P1 / P2 inside the keep-out (wired to the mains pads L and N), secondary S1 / S2 for the player; the customer's load hangs between OUT and GND
  fixed: [
    { uid: 'f1', partId: 'xfmr-12', value: null, variant: '6VA', x: 8, y: 2, rot: 0, flip: false, fixed: true },
    { uid: 'f2', partId: 'load-cc', value: 0.1, variant: 'cc', x: 22, y: 4, rot: 1, flip: false, fixed: true },
  ],
  fixedWires: [[[2, 2], [8, 2]], [[2, 6], [8, 6]], [[22, 2], [22, 4]], [[22, 10], [22, 14]]],
  supplies: [{ id: 'mains', kind: 'mains', plus: 'L', minus: 'N', vrms: 230, f: 50 }],
  instruments: { scope: { timePerDiv: 0.02, voltsPerDiv: [5, 5] } },
  bin: [
    { partId: '1n4007', max: 4 }, { partId: '1n4148', max: 4 },
    { partId: 'cap-el', values: [220e-6, 470e-6, 680e-6, 1000e-6, 1500e-6, 2200e-6], variants: ['10V', '16V', '25V', '35V'], max: 2 },
    { partId: 'res-cf', values: eseries('E12', 1e3, 100e3), variants: ['0.25W', '0.5W'], max: 1 },
  ],
  constraints: { maxParts: 8 },
  bench: {
    h: 1e-4, settle: 0.4, window: 0.1, ic: 'zero', ambientC: 25,
    conditions: [
      cond('230 V, 100 mA', 230, 0.1), cond('207 V, 100 mA', 207, 0.1), cond('253 V, 100 mA', 253, 0.1),
      cond('230 V, no load', 230, 0), cond('207 V, no load', 207, 0), cond('253 V, no load', 253, 0),
    ],
    specs: [
      { kind: 'metric', id: 'ripple', probe: 'v(out)', metric: 'vpp', lo: -1, hi: 1.0 },
      { kind: 'metric', id: 'mean', probe: 'v(out)', metric: 'mean', lo: 12.0, hi: 1e3 },
      { kind: 'rating', id: 'ratings' },
    ],
    names: { ripple: 'ticket.4-1.spec.ripple', mean: 'ticket.4-1.spec.mean' },
  },
  live: { frameSim: 0.002, h: 1e-4, thermalSpeed: 8 },
  selectors: [
    { id: 'mains', labelKey: 'ticket.4-1.sel.mains', initial: 1, options: [{ labelKey: 'ticket.4-1.sel.mains.lo', set: mains(207) }, { labelKey: 'ticket.4-1.sel.mains.nom', set: mains(230) }, { labelKey: 'ticket.4-1.sel.mains.hi', set: mains(253) }] },
    { id: 'load', labelKey: 'ticket.4-1.sel.load', initial: 0, options: [{ labelKey: 'ticket.4-1.sel.load.100', set: loads(0.1) }, { labelKey: 'ticket.4-1.sel.load.0', set: loads(0) }] },
  ],
  stars: { head: 'cost', par: { cost: 26, parts: 5, power: 1e9, area: 200 } },
  explain: 'rectifier',
  hints: {
    nudge: 'ticket.4-1.hint.nudge',
    equation: { key: 'ticket.4-1.hint.equation', vars: { vrms: 12, vpeak: 17, i: 0.1, f: 50, ripple: 1 } },
  },
  trace: {
    probe: 'v(out)', mode: 'clip', clip: 'OUT', unit: 'V', scale: 1, vdiv: 5, label: 'OUT', times: [0.02, 0.05], h: 1e-4,
    second: { probe: 'v(@xfmr-12#1.S1,@xfmr-12#1.S2)', label: 'SEC' }, settleFrom: 0.12, vdivs: [5, 2, 1, 0.5, 0.2], ac: true, acBand: 1.0,
    tube: { kind: 'windows', windows: [{ t0: 0.12, t1: 1, lo: 11.5, hi: 18.5 }] }, lockSpecs: ['ripple', 'mean'],
  },
  ref: {
    parts: [
      { partId: '1n4007', value: null, variant: 'DO41', x: 14, y: 2, rot: 0, flip: false },
      { partId: '1n4007', value: null, variant: 'DO41', x: 14, y: 6, rot: 0, flip: false },
      { partId: '1n4007', value: null, variant: 'DO41', x: 18, y: 10, rot: 2, flip: false },
      { partId: '1n4007', value: null, variant: 'DO41', x: 18, y: 13, rot: 2, flip: false },
      { partId: 'cap-el', value: 1000e-6, variant: '25V', x: 20, y: 6, rot: 1, flip: false },
    ],
    wires: [
      [[12, 2], [14, 2]], [[12, 6], [14, 6]], [[18, 2], [20, 2]], [[20, 2], [22, 2]], [[18, 6], [18, 2]], [[12, 2], [11, 2], [11, 10], [14, 10]], [[12, 6], [12, 13], [14, 13]],
      [[18, 10], [18, 13]], [[18, 13], [18, 14], [22, 14]], [[20, 6], [20, 2]], [[20, 8], [20, 13], [18, 13]],
    ],
  },
  specShort: 'ticket.4-1.short',
  scope: 'must',
  after: ['3-3|3-4'],
  pay: { fee: 1000, perStar: 250 },
  chit: { x: 0.22, y: 0.3 },
  coach: [
    { id: 'place', key: 'coach.4-1.s1', anchor: { target: 'bin', partId: '1n4007' }, done: 'part:1n4007&part:cap-el' },
    { id: 'wire', key: 'coach.4-1.s2', anchor: { target: 'part', partId: 'xfmr-12', pin: 'S1' }, done: 'wired&joined:OUT' },
    { id: 'power', key: 'coach.4-1.s3', anchor: { target: 'power' }, done: 'powered', when: 'wired' },
    { id: 'clip', key: 'coach.4-1.s4', anchor: { target: 'scope' }, done: 'probing', when: 'powered' },
    { id: 'run-bench', key: 'coach.4-1.s5', anchor: { target: 'bench' }, done: 'benched', when: 'wired' },
    { id: 'done', key: 'coach.4-1.s6', anchor: { target: 'chit' }, done: '!passed', when: 'passed' },
  ],
};
