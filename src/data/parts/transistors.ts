// BJTs and MOSFETs (DESIGN §4.2). Sources: 2N3904 Fairchild datasheet read in full by M1-D1 (model line included); the others carry DESIGN §4.2 [V] marks
// where the cited host answers 403 to scripted fetch (onsemi) and are flagged as not re-fetched. Parts whose MODEL values are recall/fit are unverified.
import { ACCESSED, TAU, TAU_R, semiThermal, variant } from './util';
import type { PartDef } from './types';

/** 2N3904: Is, Vaf, Br from the model line printed in the Fairchild (now onsemi) datasheet; Bf = 200, the midpoint of the datasheet hFE 100-300 at 10 mA
 *  (the model line's own Bf 416.4 is the datasheet-model value that the MIT 6.301 notes warn is far above the datasheet range: not used, DESIGN §3.3). */
export const q2n3904: PartDef = {
  id: '2n3904', kind: 'NPN', nameKey: 'part.2n3904.name', footprint: 'to92', pins: ['C', 'B', 'E'],
  variants: [variant('TO92', { Vceo: 40, Vcbo: 60, Vebo: 6, Ic: 0.2, Ptot: 0.625, hFEmin: 100, hFEmax: 300 }, semiThermal(200, 150, TAU.to92, { thetaJC: 83.3 }))],
  model: { Is: 6.734e-15, Bf: 200, Br: 0.7371, Vaf: 74.03 },
  tolerance: { Bf: [100, 300] },
  source: {
    doc: 'Fairchild Semiconductor 2N3904 / MMBT3904 / PZT3904 NPN General Purpose Amplifier, Rev A (2001); onsemi is the successor manufacturer',
    url: 'https://sy-dep-epc-lpc.web.cern.ch/components/datasheets/epc-lpc%20(converters)/2N3904%20Transistor%20(FAIRCHILD).pdf', accessed: ACCESSED,
    note: 'Ratings verified from the PDF text: Vceo 40 V, Vcbo 60 V, Vebo 6 V, Ic 200 mA, Ptot 625 mW, RthJA 200 C/W, RthJC 83.3 C/W, Tj max 150 C (the ratings note), hFE 100-300 at Ic 10 mA / Vce 1 V. '
      + 'MODEL line read from the same PDF: "NPN (Is=6.734f Xti=3 Eg=1.11 Vaf=74.03 Bf=416.4 Ne=1.259 Ise=6.734 Ikf=66.78m Xtb=1.5 Br=.7371 Nc=2 Isc=0 Ikr=0 Rc=1 Cjc=3.638p Mjc=.3085 Vjc=.75 Fc=.5 Cje=4.493p Mje=.2593 Vje=.75 Tr=239.5n Tf=301.2p Itf=.4 Vtf=4 Xtf=2 Rb=10)". '
      + 'Used: Is 6.734 fA, Vaf 74.03 V, Br 0.7371. Bf 200 is the midpoint of the datasheet hFE window (design choice, the game is EM-lite). Ne/Ise/Ikf/Rb/capacitances are not modelled (DESIGN §3.3). '
      + 'The onsemi PDF itself (onsemi.com/pdf/datasheet/2n3904-d.pdf) was not fetchable. ' + TAU_R,
  },
  verified: true, scope: 'campaign', simplifications: ['part.simplify.bjt-em-lite'],
};

/** 2N3906: ratings [V] in DESIGN; the model values are "model values, not datasheet items" (DESIGN), so the part is unverified. No campaign bin lists it. */
export const q2n3906: PartDef = {
  id: '2n3906', kind: 'PNP', nameKey: 'part.2n3906.name', footprint: 'to92', pins: ['C', 'B', 'E'],
  variants: [variant('TO92', { Vceo: 40, Ic: 0.2, Ptot: 0.625 }, semiThermal(200, 150, TAU.to92))],
  model: { Is: 1.41e-15, Bf: 180, Br: 4.98, Vaf: 18.7 },
  tolerance: { Bf: [100, 300] },
  source: { doc: 'ST 2N3906 datasheet (DESIGN §4.2: ratings [V], model values not datasheet items)', note: 'UNVERIFIED: model Is/Bf/Br/Vaf are recall of a classic model, ratings (-40 V, -200 mA, 625 mW, 200 C/W) carried from DESIGN [V] but the PDF was not re-fetched; the Bf tolerance window is a guess. Not in any campaign bin. ' + TAU_R },
  verified: false, scope: 'sandbox', simplifications: ['part.simplify.bjt-em-lite'],
};

