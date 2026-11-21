// Capacitor families (DESIGN §4.1). None of these has a datasheet read by M1-D1 (Murata/TDK/Panasonic/Nichicon PDFs were not
// reachable or not the cited series): every entry is Sandbox-only and UNVERIFIED. The campaign tickets that use them are listed
// in CAMPAIGN_BLOCKERS (index.ts). cap-el now carries Panasonic EEU-FR rows (capEl.fr.ts) for 220-4700 uF at 10-35 V; the rest of its grid is unverified.
import { eseries } from '../eseries';
import { TAU, TAU_R, semiThermal, variant } from './util';
import { EEU_FR_ROWS } from './capEl.fr';
import type { PartDef } from './types';

const GENERIC = 'UNVERIFIED (DESIGN §4.1 [R], no datasheet read by M1-D1). ';

/** Multilayer ceramic C0G/X7R, E6 10 pF-1 uF, 50 V. X7R DC-bias capacitance loss is not modelled (flagged). */
export const capC0g: PartDef = {
  id: 'cap-cer', kind: 'C', nameKey: 'part.cap-cer.name', footprint: 'axial2', pins: ['1', '2'],
  values: eseries('E6', 10e-12, 1e-6),
  variants: [variant('50V', { Vrated: 50 }, { thetaJA: 200, tauS: TAU.axialQuarter, tMax: 125, tFail: 150 })],
  model: {}, tolerance: { C: 0.1 },
  source: { doc: 'Murata / TDK C0G and X7R MLCC families (DESIGN §4.1 [R])', note: GENERIC + 'Tolerance 10 % is the DESIGN §2.2 value; thermal numbers are estimates. ' + TAU_R },
  verified: false, scope: 'sandbox', simplifications: ['part.simplify.x7r-bias'],
};

/** Film X2 mains-rated suppression capacitor (IEC 60384-14), 275 VAC. */
export const capX2: PartDef = {
  id: 'cap-x2', kind: 'C', nameKey: 'part.cap-x2.name', footprint: 'axial2', pins: ['1', '2'],
  values: [0.1e-6, 0.15e-6, 0.22e-6, 0.33e-6, 0.47e-6],
  variants: [variant('275VAC', { Vrated: 275, VratedAC: 275 }, { thetaJA: 100, tauS: TAU.axialHalfToOne, tMax: 100, tFail: 125 })],
  model: {}, tolerance: { C: 0.1 },
  source: { doc: 'generic film X2 capacitor, IEC 60384-14 (DESIGN §4.1 [R])', note: GENERIC + 'IEC 60384-14 itself was not read (paywalled). ' + TAU_R },
  verified: false, scope: 'sandbox', simplifications: [],
};

/** Aluminium electrolytic, polarised. Variants by voltage; values E6 1-4700 uF. Price depends on value too (regions/global/prices.ts). */
const ELEC_V = [6.3, 10, 16, 25, 35, 50];
export const capEl: PartDef = {
  id: 'cap-el', kind: 'CE', nameKey: 'part.cap-el.name', footprint: 'radial2', pins: ['+', '-'],
  values: eseries('E6', 1e-6, 4.7e-3),
  variants: ELEC_V.map((v) => variant(`${v}V`, { Vrated: v, VrevMax: 1 }, semiThermal(40, 105, TAU.electrolytic, { tFail: 125 }))),
  model: {}, tolerance: { C: 0.2 },
  source: {
    doc: 'Panasonic EEU-FR series, datasheet footer 04 May 2013, mirror https://datasheetq.com/pdf-view/EEU-FR0J102B-Panasonic.pdf, accessed 2026-11-10',
    url: 'https://datasheetq.com/pdf-view/EEU-FR0J102B-Panasonic.pdf',
    accessed: '2026-11-10',
    note: 'PARTLY UNVERIFIED. valueData holds the verified rows: 220-4700 uF at 10/16/25/35 V as listed in the series (pages EEE-83 case/impedance/ripple, EEE-84 10 V, EEE-85 16 V and 25 V, EEE-86 35 V, EEE-82 leakage and tan delta). ESR = impedance at 100 kHz, +20 C (the datasheet gives impedance, not ESR; ESR is slightly lower). Ripple = 100 kHz, +105 C. Leakage I = 0.01*C*V uA. Not in the series, so unverified and Sandbox-only: 330 uF at 10 V and 16 V, 4700 uF at 25 V and 35 V, 3300 uF at 35 V (generic E6 values and the 6.3 V / 50 V variants and values below 220 uF are likewise unlisted here). tMax 105 / tFail 125 follow DESIGN §3.9 (they are rules, 105 C is the series category temperature). thetaJA 40 C/W is an estimate. The device model does not use ESR yet (v0.2). ' + TAU_R,
  },
  valueData: EEU_FR_ROWS,
  verified: false, scope: 'sandbox', simplifications: ['part.simplify.cap-esr'],
};

