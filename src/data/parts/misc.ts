// Misc parts (DESIGN §4.1 last rows): relay, fuse, NTC, heater element, speaker, piezo, DC fan, slide wire, galvanometer.
// All "generic [R]" in DESIGN: no datasheet exists or was read, so every entry is Sandbox-only and UNVERIFIED. The numbers are the DESIGN game values.
import { TAU_R, variant } from './util';
import type { PartDef } from './types';

const GEN = (what: string) => `UNVERIFIED: generic ${what} (DESIGN §4.1 [R]); every number is a DESIGN game value, not a datasheet read. `;
const T = (theta: number, tMax: number) => ({ thetaJA: theta, tauS: 15, tMax, tFail: tMax + 25 });

export const relay: PartDef = {
  id: 'relay-12v', kind: 'RELAY', nameKey: 'part.relay-12v.name', footprint: 'relay5', pins: ['C1', 'C2', 'COM', 'NO', 'NC'],
  variants: [variant('5A', { Icontact: 5, Vcoil: 12 }, T(40, 85))],
  model: { Rcoil: 200, Lcoil: 0.1, Ipull: 0.04, Idrop: 0.015, RonContact: 0.05, RoffContact: 1e9 },
  source: { doc: 'generic 12 V relay, 200 ohm coil, 5 A contact (DESIGN §4.1 [R], §3.7)', note: GEN('relay') + TAU_R },
  verified: false, scope: 'sandbox', simplifications: ['part.simplify.relay-ideal'],
};

export const fuse: PartDef = {
  id: 'fuse', kind: 'FUSE', nameKey: 'part.fuse.name', footprint: 'block2', pins: ['1', '2'],
  variants: [variant('0.4A', { Irated: 0.4 }, T(50, 100)), variant('1A', { Irated: 1 }, T(50, 100))],
  model: { windowS: 0.05 },
  source: { doc: 'generic glass fuse 400 mA / 1 A (DESIGN §4.1 [R]); I2t accumulator over a 50 ms window (DESIGN §3.7)', note: GEN('fuse') + 'The cold resistance (R_cold) per rating is absent: DESIGN lists none. ' + TAU_R },
  verified: false, scope: 'sandbox', simplifications: ['part.simplify.fuse-i2t'],
};

export const ntc: PartDef = {
  id: 'ntc-10k', kind: 'NTC', nameKey: 'part.ntc-10k.name', footprint: 'block2', pins: ['1', '2'],
  variants: [variant('B3950', { Tmax: 125 }, T(100, 125))],
  model: { R25: 10e3, B: 3950, T0: 298.15 },
  tolerance: { R25: 0.05 },
  source: { doc: 'generic 10 k NTC thermistor, B = 3950 K (DESIGN §4.1 [R]); R(T) = R25 exp(B (1/T - 1/298.15))', note: GEN('NTC') + 'The 5 % R25 tolerance is a guess. ' + TAU_R },
  verified: false, scope: 'sandbox', simplifications: ['part.simplify.ntc-no-selfheat'],
};

export const heater: PartDef = {
  id: 'heater', kind: 'HEATER', nameKey: 'part.heater.name', footprint: 'block2', pins: ['1', '2'],
  variants: [variant('12V', { P: 3 }, T(20, 200))],
  model: { R: 50 },
  source: { doc: 'game-defined 12 V aquarium heater element, 50 ohm (DESIGN §2.8 ticket 1-3: fixed on the board)', note: GEN('heater element') + 'Rating P is an estimate. ' + TAU_R },
  verified: false, scope: 'sandbox', simplifications: [],
};

export const speaker: PartDef = {
  id: 'speaker-8', kind: 'SPEAKER', nameKey: 'part.speaker-8.name', footprint: 'block2', pins: ['1', '2'],
  variants: [variant('8ohm', { P: 0.5 }, T(60, 100))],
  model: { R: 8, L: 0.5e-3 },
  source: { doc: 'generic 8 ohm speaker (DESIGN §4.1 [R], R / R+L model)', note: GEN('speaker') + 'The 0.5 mH voice-coil inductance and 0.5 W rating are estimates. ' + TAU_R },
  verified: false, scope: 'sandbox', simplifications: ['part.simplify.speaker-model'],
};

export const piezo: PartDef = {
  id: 'piezo', kind: 'SPEAKER', nameKey: 'part.piezo.name', footprint: 'block2', pins: ['1', '2'],
  variants: [variant('buzzer', { Vmax: 12 }, T(100, 85))],
  model: { C: 20e-9, R: 500 },
  source: { doc: 'generic piezo sounder, C + R model (DESIGN §4.1 [R])', note: GEN('piezo sounder') + 'C 20 nF and R 500 ohm are estimates (DESIGN gives only "C+R"). ' + TAU_R },
  verified: false, scope: 'sandbox', simplifications: ['part.simplify.speaker-model'],
};