/** P2N2222A (TO-92). Ratings [V] in DESIGN (onsemi P2N2222A/D); model numbers have no source in DESIGN. */
export const q2n2222a: PartDef = {
  id: '2n2222a', kind: 'NPN', nameKey: 'part.2n2222a.name', footprint: 'to92', pins: ['E', 'B', 'C'],
  variants: [variant('TO92', { Vceo: 40, Ic: 0.6, Ptot: 0.625 }, semiThermal(200, 150, TAU.to92, { thetaJC: 83.3 }))],
  model: { Is: 1e-14, Bf: 200, Br: 3, Vaf: 100 },
  tolerance: { Bf: [100, 300] },
  source: { doc: 'onsemi P2N2222A/D (DESIGN §4.2 ratings [V]: Vceo 40 V, Ic 600 mA, Pd 625 mW, RthJA 200, RthJC 83.3 C/W)', url: 'https://www.onsemi.com/pdf/datasheet/p2n2222a-d.pdf', accessed: ACCESSED,
    note: 'UNVERIFIED: the model values (Is 1e-14, Bf 200, Br 3, Vaf 100) have no cited source, and the onsemi PDF answers 403 to scripted fetch so ratings were not re-read; the Bf window is a guess. Needed by ticket 5-x (campaign blocker). ' + TAU_R },
  verified: false, scope: 'sandbox', simplifications: ['part.simplify.bjt-em-lite'],
};

/** BC547B: DESIGN says model "[R fit]". theta derived from Ptot 500 mW (125 C / 0.5 W). */
export const qBc547b: PartDef = {
  id: 'bc547b', kind: 'NPN', nameKey: 'part.bc547b.name', footprint: 'to92', pins: ['C', 'B', 'E'],
  variants: [variant('TO92', { Vceo: 45, Ic: 0.1, Ptot: 0.5, hFEmin: 200, hFEmax: 450 }, semiThermal(250, 150, TAU.to92))],
  model: { Is: 1.8e-14, Bf: 290, Vaf: 80, Br: 5 },
  tolerance: { Bf: [200, 450] },
  source: { doc: 'onsemi BC546/BC547/BC548 series (DESIGN §4.2: hFE 200-450, Ic 100 mA, Vceo 45 V, Pc 500 mW [V ratings]; model [R fit])', url: 'https://www.onsemi.com/pdf/datasheet/bc546-d.pdf', accessed: ACCESSED,
    note: 'UNVERIFIED: the model (Is, Bf 290, Vaf 80) is a recall fit and Br 5 is a placeholder (DESIGN gives none); the onsemi PDF answers 403 so ratings were not re-read. thetaJA 250 C/W is derived as (150-25)/0.5 W, not read. Needed by tickets 5-x/6-x (campaign blocker). ' + TAU_R },
  verified: false, scope: 'sandbox', simplifications: ['part.simplify.bjt-em-lite'],
};

