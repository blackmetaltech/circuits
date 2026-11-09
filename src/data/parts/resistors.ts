// Resistor family (DESIGN §4.1). Sources read by M1-D1 on 2026-11-10 (Yageo/Bourns PDFs fetched and the quoted rows checked).
import { eseries } from '../eseries';
import { ACCESSED, TAU, TAU_R, resistorThermal, variant } from './util';
import type { PartDef } from './types';

/** Carbon film, 5 %. The datasheet series is E24 over 1 ohm-10 Mohm, so the catalogue carries E24 (a superset of the E12 of DESIGN §4.1, which ticket
 *  1-3 needs: its bin names 51 ohm, an E24-only value). Tickets pick E12 (or the named values) from `values`; campaign range 10 ohm-1 Mohm (and 2.2-10 ohm for ticket 1-4),
 *  the rest is Sandbox (DESIGN §4.1). Power is the rating at 70 C. Vmax = Yageo CFR "Maximum Working Voltage". */
export const RES_CF_CAMPAIGN_RANGE: readonly [number, number] = [10, 1e6];
const CF_VMAX: [string, number, number, number][] = [
  // id, P (W), Vmax (V), tau
  ['0.167W', 1 / 6, 150, TAU.axialQuarter], // CFR-12 (Yageo CFR has no 1/8 W)
  ['0.25W', 0.25, 250, TAU.axialQuarter],   // CFR-25
  ['0.5W', 0.5, 350, TAU.axialHalfToOne],   // CFR-50
  ['1W', 1, 400, TAU.axialHalfToOne],       // CFR-1WS
  ['2W', 2, 500, TAU.axialHalfToOne],       // CFR-2WS / CFR-200
];

export const resCf: PartDef = {
  id: 'res-cf', kind: 'R', nameKey: 'part.res-cf.name', footprint: 'axial2', pins: ['1', '2'],
  values: eseries('E24', 1, 1e7),
  variants: CF_VMAX.map(([id, p, vmax, tau]) => variant(id, { P: p, Vmax: vmax, Tamb: 70 }, resistorThermal(p, tau))),
  model: {},
  tolerance: { R: 0.05 },
  source: {
    doc: 'Yageo CFR Carbon Film Resistors product specification, 3 Apr 2024 V.3 (Table 1: power at 70 C, maximum working voltage, -55..+155 C, derating curve 100 % at 70 C to 0 at 155 C, E-series range 1 ohm-10 Mohm)',
    url: 'https://www.yageogroup.com/component-documentation/download/specsheet/CFR-25JB-52-1K', accessed: ACCESSED,
    note: 'Verified: Vmax 150/250/350/400/500 V (CFR-12/-25/-50/-1WS/-2WS rows; Sep 2023 V.2 gives the same, mirror https://cdn.sparkfun.com/assets/a/9/3/0/e/yageo-cfr_datasheet.pdf), derating knee 70 C / zero at 155 C, tolerance J = 5 %. '
      + 'Datasheet lists E24: the catalogue carries E24 so the 51 ohm of ticket 1-3 exists (DESIGN calls the family E12, but 51 is not an E12 value); bins select E12 with eseries(E12, lo, hi). 2 W variant tau is [R] borrowed from the 1/2-1 W class. ' + TAU_R,
  },
  verified: true, scope: 'campaign', simplifications: ['part.simplify.res-ideal'],
};

/** Ceramic encased 5 W wirewound (Yageo SQP500, J = 5 %). 5 W at 40 C per the datasheet; the game applies the DESIGN §3.9 rule theta = 85/P to every resistor (17 C/W). */
export const resWw5: PartDef = {
  id: 'res-ww5', kind: 'R', nameKey: 'part.res-ww5.name', footprint: 'axial2', pins: ['1', '2'],
  values: eseries('E12', 1, 100),
  variants: [variant('5W', { P: 5, Vmax: 350, Tamb: 40 }, resistorThermal(5, TAU.wirewound5W))],
  model: {},
  tolerance: { R: 0.05 },
  source: {
    doc: 'Yageo SQP / NSP Series (cement/ceramic wirewound) product specification, 10 Apr 2026 V.5: SQP500 5 W at 40 C, max working voltage 350 V, wirewound 0.015-130 ohm, -55..+155 C, tolerance F 1 % / J 5 %',
    url: 'https://www.yageogroup.com/component-documentation/download/specsheet/SQP500JB-0R47', accessed: ACCESSED,
    note: 'Verified: P 5 W (at 40 C), Vmax 350 V, wirewound range covers 1-100 ohm, J = 5 %. The datasheet rates 5 W at 40 C (not 70 C); the game keeps the §3.9 rule theta = 85/P_rated = 17 C/W for every resistor (a simplification: zero power at 155 C is the datasheet limit). Inductance of the winding is not modelled. ' + TAU_R,
  },
  verified: true, scope: 'campaign', simplifications: ['part.simplify.res-ideal', 'part.simplify.ww-inductance'],
};

