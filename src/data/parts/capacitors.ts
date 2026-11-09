// Capacitor families (DESIGN §4.1). None of these has a datasheet read by M1-D1 (Murata/TDK/Panasonic/Nichicon PDFs were not
// reachable or not the cited series): every entry is Sandbox-only and UNVERIFIED. The campaign tickets that use them are listed
// in CAMPAIGN_BLOCKERS (index.ts). Electrolytic voltages 6.3-50 V and E6 capacitances are standard series values; ESR is v0.2.
import { eseries } from '../eseries';
import { TAU, TAU_R, semiThermal, variant } from './util';
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
    doc: 'Panasonic FR / Nichicon aluminium electrolytic series (DESIGN §4.1 [R]); Panasonic EEU-FR listings found by search state 105 C and +-20 %',
    note: GENERIC + 'The official Panasonic FR PDF could not be fetched. tMax 105 / tFail 125 follow DESIGN §3.9 (they are rules, 105 C is the series category temperature). thetaJA 40 C/W is an estimate. ESR not modelled (v0.2). ' + TAU_R,
  },
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

export const CAPACITORS: PartDef[] = [capC0g, capX2, capEl, capVar];
