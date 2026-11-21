// Ticket 4-3 "Hot Regulator" (DESIGN §2.8 chapter 4). Jun's 3D-printer controller board needs 5.00 V +-4 % at 0.1 - 0.5 A from a 15 V rail, and the regulator's junction must stay at or under 125 C at an ambient of 40 C ("inside the printer").
// The player places an LM7805 (bare, or with a clip-on heatsink of 25 / 15 / 8 C/W: the heatsink is a VARIANT of the chip in the shoebox) and, if they like, a power resistor ahead of it that takes part of the drop. The load is a constant-current sink (0.1 A and 0.5 A).
// Tj = Ta + P x theta; P = (Vin - 5) x I (the quiescent 5 mA aside); theta = 54 C/W bare (TI's application text), or thetaJC 4 + the pad 0.5 + the sink: 29.5 / 19.5 / 12.5 C/W. The regulator protects itself: at 150 C it shuts down and comes back at 135 C, which you see on the scope (OUT cycles) and on the thermal camera.
// Numbers (src/engine/ch4.test.ts against the solver): bare at 0.5 A: P = 5 W, Tj would be 310 C, the output cycles; the 8 C/W sink: 40 + 5 x 12.5 = 102.5 C (passes); the 15 C/W sink: 137.5 C (fails the 125 C limit, no cycling); the 25 C/W sink: 187.5 C
// (it cycles); the 10 ohm 5 W pre-drop + the 15 C/W sink: 5 V on the resistor, 10 V into the chip, P = 2.5 W, 40 + 2.5 x 19.5 = 88.8 C (passes, and the resistor makes 2.5 W inside its 5 W); a 22 ohm pre-drop leaves 4 V at 0.5 A (dropout).
// DEVIATIONS from DESIGN (each documented; none changes the lesson):
//  1. The heatsinks are variants of the LM7805 in the shoebox (LM7805 + 25 / 15 / 8 C/W sink), not separate parts: there is no board slot to clip one into, and the price is per variant (23 / 29 / 75 c vs 15 c bare).
//  2. The thermal clock is compressed: the macro's 60 s time constant (180 s with a sink) runs on a 0.4 s (1.2 s) clock inside the bench and the live view, so one bench window (3 s) and one scope sweep (2 s) show whole shutdown cycles. The steady-state Tj the bench checks does not depend on it.
//  3. The 9 V transformer tap of DESIGN is not built (the input is the 15 V rail only); its dropout lesson is the 22 ohm pre-drop here: with it, OUT falls below 4.8 V at 0.5 A.
//  4. The power resistors are E3 (2.2, 4.7, 10, 22 ohm, 5 W): the design's "2.2 - 22 ohm". A bare chip behind a 15 ohm would pass (P 1.25 W); E3 has no 12 or 15 ohm, and that is the point of the heatsink. The cheapest pass is the 25 C/W sink + 10 ohm (63 c), under the design's Ref B (69 c); par = Ref B.
import type { LevelDef } from './types';

const load = (i: number): { target: string; key: string; value: number }[] => [{ target: 'f1', key: 'i', value: i }];

