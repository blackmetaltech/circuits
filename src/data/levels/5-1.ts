// Ticket 5-1 "Fan Driver" (DESIGN §2.8 chapter 5). Kit's maker space: a 5 V microcontroller pin (25 ohm output resistance, absolute maximum 40 mA) must run a 12 V fan (60 ohm + 10 mH, 200 mA). The bench tries the pin high, the pin low and a 100 Hz 50 % PWM on / off:
// the fan must see at least 11.0 V with the pin high and at most 0.5 V with it low, the pin may source at most 20 mA, and no part may be over its rating (the turn-off kick of the coil is in the PWM test).
// Numbers (src/engine/ch5.test.ts against the solver): ref 2N2222A + Rb 220 ohm + 1N4007 across the fan: fan 11.9 V, pin current 17.4 mA, Vce(sat) 0.1 V, kick clamped to 12.8 V; no flyback diode: the collector rips past Vceo and the transistor fails short;
// BC547B: 200 mA over its 100 mA; Rb 8.2 k leaves the transistor in its active region (Vce 3 V and more, over its 625 mW); Rb 47 ohm asks the pin for 52 mA.
// DEVIATIONS from DESIGN (each documented; none changes the lesson):
//  1. The pin is a bench-driven source (SupplyDef 'pin') and the fan the catalogue's `fan-dc` fixture (R 60 ohm, L 10 mH; the catalogue's 5 mH was an estimate); the "pin damaged" case is a failed spec (pin current <= 20 mA), not a smoke event: the pin is the customer's, not a part.
//  2. The bin has the E12 resistors 47 ohm - 47 kohm (the design names the TIP120 alternative with Rb 2.2 k: it is in the bin, its Vce(sat) in the macro is 0.83 V, so the fan reads 11.2 V: a pass with a thin margin, as the design says).
//     2N2222A and BC547B are UNVERIFIED catalogue rows (CAMPAIGN_BLOCKERS: onsemi answers 403 to a scripted fetch); the lesson (forced beta, Vceo, Ic) does not depend on the digits.
//  3. The thermal rule is the steady-state average power of the part (TO-92: 625 mW at 25 C, derated by the thermal model); Stars: head = cost, par = the ref's cost.
import { eseries } from '../eseries';
import type { LevelDef } from './types';

const pin = (v: number, pwm = 0): { target: string; key: string; value: number }[] => [{ target: 'pin', key: 'v', value: v }, { target: 'pin', key: 'pwm', value: pwm }];