export const fan: PartDef = {
  id: 'fan-dc', kind: 'MOTOR', nameKey: 'part.fan-dc.name', footprint: 'block2', pins: ['+', '-'],
  variants: [variant('12V', { Vrated: 12 }, T(40, 85))],
  model: { R: 60, L: 5e-3 },
  source: { doc: 'generic 12 V DC fan / motor, R + L model (DESIGN §4.1 [R])', note: GEN('DC fan') + 'R 60 ohm and L 5 mH are estimates (DESIGN gives only "R+L"). Back-EMF is not modelled. ' + TAU_R },
  verified: false, scope: 'sandbox', simplifications: ['part.simplify.motor-model'],
};

export const slidewire: PartDef = {
  id: 'slidewire', kind: 'SLIDEWIRE', nameKey: 'part.slidewire.name', footprint: 'pot3', pins: ['A', 'J', 'B'],
  variants: [variant('100cm', { lengthM: 1 }, T(60, 100))],
  model: { Rtotal: 10, lengthM: 1 },
  source: { doc: 'game-defined 100 cm slide wire, 10 ohm total (DESIGN §2.8 ticket 2-2 bin)', note: GEN('slide wire') + TAU_R },
  verified: false, scope: 'sandbox', simplifications: [],
};

export const galvanometer: PartDef = {
  id: 'galvanometer', kind: 'METER', nameKey: 'part.galvanometer.name', footprint: 'block2', pins: ['+', '-'],
  variants: [variant('100ohm', {}, T(100, 100))],
  // rin: the METER expander reads it as a resistor (a 100 ohm coil); fs: the needle's full-scale current (the UI draws the needle from the engine's `galvo.needle`)
  model: { R: 100, rin: 100, fs: 50e-6 },
  source: { doc: 'game-defined moving-coil galvanometer, 100 ohm ammeter (DESIGN §3.7); needle dynamics are cosmetic', note: GEN('galvanometer') + 'The full-scale current is absent: DESIGN gives none. ' + TAU_R },
  verified: false, scope: 'sandbox', simplifications: ['part.simplify.galvo-cosmetic'],
};

const FIX = (what: string) => `UNVERIFIED, GAME-DEFINED level fixture: ${what} No datasheet exists by design; every number is a lesson value (DESIGN §2.8 chapter 2). `;
const FIX_DOC = (what: string) => `GAME-DEFINED level fixture, not a datasheet part: ${what}`;
const FIXED_T = { thetaJA: 40, tauS: 15, tMax: 150, tFail: 250 };

/** Ticket 2-1: the weather station's ADC input pin. A fixed 10 kohm load between OUT and GND. */
export const adcIn: PartDef = {
  id: 'adc-in', kind: 'LOAD', nameKey: 'part.adc-in.name', footprint: 'block2', pins: ['1', '2'],
  variants: [variant('10k', { P: 0.25 }, FIXED_T)],
  model: { R: 10e3 },
  source: { doc: FIX_DOC('the 10 kohm ADC input of the weather station (DESIGN §2.8 ticket 2-1)'), gameFixture: true, note: FIX('10 kohm input resistance of the ADC.') + TAU_R },
  verified: false, scope: 'sandbox', simplifications: ['part.simplify.adc-fixture'],
};

/** Ticket 2-2: the buried cable's loop resistance X (hidden; Learner 7.5 ohm = 75 m at 0.1 ohm per metre, two conductors). */
export const cableLoop: PartDef = {
  id: 'cable-loop', kind: 'LOAD', nameKey: 'part.cable-loop.name', footprint: 'block2', pins: ['1', '2'],
  variants: [variant('loop', { P: 2 }, FIXED_T)],
  model: { R: 7.5 },
  source: { doc: FIX_DOC('the loop resistance of the shorted telephone cable: 0.1 ohm per metre of cable, out and back (DESIGN §2.8 ticket 2-2)'), gameFixture: true, note: FIX('7.5 ohm is the Learner value; Engineer seeds 2 to 20 ohm.') + TAU_R },
  verified: false, scope: 'sandbox', simplifications: ['part.simplify.cable-fixture'],
};

