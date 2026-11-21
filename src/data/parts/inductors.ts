// Inductors and the transformer (DESIGN §4.1). No datasheet read by M1-D1 (Bourns 78F/RLB and Wurth WE-PD tables not fetched; DCR per
// value is not in DESIGN): every entry is Sandbox-only and UNVERIFIED. DCR numbers are estimates [R], flagged.
import { eseries } from '../eseries';
import { TAU, TAU_R, semiThermal, variant } from './util';
import type { PartDef } from './types';

const GENERIC = 'UNVERIFIED (DESIGN §4.1 [R], no datasheet read by M1-D1). ';

/** Axial inductor, E6 10 uH-100 mH. Variants by Isat; DCR is a per-variant ESTIMATE [R] (in ratings, ohm). */
export const indAx: PartDef = {
  id: 'ind-ax', kind: 'L', nameKey: 'part.ind-ax.name', footprint: 'axial2', pins: ['1', '2'],
  values: eseries('E6', 10e-6, 0.1),
  variants: [
    variant('0.1A', { Isat: 0.1, DCR: 5 }, semiThermal(150, 125, TAU.axialHalfToOne, { tFail: 150 })),
    variant('0.3A', { Isat: 0.3, DCR: 1.5 }, semiThermal(120, 125, TAU.axialHalfToOne, { tFail: 150 })),
  ],
  model: {}, tolerance: { L: 0.1 },
  source: { doc: 'Bourns 78F / RLB axial inductor class (DESIGN §4.1 [R])', note: GENERIC + 'DCR, Isat and thermal values are estimates, not table reads. ' + TAU_R },
  verified: false, scope: 'sandbox', simplifications: ['part.simplify.l-saturation'],
};

/** Shielded power inductor, 47/100/220 uH, Isat 0.5/1.0/1.5 A (used by the 8-x buck ticket). */
export const indPwr: PartDef = {
  id: 'ind-pwr', kind: 'L', nameKey: 'part.ind-pwr.name', footprint: 'axial2', pins: ['1', '2'],
  values: [47e-6, 100e-6, 220e-6],
  variants: [
    variant('0.5A', { Isat: 0.5, DCR: 0.8 }, semiThermal(80, 125, TAU.axialHalfToOne, { tFail: 150 })),
    variant('1.0A', { Isat: 1.0, DCR: 0.4 }, semiThermal(60, 125, TAU.axialHalfToOne, { tFail: 150 })),
    variant('1.5A', { Isat: 1.5, DCR: 0.25 }, semiThermal(50, 125, TAU.axialHalfToOne, { tFail: 150 })),
  ],
  model: {}, tolerance: { L: 0.2 },
  source: { doc: 'Wurth WE-PD shielded power inductor class (DESIGN §4.1 [R])', note: GENERIC + 'DCR and thermal values are estimates. ' + TAU_R },
  verified: false, scope: 'sandbox', simplifications: ['part.simplify.l-saturation'],
};

/** Radio-tank coil of ticket 7-x: 220 uH, "cheap" ESR 25 ohm vs "litz" ESR 4 ohm (DESIGN §2.8 game values). */
export const indCoil: PartDef = {
  id: 'ind-coil', kind: 'L', nameKey: 'part.ind-coil.name', footprint: 'axial2', pins: ['1', '2'],
  values: [220e-6],
  variants: [
    variant('cheap', { Isat: 0.1, DCR: 25 }, semiThermal(150, 125, TAU.axialHalfToOne, { tFail: 150 })),
    variant('litz', { Isat: 0.1, DCR: 4 }, semiThermal(150, 125, TAU.axialHalfToOne, { tFail: 150 })),
  ],
  model: {}, tolerance: { L: 0.1 },
  source: { doc: 'game-defined radio coil (DESIGN §2.8 ticket 7-4 bin)', note: 'UNVERIFIED: ESR 25 / 4 ohm are game values from DESIGN, not datasheet items. ' + TAU_R },
  verified: false, scope: 'sandbox', simplifications: ['part.simplify.l-saturation'],
};

/** Mains transformer 6 VA. secRms is the secondary rms at the NOMINAL primary (230 V here); the compiler derives the turns ratio from the
 *  region pack's mains (primaryNominal / secRms) so the same part works at 120 V (`na`). The 9 V tap and 12-0-12 versions of DESIGN §4.1
 *  need a 5-pin footprint that does not exist yet (types.ts FootprintId has xfmr4 only): requested, not added. */
export const xfmr12: PartDef = {
  id: 'xfmr-12', kind: 'XFMR', nameKey: 'part.xfmr-12.name', footprint: 'xfmr4', pins: ['P1', 'P2', 'S1', 'S2'],
  variants: [variant('6VA', { VA: 6 }, semiThermal(15, 105, TAU.to220Bare, { tFail: 130 }))],
  model: { primaryNominal: 230, secRms: 12, Rw: 1.5, VA: 6, Rins: 1e8 },
  tolerance: { Rw: 0.1 },
  source: {
    doc: 'GAME-DEFINED level fixture, not a datasheet part: 12 V mains wall-wart transformer of ticket 4-1 (DESIGN §4.1 [R], §2.8: ideal ratio, winding R 1.5 ohm)',
    gameFixture: true,
    note: 'UNVERIFIED, GAME-DEFINED level fixture: 6 VA and Rw 1.5 ohm (secondary side) are lesson values from DESIGN with no datasheet by design. The 10 H magnetising inductance of DESIGN §4.1 is NOT modelled (ticket 4-1 asks for an ideal ratio plus the winding resistance, as the ngspice cross-check does; Lm would only add a 73 mA reactive primary current nobody measures, and it stalls the stepper behind a 1N4148 bridge); '
      + 'primary nominal 230 V is the `global` mains (IEC 60038). Placed by the level as a fixed part, never offered from a shop bin. The thermal numbers are estimates. ' + TAU_R,
  },
  verified: false, scope: 'sandbox', simplifications: ['part.simplify.xfmr-ideal', 'part.simplify.xfmr-fixture'],
};

export const INDUCTORS: PartDef[] = [indAx, indPwr, indCoil, xfmr12];
