// Batteries and textbook ideal elements (DESIGN §4.4, §2.8 ticket 1-5). Instruments are NOT parts: see instruments.ts.
// Battery model: { emf, r } (capacity is not modelled in v0.1). Variants carry no physics, so each state is its own part id.
import { ACCESSED, TAU_R, semiThermal, variant } from './util';
import type { PartDef } from './types';

const BAT_THERMAL = semiThermal(60, 60, 60, { tFail: 85 }); // estimate [R]: a battery that is shorted heats; no datasheet number in DESIGN

/** 9 V PP3 alkaline, fresh: Duracell MN1604 impedance 1,700 mohm at 1 kHz (read in the Farnell-hosted spec sheet). */
export const batPp3: PartDef = {
  id: 'bat-pp3', kind: 'MISC', nameKey: 'part.bat-pp3.name', footprint: 'block2', pins: ['+', '-'],
  variants: [variant('fresh', { emf: 9.0 }, BAT_THERMAL)],
  model: { emf: 9.0, r: 1.7 },
  tolerance: { r: [0, 0.235] },
  source: {
    doc: 'Duracell MN1604 (9V alkaline) specification sheet: nominal internal impedance 1,700 mohm at 1 kHz',
    url: 'https://www.farnell.com/datasheets/3625657.pdf', accessed: ACCESSED,
    note: 'Verified from the PDF text: "Impedance 1,700 m-ohm @ 1 kHz" (r = 1.7 ohm). EMF 9.0 V is the nominal voltage. The 1.7-2.1 ohm spread across makers (REVIEW E12) is the Monte Carlo tolerance window on r. Capacity not modelled; thermal numbers are estimates. ' + TAU_R,
  },
  verified: true, scope: 'campaign', simplifications: ['part.simplify.battery-no-capacity'],
};

/** "Tired" PP3 of ticket 1-2: EMF 8.4 V, r 6 ohm. A scenario value DEFINED BY THE GAME (DESIGN §4.4), not a datasheet number. */
export const batPp3Tired: PartDef = {
  id: 'bat-pp3-tired', kind: 'MISC', nameKey: 'part.bat-pp3-tired.name', footprint: 'block2', pins: ['+', '-'],
  variants: [variant('tired', { emf: 8.4 }, BAT_THERMAL)],
  model: { emf: 8.4, r: 6 },
  source: { doc: 'game-defined "tired" 9 V battery (DESIGN §4.4)', note: 'UNVERIFIED: 8.4 V / 6 ohm are game-defined scenario values, not datasheet numbers. Ticket 1-2 should put them in its conditions (level data); this part exists so the Sandbox can offer it. ' + TAU_R },
  verified: false, scope: 'sandbox', simplifications: ['part.simplify.battery-no-capacity'],
};

/** AA alkaline: DESIGN [V] Energizer EN91, r 0.146 ohm fresh. The cited PDF URLs (data.energizer.com) answered 404 in 2026-11, so nothing was re-read. */
export const batAa: PartDef = {
  id: 'bat-aa', kind: 'MISC', nameKey: 'part.bat-aa.name', footprint: 'block2', pins: ['+', '-'],
  variants: [variant('fresh', { emf: 1.5 }, BAT_THERMAL)],
  model: { emf: 1.5, r: 0.146 },
  source: { doc: 'Energizer EN91 AA alkaline (DESIGN §4.4 [V]: r 0.146 ohm fresh; 0.3 ohm part-used is a game value)', note: 'UNVERIFIED by M1-D1: the Energizer data-sheet URLs tried (data.energizer.com/pdfs/E91.pdf, e91.pdf) returned 404, so the DESIGN [V] value could not be re-read or given a working URL. ' + TAU_R },
  verified: false, scope: 'sandbox', simplifications: ['part.simplify.battery-no-capacity'],
};

export const batCr2032: PartDef = {
  id: 'bat-cr2032', kind: 'MISC', nameKey: 'part.bat-cr2032.name', footprint: 'block2', pins: ['+', '-'],
  variants: [variant('fresh', { emf: 3.0 }, BAT_THERMAL)],
  model: { emf: 3.0, r: 25 },
  source: { doc: 'Energizer CR2032 (DESIGN §4.4 [V graph read]: r ~ 25 ohm fresh, 40 ohm late)', note: 'UNVERIFIED by M1-D1: the Energizer CR2032 PDF URL returned 404, so the DESIGN graph-read value could not be re-read or given a working URL. ' + TAU_R },
  verified: false, scope: 'sandbox', simplifications: ['part.simplify.battery-no-capacity'],
};

const IDEAL_DOC = 'Textbook ideal element, defined by its constitutive equation (no datasheet, no physical data)';
const IDEAL_THERMAL = { thetaJA: 1, tauS: 1, tMax: 1000, tFail: 2000 }; // never heats (Textbook bins only)

export const idealV: PartDef = {
  id: 'ideal-vsource', kind: 'MISC', nameKey: 'part.ideal-vsource.name', footprint: 'block2', pins: ['+', '-'],
  variants: [variant('ideal', {}, IDEAL_THERMAL)], model: { r: 0 },
  source: { doc: IDEAL_DOC, definition: true, note: 'V = E for every current; r = 0. Textbook bins only (DESIGN §3.7). [R] no thermal model (ideal parts never heat).' },
  verified: true, scope: 'campaign', simplifications: [],
};
export const idealI: PartDef = {
  id: 'ideal-isource', kind: 'MISC', nameKey: 'part.ideal-isource.name', footprint: 'block2', pins: ['+', '-'],
  variants: [variant('ideal', {}, IDEAL_THERMAL)], model: { g: 0 },
  source: { doc: IDEAL_DOC, definition: true, note: 'I = I0 for every voltage; infinite output resistance. Textbook bins only. [R] no thermal model.' },
  verified: true, scope: 'campaign', simplifications: [],
};
export const resExact: PartDef = {
  id: 'res-exact', kind: 'R', nameKey: 'part.res-exact.name', footprint: 'axial2', pins: ['1', '2'],
  variants: [variant('ideal', {}, IDEAL_THERMAL)], model: {}, tolerance: { R: 0 },
  source: { doc: IDEAL_DOC, definition: true, note: 'Exact value (tolerance 0), no power rating, any positive value. Textbook bins only. [R] no thermal model.' },
  verified: true, scope: 'campaign', simplifications: [],
};

export const SOURCES: PartDef[] = [batPp3, batPp3Tired, batAa, batCr2032, idealV, idealI, resExact];
