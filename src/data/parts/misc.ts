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
  model: { R: 100 },
  source: { doc: 'game-defined moving-coil galvanometer, 100 ohm ammeter (DESIGN §3.7); needle dynamics are cosmetic', note: GEN('galvanometer') + 'The full-scale current is absent: DESIGN gives none. ' + TAU_R },
  verified: false, scope: 'sandbox', simplifications: ['part.simplify.galvo-cosmetic'],
};

export const MISC: PartDef[] = [relay, fuse, ntc, heater, speaker, piezo, fan, slidewire, galvanometer];