/** TIP120 Darlington. Per-stage Is/Bf are not datasheet items; the composite hFE and the internal resistors are (onsemi TIP120/D Rev 9 per DESIGN [V]). */
export const qTip120: PartDef = {
  id: 'tip120', kind: 'DARLINGTON', nameKey: 'part.tip120.name', footprint: 'to220', pins: ['B', 'C', 'E'],
  variants: [variant('TO220', { Vceo: 60, Ic: 5, IcPeak: 8, Ptot: 65, PtotAir: 2, VceSatMax: 2.0, hFEmin: 1000 },
    semiThermal(62.5, 150, TAU.to220Bare, { thetaJC: 1.92, heatsinkable: true }))],
  model: { hFEmin: 1000, Rb: 8000, Re: 120, VceSat: 2.0 },
  tolerance: { hFE: [1000, 5000] },
  source: {
    doc: 'onsemi TIP120/D Rev 9 (DESIGN §4.2 [V]: hFE >= 1000 at 0.5 A and 3 A, Vce(sat) 2.0 V max at 3 A / IB 12 mA, 5 A (8 A peak), 65 W at Tc 25 C, 2 W free air, Vceo 60 V, thetaJC 1.92)',
    url: 'https://www.onsemi.com/pdf/datasheet/tip120-d.pdf', accessed: ACCESSED,
    note: 'Ratings carried from the DESIGN [V] mark (not re-read: onsemi answers 403 to scripted fetch). thetaJA 62.5 C/W is derived from the 2 W free-air-at-25-C rating as (150-25)/2 W (Tj max 150 C), not read. Model: only composite hFE and the internal 8 k / 120 ohm are datasheet items (per-stage Is/Bf are not given; the compiler derives them, DESIGN §3.3). The upper hFE tolerance 5000 is a placeholder window (UNVERIFIED part of the tolerance only). ' + TAU_R,
  },
  verified: true, scope: 'campaign', simplifications: ['part.simplify.bjt-em-lite', 'part.simplify.darlington'],
};

/** 2N7000. Kp = 1/(Rds(on) (Vgs - Vt)) at 10 V: 1/(2.4 * (10 - 2.1)) = 0.0527 A/V^2 (square-law convention of DESIGN §3.3). */
export const m2n7000: PartDef = {
  id: '2n7000', kind: 'NMOS', nameKey: 'part.2n7000.name', footprint: 'to92', pins: ['S', 'G', 'D'],
  variants: [variant('TO92', { Vds: 60, Id: 0.2, Pd: 0.4, VgsMax: 20, RdsOnMax10V: 5 }, semiThermal(312.5, 150, TAU.to92))],
  model: { Vt: 2.1, Kp: 0.0527, lambda: 0.02 },
  tolerance: { Vt: [0.8, 3.0] },
  source: {
    doc: 'Vishay Siliconix 2N7000 / 2N7002 / BS170 family, doc 70226 (Vds 60 V, Id 0.2 A, PD 0.4 W, RthJA 312.5 C/W, TJ -55..150 C, Vgs(th) 2.1 typ at 1 mA, 0.8-3 V in the family table)',
    url: 'https://www.vishay.com/docs/70226/70226.pdf', accessed: ACCESSED,
    note: 'Verified from the PDF: Vds, Id, PD, RthJA, Tj max 150 C, VGS(th) typ 2.1 V, Vgs +-20 V continuous, Rds(on) max 5 ohm at 10 V. Rds 2.4 ohm typ at 10 V is the REVIEW-corrected value (E2) read at the 0.5 A curve; the 0.2 A test table prints 2.3 typ. Kp = 1/(2.4*(10-2.1)) = 0.0527 A/V^2. lambda 0.02 is a DESIGN value, not a datasheet item (UNVERIFIED field). The Vt window 0.8-3 V is the family table; the detailed table prints 0.8-2.5 for the 2N7000 column. ' + TAU_R,
  },
  verified: true, scope: 'campaign', simplifications: ['part.simplify.mos-level1'],
};

