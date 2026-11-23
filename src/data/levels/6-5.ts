// Ticket 6-5 "Thermostat" (DESIGN §2.8 chapter 6). A science-fair incubator: the heater must come on below 47 C and go off above 53 C. A 10 k NTC (B 3950) is fixed in the incubator, its top on 5 V;
// the board has an LM393 comparator (open collector) on the same 5 V. OUT high = heater on. During the bench run the probe warms from 40 to 60 C and cools back to 40 C (20 ms each way, 1 K per ms),
// with noise on the probe. OUT must switch exactly twice: off once between 51 and 55 C on the way up, on once between 45 and 49 C on the way down, and read at least 4 V while the heater is on.
// The thermostat ARRIVES without hysteresis (3.6 kohm under the NTC to the - input, 10k / 10k to the + input, 4.7 kohm pull-up): it switches at 50.0 C both ways and chatters in the noise.
// The repair: positive feedback, 82 kohm from OUT to the + input (a Schmitt trigger): off at 52.8 C rising, on at 47.0 C falling (OA-14).
// Numbers (src/engine/ch6.test.ts against the solver): ref 82 kohm: 2 switchings, off at 52.8 C, on at 47.0 C (the noise moves each by up to 0.4 K), OUT 4.87 V on / 0.05 V off; 100 kohm also passes
// (52.3 / 47.5 C); the arrival switches 9 times (see the test); without the pull-up OUT never gets above 2.6 V (the open collector can only pull down: OUT rests near the + input's 2.5 V).
// DEVIATIONS from DESIGN (each documented; the smallest honest version of the sweep):
//  1. The engine's NTC had one temperature per bench condition. The sweep is new engine work kept small: the bench plan's `heat` gives the fixed NTC a temperature PROGRAM over the run (a PWL in
//     time, the NTCT element of sim/mna/devices/ntct.ts); there is no thermal model of the incubator (the heater does not warm the probe: the bench drives the temperature, as a test chamber would).
//  2. The time is compressed: 40 -> 60 -> 40 C takes 40 ms (1 K per ms), so the sweep fits a bench run and one scope screen. Nothing on the board has a time constant near that (no capacitors), so
//     the compression changes nothing the comparator sees.
//  3. DESIGN's 20 mV of sensor noise is noise on the probe TEMPERATURE: +-0.42 K, a new value every 0.1 ms (seeded, so every run is the same run). Near 50 C the sensor moves 47 mV per K, so
//     +-0.42 K is +-20 mV on the - input. The arrival chatters 9 times with this noise (DESIGN: "dozens"; the count depends on the noise's bandwidth).
//  4. OUT reading high is a spec of its own (at least 4.0 V): without the pull-up OUT rests near 2.5 V and never reads high (the 0.7 audit; DESIGN's "stuck low" was wrong).
//  5. The NTC is a fixed part (Sandbox-grade data: CAMPAIGN_BLOCKERS lists it); its 3.6 kohm partner is E24, so the bin is E24.
import { eseries } from '../eseries';
import type { LevelDef } from './types';