/** Ticket 2-2: a 2 V cell with its 1 ohm rheostat already in the loop (the rheostat keeps the wire from heating; it is part of the fixture). */
export const cell2v: PartDef = {
  id: 'cell-2v', kind: 'MISC', nameKey: 'part.cell-2v.name', footprint: 'block2', pins: ['+', '-'],
  variants: [variant('2V', { emf: 2 }, FIXED_T)],
  model: { emf: 2, r: 1 },
  source: { doc: FIX_DOC('a 2 V lead-acid cell with a 1 ohm rheostat in series, the driver of the metre bridge (DESIGN §2.8 ticket 2-2)'), gameFixture: true, note: FIX('2.0 V and 1 ohm (cell plus rheostat) are the DESIGN numbers.') + TAU_R },
  verified: false, scope: 'sandbox', simplifications: ['part.simplify.cell-fixture'],
};

/** Ticket 2-4: the cell under test, EMF 1.5 V, internal resistance 0.5 ohm (the answer the student works out from the balance lengths). */
export const cellTest: PartDef = {
  id: 'cell-test', kind: 'MISC', nameKey: 'part.cell-test.name', footprint: 'block2', pins: ['+', '-'],
  variants: [variant('1.5V', { emf: 1.5 }, FIXED_T)],
  model: { emf: 1.5, r: 0.5 },
  source: { doc: FIX_DOC('the cell under test of the slide-wire potentiometer: EMF 1.5 V, r 0.5 ohm (DESIGN §2.8 ticket 2-4, oracle NC-08)'), gameFixture: true, note: FIX('1.5 V and 0.5 ohm come from the printed exam problem.') + TAU_R },
  verified: false, scope: 'sandbox', simplifications: ['part.simplify.cell-fixture'],
};

/** Ticket 2-3: the sealed module. Inside it a Thevenin source (the hidden EMF and r); the player never sees the parts, only the OUT terminal. */
export const blackbox: PartDef = {
  id: 'blackbox', kind: 'MISC', nameKey: 'part.blackbox.name', footprint: 'block2', pins: ['OUT', 'GND'],
  variants: [variant('sealed', {}, FIXED_T)],   // no ratings: the bench query shows ratings, and the box's EMF is the thing to measure
  model: { emf: 8, r: 1136.67 },
  source: { doc: FIX_DOC('the sealed sensor module of ticket 2-3: 12 V, 1 kohm series, 2 kohm shunt, 470 ohm out, which is exactly 8.000 V behind 1136.7 ohm (DESIGN §2.8)'), gameFixture: true, note: FIX('Vth 8.000 V and Rth 1136.7 ohm are the Learner values; the board holds the equivalent source (the network is exact).') + TAU_R },
  verified: false, scope: 'sandbox', simplifications: ['part.simplify.blackbox-fixture'],
};

/** The metre slide wire of tickets 2-2 and 2-4: a fixed 100 cm wire, 10 ohm, with a jockey (position along the wire from end A set by `setJockey`). */
export const slidewireM: PartDef = {
  id: 'slidewire-m', kind: 'SLIDEWIRE', nameKey: 'part.slidewire-m.name', footprint: 'slide3', pins: ['A', 'J', 'B'],
  variants: [variant('100cm', { lengthM: 1 }, T(60, 100))],
  model: { Rtotal: 10, lengthM: 1, rmin: 1e-3 },
  source: { doc: FIX_DOC('a 100 cm slide wire, 10 ohm total, with a sliding jockey (DESIGN §2.8 tickets 2-2 and 2-4)'), gameFixture: true, note: FIX('100 cm and 10 ohm are the DESIGN numbers.') + TAU_R },
  verified: false, scope: 'sandbox', simplifications: ['part.simplify.cell-fixture'],
};

/** Ticket 2-2: resistance-box plugs 1, 2, 5, 10, 20 ohm (two boxes in series give the sums). */
export const resBox: PartDef = {
  id: 'res-box', kind: 'R', nameKey: 'part.res-box.name', footprint: 'axial2', pins: ['1', '2'],
  variants: [variant('plug', { P: 3, Vmax: 100 }, { thetaJA: 85 / 3, tauS: 15, tMax: 155, tFail: 250 })],
  model: {},
  source: { doc: FIX_DOC('a laboratory resistance box with plugs 1, 2, 5, 10, 20 ohm (DESIGN §2.8 ticket 2-2)'), gameFixture: true, note: FIX('3 W and 100 V are estimates; the values are the DESIGN plugs.') + TAU_R },
  verified: false, scope: 'sandbox', simplifications: ['part.simplify.cell-fixture'],
};