/** Tuning (variable) capacitor, 10-365 pF, classic AM gang. */
export const capVar: PartDef = {
  id: 'cap-var', kind: 'C', nameKey: 'part.cap-var.name', footprint: 'axial2', pins: ['1', '2'],
  variants: [variant('365pF', { Vrated: 100 }, { thetaJA: 200, tauS: TAU.axialQuarter, tMax: 100, tFail: 125 })],
  model: { Cmin: 10e-12, Cmax: 365e-12 }, tolerance: { C: 0.1 },
  source: { doc: 'classic AM tuning gang 10-365 pF (DESIGN §4.1 [R])', note: GENERIC + 'Vrated 100 V is an estimate. ' + TAU_R },
  verified: false, scope: 'sandbox', simplifications: [],
};

const IDEAL_THERMAL = { thetaJA: 1, tauS: 1, tMax: 1000, tFail: 2000 }; // never heats (Textbook bins only)

/** Textbook ideal capacitor (ticket 3-4): exact value, no voltage rating, a 1 Gohm bleeder in parallel so a node between two capacitors still has a DC path (DESIGN §3.4). */
export const capIdeal: PartDef = {
  id: 'cap-ideal', kind: 'C', nameKey: 'part.cap-ideal.name', footprint: 'axial2', pins: ['1', '2'],
  variants: [variant('ideal', {}, IDEAL_THERMAL)], model: { rbleed: 1e9 }, tolerance: { C: 0 },
  source: { doc: 'Textbook ideal element, defined by its constitutive equation (no datasheet, no physical data)', definition: true, note: 'i = C dv/dt with a 1 Gohm bleeder in parallel (DESIGN §3.4: the DC operating point of a capacitor network needs a path). Textbook bins only. [R] no thermal model.' },
  verified: true, scope: 'campaign', simplifications: ['part.simplify.cap-bleed'],
};

/** Ticket 3-4 card (b): a 4 uF capacitor that arrives charged to 100 V, soldered on the board next to a switch. A fixture: it is never offered from a shop bin. */
export const capCharged: PartDef = {
  id: 'cap-charged', kind: 'C', nameKey: 'part.cap-charged.name', footprint: 'block2', pins: ['+', '-'],
  variants: [variant('4uF-100V', {}, IDEAL_THERMAL)], model: { c: 4e-6, ic: 100, rbleed: 1e9 },
  source: { doc: 'GAME-DEFINED level fixture, not a datasheet part: the pre-charged 4 uF capacitor (100 V) of ticket 3-4 card (b) (DESIGN §2.8)', gameFixture: true, note: 'UNVERIFIED, GAME-DEFINED level fixture: 4 uF charged to 100 V is the printed problem; the 1 Gohm bleeder is the textbook DC path. Placed by the level as a fixed part, never offered from a shop bin. [R] no thermal model.' },
  verified: false, scope: 'sandbox', simplifications: ['part.simplify.cap-bleed', 'part.simplify.cap-fixture'],
};

export const CAPACITORS: PartDef[] = [capC0g, capX2, capEl, capVar, capIdeal, capCharged];