export const L6_5: LevelDef = {
  id: '6-5', chapter: 6, titleKey: 'ticket.6-5.title', briefKey: 'ticket.6-5.brief', customer: 'fair', teaches: ['comparator', 'ntc-thermistor', 'positive-feedback', 'hysteresis', 'open-collector'],
  board: {
    w: 24, h: 16,
    connectors: [{ id: 'V5', pad: [2, 1], role: 'rail' }, { id: 'OUT', pad: [22, 8], role: 'load' }, { id: 'GND', pad: [22, 14], role: 'ground' }],
  },
  // the incubator's probe: a 10 k NTC from the 5 V pad down to the sensor node (its lower lead, pad 3,8)
  fixed: [{ uid: 'f1', partId: 'ntc-10k', value: null, variant: 'B3950', x: 3, y: 2, rot: 1, flip: false, fixed: true }],
  fixedWires: [[[2, 1], [3, 1], [3, 2]]],
  // repair: no hysteresis. 3.6 kohm under the NTC, the sensor to the - input, 10k / 10k to the + input, 4.7 kohm pull-up on the open collector
  fault: {
    parts: [
      { partId: 'lm393', value: null, variant: 'DIP8', x: 13, y: 5, rot: 0, flip: false },
      { partId: 'res-cf', value: 3.6e3, variant: '0.25W', x: 5, y: 9, rot: 1, flip: false },
      { partId: 'res-cf', value: 10e3, variant: '0.25W', x: 9, y: 1, rot: 1, flip: false },
      { partId: 'res-cf', value: 10e3, variant: '0.25W', x: 9, y: 9, rot: 1, flip: false },
      { partId: 'res-cf', value: 4.7e3, variant: '0.25W', x: 20, y: 2, rot: 1, flip: false },
    ],
    wires: [
      [[3, 8], [5, 8], [5, 9]], [[5, 9], [7, 9], [7, 6], [13, 6]], [[5, 13], [5, 14], [9, 14]], [[9, 13], [9, 14]], [[9, 14], [13, 14]], [[13, 14], [22, 14]], [[13, 8], [13, 14]],
      [[9, 1], [9, 0]], [[9, 5], [9, 7]], [[9, 9], [9, 7]], [[9, 7], [11, 7]], [[11, 7], [13, 7]],
      [[16, 5], [16, 0]], [[16, 0], [9, 0]], [[9, 0], [2, 0], [2, 1]], [[20, 2], [20, 0], [16, 0]], [[13, 5], [13, 3], [18, 3], [18, 6], [20, 6]], [[20, 6], [20, 8]], [[20, 8], [22, 8]],
    ],
    smoked: [],
  },
  supplies: [{ id: 'psu5', kind: 'bench', plus: 'V5', minus: 'GND', fixed: 5 }],
  instruments: { supply: { v: 5, ilim: 0.1 }, scope: { timePerDiv: 4e-3, voltsPerDiv: [2, 2] } },
  bin: [
    { partId: 'lm393', max: 1 },
    { partId: 'res-cf', values: eseries('E24', 1e3, 1e6), variants: ['0.25W'], max: 6 },
  ],
  constraints: { maxParts: 7 },
  bench: {
    h: 2e-5, settle: 0, window: 0.04, ic: 'op', ambientC: 25,
    heat: { part: 'f1', pts: [[0, 40], [0.02, 60], [0.04, 40]], noiseK: 0.42, noiseDt: 1e-4, seed: 6005 },
    conditions: [{ id: 'sweep 40-60-40 C' }],
    specs: [
      { kind: 'metric', id: 'flips', probe: 'v(out)', metric: 'crossingCount', params: { level: 2.5, hyst: 2, edge: 'both' }, lo: 2, hi: 2 },
      { kind: 'metric', id: 'off', probe: 'v(out)', metric: 'crossingTime', params: { level: 2.5, hyst: 2, edge: 'falling', index: 0 }, lo: 0.011, hi: 0.015 },
      { kind: 'metric', id: 'on', probe: 'v(out)', metric: 'crossingTime', params: { level: 2.5, hyst: 2, edge: 'rising', index: 0 }, lo: 0.031, hi: 0.035 },
      { kind: 'metric', id: 'high', probe: 'v(out)', metric: 'max', lo: 4.0, hi: 5.1 },
      { kind: 'rating', id: 'ratings' },
    ],
    names: { flips: 'ticket.6-5.spec.flips', off: 'ticket.6-5.spec.off', on: 'ticket.6-5.spec.on', high: 'ticket.6-5.spec.high' },
  },
  live: { frameSim: 4e-4, h: 2e-5, thermalSpeed: 6 },
  stars: { head: 'parts', par: { cost: 99, parts: 6, power: 1e9, area: 240 } },
  explain: 'opamp',
  hints: {
    nudge: 'ticket.6-5.hint.nudge',
    equation: { key: 'ticket.6-5.hint.equation', vars: { rntc: 3588, rb: 3600, vcc: 5 } },
  },
  ref: {
    parts: [
      { partId: 'lm393', value: null, variant: 'DIP8', x: 13, y: 5, rot: 0, flip: false },
      { partId: 'res-cf', value: 3.6e3, variant: '0.25W', x: 5, y: 9, rot: 1, flip: false },
      { partId: 'res-cf', value: 10e3, variant: '0.25W', x: 9, y: 1, rot: 1, flip: false },
      { partId: 'res-cf', value: 10e3, variant: '0.25W', x: 9, y: 9, rot: 1, flip: false },
      { partId: 'res-cf', value: 4.7e3, variant: '0.25W', x: 20, y: 2, rot: 1, flip: false },
      { partId: 'res-cf', value: 82e3, variant: '0.25W', x: 14, y: 10, rot: 0, flip: false },
    ],
    wires: [
      [[3, 8], [5, 8], [5, 9]], [[5, 9], [7, 9], [7, 6], [13, 6]], [[5, 13], [5, 14], [9, 14]], [[9, 13], [9, 14]], [[9, 14], [13, 14]], [[13, 14], [22, 14]], [[13, 8], [13, 14]],
      [[9, 1], [9, 0]], [[9, 5], [9, 7]], [[9, 9], [9, 7]], [[9, 7], [11, 7]], [[11, 7], [13, 7]],
      [[16, 5], [16, 0]], [[16, 0], [9, 0]], [[9, 0], [2, 0], [2, 1]], [[20, 2], [20, 0], [16, 0]], [[13, 5], [13, 3], [18, 3], [18, 6], [20, 6]], [[20, 6], [20, 8]], [[20, 8], [22, 8]],
      [[14, 10], [11, 10], [11, 7]], [[18, 10], [20, 10], [20, 8]],
    ],
  },
  trace: {
    probe: 'v(out)', mode: 'clip', unit: 'V', scale: 1, clip: 'OUT', vdiv: 2, label: 'OUT', times: [4e-3], h: 2e-5,
    // heater on (high) until 51 C on the way up, off from 55 C up to the top and down to 49 C, on again from 45 C
    tube: { kind: 'windows', windows: [{ t0: 0, t1: 0.011, lo: 4.0, hi: 5.1 }, { t0: 0.015, t1: 0.031, lo: -0.1, hi: 1.0 }, { t0: 0.035, t1: 0.04, lo: 4.0, hi: 5.1 }] },
    lockSpecs: ['flips', 'off', 'on', 'high'],
  },
  onBoard: 'ticket.6-5.onboard',
  specShort: 'ticket.6-5.short',
  scope: 'must',
  after: ['6-1'],
  pay: { fee: 1500, perStar: 300 },
  chit: { x: 0.55, y: 0.62 },
  coach: [
    { id: 'power', key: 'coach.6-5.s1', anchor: { target: 'power' }, done: 'powered|benched' },
    { id: 'clip', key: 'coach.6-5.s2', anchor: { target: 'scope' }, done: 'probed|benched', when: 'powered', optional: true },
    { id: 'fix', key: 'coach.6-5.s3', anchor: { target: 'part', partId: 'lm393', pin: 'IN1+' }, done: 'passed', when: 'powered|benched' },
    { id: 'done', key: 'coach.6-5.s4', anchor: { target: 'chit' }, done: '!passed', when: 'passed' },
  ],
};