/** Metal film 1 %, 1/4 W, E24 10 ohm-1 Mohm (121 values). */
export const resMf: PartDef = {
  id: 'res-mf', kind: 'R', nameKey: 'part.res-mf.name', footprint: 'axial2', pins: ['1', '2'],
  values: eseries('E24', 10, 1e6),
  variants: [variant('0.25W', { P: 0.25, Vmax: 250, Tamb: 70 }, resistorThermal(0.25, TAU.axialQuarter))],
  model: {},
  tolerance: { R: 0.01 },
  source: {
    doc: 'Yageo MFR Metal Film Resistors product specification, 3 Apr 2024 V.4 (MFR-25: 1/4 W at 70 C, 250 V max working voltage, E24/E96/E192, 1 ohm-4.7 Mohm, derating 70 -> 155 C, tolerance F = 1 %)',
    url: 'https://www.yageogroup.com/component-documentation/download/specsheet/MFR-25FRF52-10K', accessed: ACCESSED,
    note: 'Verified: P, Vmax 250 V (MFR-25 column), derating knee 70 C / 155 C, F = 1 %. REVIEW §1.5 listed the MFR derating as not re-fetched: re-fetched here (V.4). ' + TAU_R,
  },
  verified: true, scope: 'campaign', simplifications: ['part.simplify.res-ideal'],
};

/** Cermet trimmer, Bourns 3386 (0.5 W at 85 C, 300 V, +-10 %, standard values include 1k, 10k, 100k, 500k). */
export const potTrim: PartDef = {
  id: 'pot-trim', kind: 'POT', nameKey: 'part.pot-trim.name', footprint: 'pot3', pins: ['A', 'W', 'B'],
  values: [1e3, 1e4, 1e5, 5e5],
  variants: [variant('0.5W', { P: 0.5, Vmax: 300, Tamb: 85 }, { thetaJA: 80, tauS: TAU.axialHalfToOne, tMax: 125, tFail: 150 })],
  model: { alphaMin: 0.005, alphaMax: 0.995 },
  tolerance: { R: 0.1 },
  source: {
    doc: 'Bourns 3386 Trimming Potentiometer datasheet (power 0.5 W at 85 C, 300 V max, tolerance +-10 % std, -55..+125 C, standard resistance table incl. 1k/10k/100k/500k)',
    url: 'https://www.bourns.com/docs/Product-Datasheets/3386.pdf', accessed: ACCESSED,
    note: 'Verified: power/voltage/tolerance/temperature/values. alphaMin/Max 0.005/0.995 is the game wiper-end rule (DESIGN §3.7), not a datasheet item. thetaJA 80 C/W = (125-85)/0.5 W derived from the datasheet derating (0.5 W at 85 C, zero at the 125 C top of range); tFail 150 = tMax + 25 is [R]. ' + TAU_R,
  },
  verified: true, scope: 'campaign', simplifications: ['part.simplify.pot-wiper'],
};

/** 0.25 W panel potentiometer. DESIGN lists it as [R]: no datasheet read, so Sandbox-only. */
export const potPanel: PartDef = {
  id: 'pot-panel', kind: 'POT', nameKey: 'part.pot-panel.name', footprint: 'pot3', pins: ['A', 'W', 'B'],
  values: [1e3, 1e4, 1e5, 5e5],
  variants: [variant('0.25W', { P: 0.25 }, { thetaJA: 340, tauS: TAU.axialQuarter, tMax: 100, tFail: 125 })],
  model: { alphaMin: 0.005, alphaMax: 0.995 },
  tolerance: { R: 0.2 },
  source: { doc: 'generic 16 mm carbon panel potentiometer (DESIGN §4.1 [R])', note: 'UNVERIFIED: 0.25 W, +-20 % and the thermal numbers are recall/estimates, no datasheet read. ' + TAU_R },
  verified: false, scope: 'sandbox', simplifications: ['part.simplify.pot-wiper'],
};

export const RESISTORS: PartDef[] = [resCf, resWw5, resMf, potTrim, potPanel];