export const L5_1: LevelDef = {
  id: '5-1', chapter: 5, titleKey: 'ticket.5-1.title', briefKey: 'ticket.5-1.brief', customer: 'maker', teaches: ['bjt-switch', 'forced-beta', 'base-resistor', 'flyback-diode'],
  board: {
    w: 24, h: 16,
    connectors: [
      { id: 'V12', pad: [2, 2], role: 'source' }, { id: 'PIN', pad: [2, 7], role: 'source' }, { id: 'COLL', pad: [22, 4], role: 'load' }, { id: 'GND', pad: [22, 14], role: 'ground' },
    ],
  },
  // the fan is soldered on: its + end to the 12 V pad, its - end to the COLL pad (the collector side of the fan)
  fixed: [{ uid: 'f1', partId: 'fan-dc', value: null, variant: '12V', x: 16, y: 2, rot: 0, flip: false, fixed: true }],
  fixedWires: [[[2, 2], [14, 2]], [[14, 2], [16, 2]], [[22, 2], [22, 4]]],
  supplies: [
    { id: 'psu12', kind: 'bench', plus: 'V12', minus: 'GND', fixed: 12 },
    { id: 'pin', kind: 'pin', plus: 'PIN', minus: 'GND', v: 5, rOut: 25, f: 100, duty: 0.5 },
  ],
  instruments: { supply: { v: 12, ilim: 1 }, scope: { timePerDiv: 2e-3, voltsPerDiv: [5, 5] } },
  bin: [
    { partId: '2n2222a', max: 1 }, { partId: 'bc547b', max: 1 }, { partId: 'tip120', max: 1 },
    { partId: '1n4007', max: 1 }, { partId: '1n4148', max: 1 },
    { partId: 'res-cf', values: eseries('E12', 47, 47e3), variants: ['0.25W'], max: 2 },
  ],
  constraints: { maxParts: 5 },
  bench: {
    h: 2e-5, settle: 0.02, window: 0.03, ic: 'zero', ambientC: 25,
    conditions: [{ id: 'pin high', set: pin(5) }, { id: 'pin low', set: pin(0) }, { id: '100 Hz PWM', set: pin(5, 1) }],
    specs: [
      { kind: 'level', id: 'fanhi', probe: 'v(v12,coll)', lo: 11.0, hi: 12.5 },
      { kind: 'level', id: 'fanlo', probe: 'v(v12,coll)', lo: -0.5, hi: 0.5 },
      { kind: 'level', id: 'ipin', probe: 'i(pin.r)', lo: -0.001, hi: 0.02 },
      { kind: 'rating', id: 'ratings' },
    ],
    only: { fanhi: ['pin high'], fanlo: ['pin low'], ipin: ['pin high'] },
    names: { fanhi: 'ticket.5-1.spec.fanhi', fanlo: 'ticket.5-1.spec.fanlo', ipin: 'ticket.5-1.spec.ipin' },
  },
  live: { frameSim: 0.004, h: 5e-5, thermalSpeed: 6 },
  selectors: [
    { id: 'pin', labelKey: 'ticket.5-1.sel.pin', initial: 0, options: [{ labelKey: 'ticket.5-1.sel.pin.high', cond: 'pin high', set: pin(5) }, { labelKey: 'ticket.5-1.sel.pin.low', cond: 'pin low', set: pin(0) }, { labelKey: 'ticket.5-1.sel.pin.pwm', cond: '100 Hz PWM', set: pin(5, 1) }] },
  ],
  stars: { head: 'cost', par: { cost: 8, parts: 3, power: 1e9, area: 120 } },
  explain: 'switch',
  hints: {
    nudge: 'ticket.5-1.hint.nudge',
    equation: { key: 'ticket.5-1.hint.equation', vars: { vfan: 12, rfan: 60, beta: 10, vpin: 5, vbe: 0.7, rpin: 25 } },
  },
  ref: {
    parts: [
      { partId: 'res-cf', value: 220, variant: '0.25W', x: 4, y: 7, rot: 0, flip: false },
      { partId: '2n2222a', value: null, variant: 'TO92', x: 14, y: 8, rot: 0, flip: false },
      { partId: '1n4007', value: null, variant: 'DO41', x: 10, y: 4, rot: 0, flip: false },
    ],
    wires: [[[2, 7], [4, 7]], [[8, 7], [15, 7], [15, 8]], [[14, 8], [14, 14], [22, 14]], [[16, 8], [16, 6]], [[16, 6], [22, 6], [22, 4]], [[10, 4], [10, 6], [16, 6]], [[14, 4], [14, 2]]],
  },
  gauge: { spec: 'ipin', unit: 'A' },
  specShort: 'ticket.5-1.short',
  scope: 'must',
  after: ['4-3|4-4'],
  pay: { fee: 1000, perStar: 250 },
  chit: { x: 0.3, y: 0.3 },
  coach: [
    { id: 'place', key: 'coach.5-1.s1', anchor: { target: 'bin', partId: '2n2222a' }, done: 'part:2n2222a|part:bc547b|part:tip120' },
    { id: 'base', key: 'coach.5-1.s2', anchor: { target: 'connector', connector: 'PIN' }, done: 'part:res-cf', when: 'part:2n2222a|part:bc547b|part:tip120' },
    { id: 'wire', key: 'coach.5-1.s3', anchor: { target: 'connector', connector: 'COLL' }, done: 'wired&joined:COLL&joined:PIN', when: 'part:res-cf' },
    { id: 'diode', key: 'coach.5-1.s3b', anchor: { target: 'bin', partId: '1n4007' }, done: 'part:1n4007|part:1n4148', when: 'wired&joined:PIN', optional: true },
    { id: 'diode-burn', key: 'coach.5-1.s3c', anchor: { target: 'bin', partId: '1n4007' }, done: 'part:1n4007|part:1n4148', when: 'burned&wired&joined:PIN' },
    { id: 'power', key: 'coach.5-1.s4', anchor: { target: 'power' }, done: 'powered', when: 'wired&joined:PIN' },
    { id: 'run-bench', key: 'coach.5-1.s5', anchor: { target: 'bench' }, done: 'benched', when: 'wired&joined:PIN' },
    { id: 'done', key: 'coach.5-1.s6', anchor: { target: 'chit' }, done: '!passed', when: 'passed' },
  ],
};
