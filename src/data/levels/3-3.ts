// Ticket 3-3 "Relay Pull-in" (DESIGN §2.8 chapter 3). Sami's greenhouse irrigation controller: the relay (a fixed part: 200 ohm coil, 100 mH) must pull in within 0.40 ms of switch-on. It pulls in at 40 mA; the steady
// coil current must be 50 - 66 mA (the coil is rated 60 mA) and no part may be over its rating. The board offers a 12 V rail and a 24 V rail (two fixed bench supplies behind the V12 and V24 pads); the player wires
// one rail to the coil's COIL pad, with or without a series resistor from the E12 bin in 1/4, 1/2 and 1 W.
// RL rise: i(t) = Imax (1 - e^(-t Rtotal / L)), Imax = V / Rtotal, tau = L / Rtotal. The scope shows the COIL CURRENT (a built-in clamp: no clip needed) as a sweep from switch-on against an amber tube: the current must be
// above 40 mA by 0.40 ms and never above 66 mA (default 0.2 ms/div, a 2 ms sweep); LOCK also needs the crossing time and the steady current inside their specs. In the bench the relay's own armature really
// pulls in (the RLY event at 40 mA), the stall's relay clicks and its contacts close.
// Numbers (src/engine/ch3.test.ts, closed form and stepper): 12 V alone: Imax 60 mA, tau 0.5 ms, pull-in 0.549 ms (fails the speed); 24 V alone: 120 mA, the coil makes 2.88 W (its limit is 0.72 W: it overheats and smokes);
// 24 V + 200 ohm 1/4 W: the resistor smokes (0.72 W); the ref 24 V + 200 ohm 1 W gives 60 mA, tau 0.25 ms, pull-in 0.275 ms; 24 V + 180 ohm 1 W gives 63.2 mA and 0.264 ms; 24 V + 270 ohm 1 W gives 51.1 mA and 0.325 ms.
// DEVIATIONS from DESIGN (each documented; none changes the lesson):
//  1. The coil's heat limit: the catalogue relay has no coil power rating, so a game value is used (thetaJA 40 C/W, smoke at 110 C: 0.72 W is "rated", 2.9 W smokes); DESIGN only says "overheats (smoke)".
//  2. The steady-current spec is the PEAK coil current over the 20 ms bench window (the coil current rises monotonically): 50 - 66 mA.
//  3. Two fixed supplies instead of a 12 / 24 V switch: the rails are on the board, the player chooses by wiring. Stars: head = power (as designed), par 1.5 W from the supply: every passing design draws 1.2 - 1.5 W,
//     the 12 V design (0.72 W) is the one that is too slow: "speed costs watts".
//  4. The bin offers the E12 values 47 - 560 ohm plus 200 ohm (the design's ref is 200 ohm, an E24 value, not E12): 15 values in three powers; larger values would only fail the steady-current band.
import type { LevelDef } from './types';

const ms = 1e-3;