export const L4_3: LevelDef = {
  id: '4-3', chapter: 4, titleKey: 'ticket.4-3.title', briefKey: 'ticket.4-3.brief', customer: 'printmaker', teaches: ['linear-regulator-dissipation', 'theta-ja-jc-sa', 'heatsinks', 'pre-drop-resistor', 'thermal-shutdown'],
  board: {
    w: 24, h: 16,
    connectors: [
      { id: 'IN', pad: [2, 2], role: 'source' }, { id: 'OUT', pad: [22, 2], role: 'load' }, { id: 'GND', pad: [22, 14], role: 'ground' },
    ],
  },
  fixed: [{ uid: 'f1', partId: 'load-cc', value: 0.5, variant: 'cc', x: 22, y: 4, rot: 1, flip: false, fixed: true }],
  fixedWires: [[[22, 2], [22, 4]], [[22, 10], [22, 14]]],
  supplies: [{ id: 'psu', kind: 'bench', plus: 'IN', minus: 'GND', fixed: 15 }],
  instruments: { supply: { v: 15, ilim: 1.5 }, scope: { timePerDiv: 0.2, voltsPerDiv: [1, 1] } },
  bin: [
    { partId: 'lm7805', max: 1 },
    { partId: 'res-ww5', values: [2.2, 4.7, 10, 22], variants: ['5W'], max: 1 },
  ],
  constraints: { maxParts: 3 },
  bench: {
    h: 2e-3, settle: 0.1, window: 3, ic: 'op', ambientC: 40, regTau: 0.4, tjLimit: 125,
    conditions: [{ id: '0.5 A', set: load(0.5) }, { id: '0.1 A', set: load(0.1) }],
    specs: [
      { kind: 'metric', id: 'vmin', probe: 'v(out)', metric: 'min', lo: 4.8, hi: 1e3 },
      { kind: 'metric', id: 'vmax', probe: 'v(out)', metric: 'max', lo: 0, hi: 5.2 },
      { kind: 'rating', id: 'ratings' },
    ],
    names: { vmin: 'ticket.4-3.spec.vmin', vmax: 'ticket.4-3.spec.vmax' },
  },
  live: { frameSim: 0.01, h: 2e-3, thermalSpeed: 40 },
  selectors: [
    { id: 'load', labelKey: 'ticket.4-3.sel.load', initial: 1, options: [{ labelKey: 'ticket.4-3.sel.load.100', set: load(0.1) }, { labelKey: 'ticket.4-3.sel.load.500', set: load(0.5) }] },
  ],
  stars: { head: 'cost', par: { cost: 69, parts: 2, power: 1e9, area: 160 } },
  explain: 'regulator',
  hints: {
    nudge: 'ticket.4-3.hint.nudge',
    equation: { key: 'ticket.4-3.hint.equation', vars: { ta: 40, tj: 125, vin: 15, vout: 5, i: 0.5 } },
  },
  trace: {
    probe: 'v(out)', mode: 'clip', clip: 'OUT', unit: 'V', scale: 1, vdiv: 1, label: 'OUT', times: [0.1, 0.2, 0.5], settleFrom: 0.1,
    tube: { kind: 'windows', windows: [{ t0: 0.1, t1: 10, lo: 4.8, hi: 5.2 }] }, lockSpecs: ['vmin', 'vmax'],
  },
  ref: {
    parts: [
      { partId: 'res-ww5', value: 10, variant: '5W', x: 4, y: 2, rot: 0, flip: false },
      { partId: 'lm7805', value: null, variant: 'TO220-15', x: 10, y: 6, rot: 0, flip: false },
    ],
    wires: [[[2, 2], [4, 2]], [[8, 2], [10, 2], [10, 6]], [[12, 6], [12, 14], [22, 14]], [[14, 6], [14, 2], [22, 2]]],
  },
  specShort: 'ticket.4-3.short',
  scope: 'must',
  after: ['4-2'],
  pay: { fee: 1100, perStar: 250 },
  chit: { x: 0.2, y: 0.62 },
  coach: [
    { id: 'place', key: 'coach.4-3.s1', anchor: { target: 'bin', partId: 'lm7805' }, done: 'part:lm7805' },
    { id: 'wire', key: 'coach.4-3.s2', anchor: { target: 'part', partId: 'lm7805', pin: 'IN' }, done: 'wired&joined:OUT&joined:IN' },
    { id: 'power', key: 'coach.4-3.s3', anchor: { target: 'power' }, done: 'powered', when: 'wired' },
    { id: 'clip', key: 'coach.4-3.s4', anchor: { target: 'scope' }, done: 'probing', when: 'powered' },
    { id: 'run-bench', key: 'coach.4-3.s5', anchor: { target: 'bench' }, done: 'benched', when: 'wired' },
    { id: 'done', key: 'coach.4-3.s6', anchor: { target: 'chit' }, done: '!passed', when: 'passed' },
  ],
};