/** IRLZ44N: Kp from the WORST-CASE Rds(on) 25 mohm max at Vgs 5 V (Infineon): 1/(0.025*(5-1.5)) = 11.43. */
export const mIrlz44n: PartDef = {
  id: 'irlz44n', kind: 'NMOS', nameKey: 'part.irlz44n.name', footprint: 'to220', pins: ['G', 'D', 'S'],
  variants: [variant('TO220', { Vds: 55, Id: 47, Pd: 110, VgsMax: 16, RdsOn5V: 0.025, RdsOn10V: 0.022, RdsOn4V: 0.035 },
    semiThermal(62, 175, TAU.to220Bare, { thetaJC: 1.4, heatsinkable: true }))],
  model: { Vt: 1.5, Kp: 11.4, lambda: 0.01 },
  tolerance: { Vt: [1.0, 2.0] },
  source: {
    doc: 'Infineon / International Rectifier IRLZ44N HEXFET Power MOSFET (RDS(on) 22 mohm at 10 V, 25 mohm at 5 V max, VGS(th) 1.0-2.0 V, RthJA 62, RthJC 1.4 C/W, TJ max 175 C)',
    url: 'https://www.infineon.com/dgdl/irlz44npbf.pdf', accessed: ACCESSED,
    note: 'Verified from the PDF text: RDS(on) 0.022 ohm (10 V) / 0.025 ohm (5 V, 25 A), VGS(th) 1.0-2.0 V, RthJA 62 C/W, TJ -55..+175 C; Vds 55 V, Id 47 A, Pd 110 W per DESIGN [V]. The datasheet Vgs max is +-16 V while DESIGN §3.8 applies a uniform 20 V rule (flagged: the 16 V is stored in VgsMax, the engine rule uses 20 V). Kp 11.4 is a worst-case fit (Vt 1.5 is the window midpoint). lambda 0.01 is a DESIGN value. 35 mohm at 4 V per DESIGN. ' + TAU_R,
  },
  verified: true, scope: 'campaign', simplifications: ['part.simplify.mos-level1', 'part.simplify.mos-worstcase'],
};

/** IRF540N: Kp at 10 V from Rds(on) 44 mohm max: 1/(0.044*(10-3)) = 3.247. */
export const mIrf540n: PartDef = {
  id: 'irf540n', kind: 'NMOS', nameKey: 'part.irf540n.name', footprint: 'to220', pins: ['G', 'D', 'S'],
  variants: [variant('TO220', { Vds: 100, Id: 33, VgsMax: 20, RdsOn10V: 0.044 }, semiThermal(62, 175, TAU.to220Bare, { thetaJC: 1.15, heatsinkable: true }))],
  model: { Vt: 3.0, Kp: 3.247, lambda: 0.01 },
  tolerance: { Vt: [2.0, 4.0] },
  source: {
    doc: 'Infineon / International Rectifier IRF540N HEXFET Power MOSFET (Vds 100 V, Id 33 A, RDS(on) 44 mohm max at 10 V, VGS(th) 2-4 V, RthJA 62 C/W, TJ max 175 C)',
    url: 'https://www.infineon.com/dgdl/irf540npbf.pdf', accessed: ACCESSED,
    note: 'Verified from the PDF text: RthJA 62 C/W, RthJC 1.15, ID 33 A, TJ -55..+175 C; Vds, Rds(on), Vgs(th) per DESIGN [V]. thetaJC 1.15 C/W and Id 33 A (at Tc 25 C) are read from the PDF. lambda 0.01 is a DESIGN value. ' + TAU_R,
  },
  verified: true, scope: 'campaign', simplifications: ['part.simplify.mos-level1', 'part.simplify.mos-worstcase'],
};

/** Textbook NPN (ticket 5-5): a constant 0.700 V base-emitter drop when on, collector current exactly beta times the base current, saturation at 0.2 V. Textbook bins only. */
export const npnTextbook: PartDef = {
  id: 'npn-textbook', kind: 'NPN', nameKey: 'part.npn-textbook.name', footprint: 'to92', pins: ['C', 'B', 'E'],
  variants: [variant('ideal', { Vceo: 1000 }, { thetaJA: 1, tauS: 1, tMax: 1000, tFail: 2000 })],
  model: { ideal: 1, Is: 1e-14, Bf: 100, Vaf: 1e6, vf: 0.7, vcesat: 0.2 },
  source: { doc: 'Textbook ideal element, defined by its constitutive equation (no datasheet, no physical data)', definition: true, note: 'Vbe = 0.700 V when on, Ic = beta x Ib with beta = 100, Vce(sat) = 0.2 V. Textbook bins only (DESIGN ticket 5-5: "fixed-0.7 V BJT model"). [R] no thermal model.' },
  verified: true, scope: 'campaign', simplifications: ['part.simplify.bjt-textbook'],
};

export const TRANSISTORS: PartDef[] = [q2n3904, q2n3906, q2n2222a, qBc547b, qTip120, m2n7000, mIrlz44n, mIrf540n, npnTextbook];