export const L3_3: LevelDef = {
  id: '3-3', chapter: 3, titleKey: 'ticket.3-3.title', briefKey: 'ticket.3-3.brief', customer: 'irrigation', teaches: ['rl-rise', 'time-constant', 'ldr-drive', 'speed-costs-power'],
  board: {
    w: 24, h: 16,
    connectors: [
      { id: 'V12', pad: [2, 2], role: 'source' }, { id: 'V24', pad: [2, 5], role: 'source' }, { id: 'COIL', pad: [16, 4], role: 'load' }, { id: 'GND', pad: [16, 8], role: 'ground' },
    ],
  },
  // the relay is soldered on: coil pin C1 on the COIL pad, C2 on the GND pad; its contacts (COM, NO, NC) switch the customer's valve, which is not part of this puzzle
  fixed: [{ uid: 'f1', partId: 'relay-12v', value: null, variant: '5A', x: 16, y: 4, rot: 0, flip: false, fixed: true }],
  // the contact side is wired to GND (the valve it would switch is the customer's, not part of this puzzle); the coil's far end C2 is on the GND pad
  fixedWires: [[[20, 4], [22, 4], [22, 10], [16, 10], [16, 8]]],
  supplies: [
    { id: 'psu12', kind: 'bench', plus: 'V12', minus: 'GND', fixed: 12 },
    { id: 'psu24', kind: 'bench', plus: 'V24', minus: 'GND', fixed: 24 },
  ],
  instruments: { supply: { v: 24, ilim: 0.5 }, scope: { timePerDiv: 0.2 * ms, voltsPerDiv: [1, 1] } },
  bin: [{ partId: 'res-cf', values: [47, 56, 68, 82, 100, 120, 150, 180, 200, 220, 270, 330, 390, 470, 560], variants: ['0.25W', '0.5W', '1W'] }],
  constraints: { maxParts: 2 },
  bench: {
    h: 1e-5, settle: 0, window: 20 * ms, ic: 'zero', ambientC: 25,
    conditions: [{ id: 'nominal' }],
    specs: [
      { kind: 'metric', id: 'tpull', probe: 'i(@relay-12v#1)', metric: 'crossingTime', params: { level: 0.04, edge: 'rising' }, lo: 0, hi: 0.4 * ms },
      { kind: 'metric', id: 'isteady', probe: 'i(@relay-12v#1)', metric: 'max', lo: 0.05, hi: 0.066 },
      { kind: 'rating', id: 'ratings' },
    ],
    names: { tpull: 'ticket.3-3.spec.tpull', isteady: 'ticket.3-3.spec.isteady' },
  },
  live: { frameSim: 0.015 * ms, h: 0.004 * ms, thermalSpeed: 8 },
  stars: { head: 'power', par: { cost: 99, parts: 2, power: 1.5e6, area: 90 } },
  explain: 'coil',
  hints: {
    nudge: 'ticket.3-3.hint.nudge',
    equation: { key: 'ticket.3-3.hint.equation', vars: { rCoil: 200, lCoil: 0.1, iPull: 0.04, tMax: 0.0004 } },
  },
  trace: {
    probe: 'i(@relay-12v#1)', mode: 'auto', unit: 'mA', scale: 1000, vdiv: 10, label: 'COIL', times: [0.05 * ms, 0.1 * ms, 0.2 * ms, 0.5 * ms, 1 * ms],
    tube: { kind: 'windows', windows: [{ t0: 0, t1: 0.4 * ms, lo: -1, hi: 0.066 }, { t0: 0.4 * ms, t1: 0.1, lo: 0.04, hi: 0.066 }] },
    lockSpecs: ['tpull', 'isteady'],
  },
  ref: {
    parts: [{ partId: 'res-cf', value: 200, variant: '1W', x: 6, y: 5, rot: 0, flip: false }],
    wires: [[[2, 5], [6, 5]], [[10, 5], [16, 5], [16, 4]]],
  },
  specShort: 'ticket.3-3.short',
  scope: 'must',
  after: ['3-1'],
  pay: { fee: 900, perStar: 200 },
  chit: { x: 0.3, y: 0.66 },
  coach: [
    { id: 'rail', key: 'coach.3-3.s1', anchor: { target: 'part', partId: 'relay-12v', pin: 'C1' }, done: 'wired&joined:COIL' },
    { id: 'power', key: 'coach.3-3.s2', anchor: { target: 'power' }, done: 'powered', when: 'wired' },
    { id: 'watch', key: 'coach.3-3.s3', anchor: { target: 'scope' }, done: 'benched', when: 'powered&!smoked' },
    { id: 'run-bench', key: 'coach.3-3.s4', anchor: { target: 'bench' }, done: 'benched', when: 'wired' },
    { id: 'done', key: 'coach.3-3.s5', anchor: { target: 'chit' }, done: '!passed', when: 'passed' },
  ],
};