/** Ticket 2-3: the 1 kohm trimmer, set by value in steps of 100 ohm (the game replaces the screw with a value list). */
export const trimmer: PartDef = {
  id: 'trimmer', kind: 'R', nameKey: 'part.trimmer.name', footprint: 'axial2', pins: ['1', '2'],
  variants: [variant('0.5W', { P: 0.5, Vmax: 300 }, { thetaJA: 170, tauS: 15, tMax: 125, tFail: 150 })],
  model: {},
  source: { doc: FIX_DOC('a 1 kohm trimmer, used as a variable resistor (DESIGN §2.8 ticket 2-3 bin); the ticket sets it by value'), gameFixture: true, note: FIX('Rated like the Bourns 3386 (0.5 W) but the wiper position is a value list here.') + TAU_R },
  verified: false, scope: 'sandbox', simplifications: ['part.simplify.trimmer-steps', 'part.simplify.cell-fixture'],
};

/** Ticket 2-4 textbook bin: an exact rheostat (any listed value, no power limit). */
export const rheostat: PartDef = {
  id: 'rheostat', kind: 'R', nameKey: 'part.rheostat.name', footprint: 'axial2', pins: ['1', '2'],
  variants: [variant('ideal', {}, { thetaJA: 1, tauS: 1, tMax: 1000, tFail: 2000 })], model: {}, tolerance: { R: 0 },
  source: { doc: 'Textbook ideal element, defined by its constitutive equation (no datasheet, no physical data)', definition: true, note: 'Exact value, no power rating. Textbook bins only. [R] no thermal model.' },
  verified: true, scope: 'campaign', simplifications: [],
};

/** Ticket 3-2: the 10 kohm pull-up of the arcade button's contact line, soldered between the 5 V rail and the SW pad. */
export const pullup: PartDef = {
  id: 'pullup-10k', kind: 'LOAD', nameKey: 'part.pullup-10k.name', footprint: 'block2', pins: ['1', '2'],
  variants: [variant('10k', { P: 0.25 }, FIXED_T)],
  model: { R: 10e3 },
  source: { doc: FIX_DOC('the 10 kohm pull-up of the arcade button (DESIGN §2.8 ticket 3-2)'), gameFixture: true, note: FIX('10 kohm to the 5 V rail.') + TAU_R },
  verified: false, scope: 'sandbox', simplifications: ['part.simplify.pullup-fixture'],
};

/** Ticket 3-2: the logic input the filtered signal feeds, 1 Mohm to ground. */
export const logicIn: PartDef = {
  id: 'logic-in', kind: 'LOAD', nameKey: 'part.logic-in.name', footprint: 'block2', pins: ['1', '2'],
  variants: [variant('1M', { P: 0.25 }, FIXED_T)],
  model: { R: 1e6 },
  source: { doc: FIX_DOC('the 1 Mohm logic input of the arcade board (DESIGN §2.8 ticket 3-2)'), gameFixture: true, note: FIX('1 Mohm input resistance of the logic input.') + TAU_R },
  verified: false, scope: 'sandbox', simplifications: ['part.simplify.pullup-fixture'],
};

/** Chapter 4: the customer's equipment as a CONSTANT-CURRENT load soldered between OUT and GND (the wall-wart's gadget, the radio, the 3D printer board, the bench load). The current is the placed part's value (A); a condition or a
 *  selector may override it (key 'i'). It switches on 30 ms after power-on (so the capacitors charge first, as a real gadget's supply sequencing does) and takes its current within 1 ms. */
export const loadCc: PartDef = {
  id: 'load-cc', kind: 'LOAD', nameKey: 'part.load-cc.name', footprint: 'block2', pins: ['+', '-'],
  variants: [variant('cc', {}, { thetaJA: 1, tauS: 15, tMax: 1000, tFail: 2000 })],   // the customer's equipment is not a part under test: it never warms, warns or smokes (at 40 C/W a 2.5 W load read 'warm' on the 4-3 bench and held the auto-bench back)
  model: { cc: 1, i: 0.1, ton: 0.03 },
  source: { doc: FIX_DOC('a constant-current load: the equipment the repair is for (DESIGN §2.8 chapter 4: "constant-current load")'), gameFixture: true, note: FIX('The current is set by the ticket; it draws it whatever the voltage (a real gadget does not, below its minimum voltage).') + TAU_R },
  verified: false, scope: 'sandbox', simplifications: ['part.simplify.load-cc-fixture'],
};

export const MISC: PartDef[] = [relay, fuse, ntc, heater, speaker, piezo, fan, slidewire, galvanometer, adcIn, cableLoop, cell2v, cellTest, blackbox, slidewireM, resBox, trimmer, rheostat, pullup, logicIn, loadCc];
