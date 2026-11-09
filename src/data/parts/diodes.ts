// Diodes, Zeners, Schottky, LEDs (DESIGN §4.2). Vishay PDFs were fetched and re-read on 2026-11-10 (1N4148 81857 Rev 1.6, 1N4001-7 88503 Rev
// 29-Apr-2020, 1N5817-9 88525 Rev 01-Jul-2020, 1N4728A-61A 85816 Rev 2.7, BZX55 85604); model lines are documented per part in source.note.
import { ACCESSED, TAU, TAU_R, semiThermal, variant } from './util';
import type { PartDef } from './types';

const VISHAY = 'https://www.vishay.com/docs';

/** 1N4148 (Vishay 81857). Ratings read from the PDF. MODEL: no vendor SPICE file for the plain DO-35 part could be read (see note), so
 *  (Is, N, Rs) are fitted by M1-D1 to the datasheet's own typical VF curves (Fig. 1, Tj = 25 C interpolated, graph read +-0.02 V). */
export const d1n4148: PartDef = {
  id: '1n4148', kind: 'D', nameKey: 'part.1n4148.name', footprint: 'axial2', pins: ['A', 'K'],
  variants: [variant('DO35', { VRRM: 100, VR: 75, IF: 0.3, IFAV: 0.15, IFRM: 0.5, IFSM: 2, Ptot: 0.5, VFmax10mA: 1.0 }, semiThermal(350, 175, TAU.do35))],
  model: { Is: 4.47e-9, N: 1.92, Rs: 0.35 },
  source: {
    doc: 'Vishay 1N4148 Small Signal Fast Switching Diodes, doc 81857 Rev 1.6 (07-Nov-2024); also Diodes Inc DS12019 Rev 7-2 (RthJA 300, Tj 175) for cross-check',
    url: `${VISHAY}/81857/1n4148.pdf`, accessed: ACCESSED,
    note: 'Ratings verified (VRRM 100 V, IF 300 mA, IF(AV) 150 mA, IFRM 500 mA, IFSM 2 A, Ptot 500 mW, RthJA 350 K/W, Tj 175 C, VF <= 1 V at 10 mA). '
      + 'MODEL: fitted (Is 4.47e-9 A, N 1.92, Rs 0.35 ohm) to Vishay Fig. 1 at 25 C read as 0.50 / 0.61 / 0.73 / 0.875 V at 0.1 / 1 / 10 / 100 mA (graph read, +-0.02 V; residuals <= 3 mV). '
      + 'Vendor SPICE files NOT used: Vishay publishes only a 1N4148WS (SOD-323) subcircuit, https://www.vishay.com/docs/85515/85515.txt: "model legd d is = 2.36581E-008 n = 2.60607 rs = 0.97235"; '
      + 'Nexperia 1N4148.txt (assets.nexperia.com/documents/spice-model/1N4148.txt) answered 403 to scripted fetch (a search snippet quoted IS 4.352E-9 N 1.906 RS 0.6458 but it was not read from the file). '
      + 'The earlier DESIGN values (2.52 nA, 1.752, 0.568 ohm) came from a forum quote of LTspice standard.dio and sit 20-40 mV below the datasheet curve. ' + TAU_R,
  },
  verified: true, scope: 'campaign', simplifications: ['part.simplify.diode-no-cap'],
};

/** 1N4007: model line exactly as Vishay publishes it (Thomatronik SPICE3 file, linked from doc 89789). */
export const d1n4007: PartDef = {
  id: '1n4007', kind: 'D', nameKey: 'part.1n4007.name', footprint: 'axial2', pins: ['A', 'K'],
  variants: [variant('DO41', { VRRM: 1000, VR: 1000, IFAV: 1, IFSM: 30, I2t: 3.7, VFtyp: 1.1 }, semiThermal(50, 150, TAU.do41))],
  model: { Is: 1.43733e-8, N: 1.80829, Rs: 0.0414712, BV: 1100, Ibv: 10 },
  source: {
    doc: 'Vishay 1N4001...1N4007 General Purpose Plastic Rectifier, doc 88503 Rev 29-Apr-2020; model: Vishay doc 89789 (1n4007.txt, Thomatronik GmbH, SPICE3)',
    url: `${VISHAY}/88503/1n4001.pdf`, accessed: ACCESSED,
    note: 'Ratings verified (VRRM 1000 V, IF(AV) 1 A at 75 C, IFSM 30 A, Tj 150 C, RthJA 50 C/W typical at 9.5 mm leads on PCB; VF 1.1 V in the primary-characteristics box). '
      + 'MODEL line read from https://www.vishay.com/docs/89789/1n4007.txt on 2026-11-10: ".model d1n4007 d is = 1.43733E-008 n = 1.80829 rs = 0.0414712 + eg = 1.11 xti = 3 tnom = 27 + cjo = 2.8119E-011 vj = 0.700053 m = 0.346714 fc = 0.5 + tt = 4.10886E-006 bv = 1100 ibv = 10 af = 1 kf = 0". '
      + 'Game uses Is, N, Rs, BV (1100 V as in the file; the 1000 V VRRM is the rating), Ibv; cjo/tt are not modelled. This replaces the DESIGN recall (76.9 pA, 1.45, 42 mohm): the 4-1 reference runs shift by ~30 mV per diode drop and must be re-checked by calibrate-levels. ' + TAU_R,
  },
  verified: true, scope: 'campaign', simplifications: ['part.simplify.diode-no-cap', 'part.simplify.diode-no-recovery'],
};

/** 1N5819 Schottky. Fit (Is, N, Rs) so the model hits the datasheet's MAXIMUM VF at two currents: 0.600 V at 1.0 A and 0.900 V at 3.1 A (Vishay 88525
 *  electrical table), with N pinned at 1.3 from the typical-curve slope of Fig. 3 (about 0.08 V/decade at 25 C below 0.1 A, graph read). Not a vendor SPICE file. */
export const d1n5819: PartDef = {
  id: '1n5819', kind: 'SCHOTTKY', nameKey: 'part.1n5819.name', footprint: 'axial2', pins: ['A', 'K'],
  variants: [variant('DO41', { VRRM: 40, VR: 40, IFAV: 1, IFSM: 25, VFmax1A: 0.6, VFmax3A1: 0.9 }, semiThermal(50, 125, TAU.do41))],
  model: { Is: 7.22e-7, N: 1.3, Rs: 0.1248 },
  source: {
    doc: 'Vishay 1N5817, 1N5818, 1N5819 Schottky Barrier Plastic Rectifier, doc 88525 Rev 01-Jul-2020',
    url: `${VISHAY}/88525/1n5817.pdf`, accessed: ACCESSED,
    note: 'Ratings verified (VRRM 40 V, IF(AV) 1 A, IFSM 25 A, Tj max 125 C, RthJA 50 C/W typical vertical PCB with 1.5 in copper pads, VF max 0.600 V at 1.0 A and 0.900 V at 3.1 A for the 1N5819 column; 0.45 V is the 1N5817 column, REVIEW E12). '
      + 'MODEL: fitted by M1-D1, a WORST-CASE (datasheet maximum) curve: N 1.3 pinned from the Fig. 3 slope, then Rs 0.1248 ohm and Is 7.22e-7 A solve the two maxima exactly (test shows residuals < 2 mV). '
      + 'The typical curve is about 0.2 V lower; the game takes the conservative one (named in the Codex). Vendor SPICE not obtained: Diodes Inc 1N5819.spice.txt is behind a bot wall (403/404), onsemi publishes none, a MODPEX file on cadlab.io (IS=1.19279e-05 RS=0.0625421, no N) is third-party and licence-restricted. ' + TAU_R,
  },
  verified: true, scope: 'campaign', simplifications: ['part.simplify.diode-no-cap', 'part.simplify.schottky-worstcase'],
};

/** Zener helper: Vishay 1N4728A-1N4761A. Model: BV = Vz at Izt, Ibv = Izt, Rs = Zzt - Nbv*Vt/Izt (Nbv 1, Vt 25.852 mV), so the small-signal Zzt matches the table.
 *  Forward Is/N are NOT datasheet items and are left out: the compiler uses the diode default (Is 1e-14 A, N 1). */
function zener(id: string, vz: number, izt: number, zzt: number, rs: number, izm: number): PartDef {
  return {
    id, kind: 'Z', nameKey: `part.${id}.name`, footprint: 'axial2', pins: ['A', 'K'],
    variants: [variant('DO41', { Vz: vz, Izt: izt, Zzt: zzt, Pd: 1.3, IZM: izm }, semiThermal(110, 175, TAU.do41))],
    model: { BV: vz, Ibv: izt, Rs: rs, Nbv: 1 },
    tolerance: { BV: 0.05 },
    source: {
      doc: 'Vishay 1N4728A to 1N4761A Zener Diodes, doc 85816 Rev 2.7 (07-Nov-2024)',
      url: `${VISHAY}/85816/1n4728a.pdf`, accessed: ACCESSED,
      note: `Verified: Vz ${vz} V at Izt ${izt * 1000} mA, Zzt ${zzt} ohm, Ptot 1300 mW, RthJA 110 K/W, Tj 175 C, tolerance +-5 % (A suffix). Rs ${rs} ohm = Zzt - Vt/Izt (a fit to Zzt, per DESIGN). Forward Is/N intentionally absent (not a datasheet item). ` + TAU_R,
    },
    verified: true, scope: 'campaign', simplifications: ['part.simplify.zener-model'],
  };
}
export const d1n4733a = zener('1n4733a', 5.1, 0.049, 7, 6.47, 0.178);
export const d1n4742a = zener('1n4742a', 12, 0.021, 9, 7.77, 0.076);
export const d1n4728a = zener('1n4728a', 3.3, 0.076, 10, 9.66, 0.276);

export const dBzx55: PartDef = {
  id: 'bzx55c5v1', kind: 'Z', nameKey: 'part.bzx55c5v1.name', footprint: 'axial2', pins: ['A', 'K'],
  variants: [variant('DO35', { Vz: 5.1, Izt: 0.005, Pd: 0.5, rzjMax: 35 }, semiThermal(300, 175, TAU.do35))],
  model: { BV: 5.1, Ibv: 0.005, Rs: 25, Nbv: 1 },
  tolerance: { BV: [4.8 / 5.1 - 1, 5.4 / 5.1 - 1] },
  source: {
    doc: 'Vishay BZX55 series Zener diodes, doc 85604 (BZX55C5V1 row: Vz 4.8/5.1/5.4 V at 5 mA, rzj < 35 ohm, RthJA 300 K/W, Ptot 500 mW, Tj 175 C)',
    url: `${VISHAY}/85604/bzx55.pdf`, accessed: ACCESSED,
    note: 'Verified: all ratings and the rzj bound. Rs 25 ohm is a fit under the 35 ohm maximum (REVIEW E12 corrected it from 60). tolerance BV is the fractional spread of the C-grade Vz window (4.8..5.4 V). Forward Is/N absent as for the 1N47xxA. ' + TAU_R,
  },
  verified: true, scope: 'campaign', simplifications: ['part.simplify.zener-model'],
};

/** Red 5 mm LED, Kingbright WP7113ID. The review refit; the first tickets are tuned on exactly N 2.0, Is 1.19e-17 A, Rs 9.9 ohm. */
export const ledRed: PartDef = {
  id: 'led-red-5mm', kind: 'LED', nameKey: 'part.led-red-5mm.name', footprint: 'radial2', pins: ['A', 'K'],
  variants: [variant('5mm', { IF: 0.03, IFwork: 0.02, IFP: 0.16, VR: 5, PD: 0.075, VFtyp10mA: 1.9, VFmax10mA: 2.3 },
    { thetaJA: 800, tauS: TAU.led, tMax: 85, tFail: 110 })],
  model: { N: 2.0, Is: 1.19e-17, Rs: 9.9 },
  source: {
    doc: 'Kingbright WP7113ID 5 mm red LED, DSAF0012 Rev V.14A [DESIGN §4.2 V; refit by the design review, REVIEW E1]',
    url: 'https://www.kingbright.com/attachments/file/psearch/000/00/00/WP7113ID(Ver.14A).pdf', accessed: ACCESSED,
    note: 'Ratings per DESIGN §4.2 [V] (IF 30 mA abs, IFP 160 mA at 1/10 duty 0.1 ms, VR 5 V, PD 75 mW; VF 1.9 typ / 2.3 max at 10 mA; curve about 1.70 V at 2 mA, 1.90 at 10, 2.00 at 20, graph read +-0.03 V). '
      + 'The Kingbright host blocks scripted fetch, so M1-D1 did NOT re-read this PDF; the numbers are carried from the review [V] mark. Model N 2.0 / Is 1.19e-17 A / Rs 9.9 ohm is the review refit (residuals <= 24 mV; a free 3-point fit gives an unphysical N 4.4, so N is pinned at 2) and is pinned by a test. '
      + 'The thermal numbers are NOT in DESIGN: thetaJA 800 C/W = (85 C - 25 C) / 75 mW with an assumed 85 C top rating, tMax 85 / tFail 110 are [R] estimates (the instant LED failures of DESIGN §3.9 do not use them). ' + TAU_R,
  },
  verified: true, scope: 'campaign', simplifications: ['part.simplify.led-fit', 'part.simplify.diode-no-cap'],
};

function ledColour(colour: string, vf20: number, is: number, n = 2.0): PartDef {
  return {
    id: `led-${colour}-5mm`, kind: 'LED', nameKey: `part.led-${colour}-5mm.name`, footprint: 'radial2', pins: ['A', 'K'],
    variants: [variant('5mm', { IF: 0.03, IFwork: 0.02, VFapprox20mA: vf20 }, { thetaJA: 800, tauS: TAU.led, tMax: 85, tFail: 110 })],
    // Not fitted: DESIGN says "fit per colour on data entry". Placeholder shape only, Sandbox + unverified. Is solves Vf(20 mA) = the quoted value with Rs 9.9 and N 2.0 (3.0 for blue/white, a placeholder shape).
    model: { N: n, Is: is, Rs: 9.9 },
    source: { doc: 'Kingbright WP7113 family colour LEDs (DESIGN §4.2 [R])', note: `UNVERIFIED: Vf ~ ${vf20} V at 20 mA is recall; Is is a placeholder tuned to that value, not a fit to a datasheet curve. ` + TAU_R },
    verified: false, scope: 'sandbox', simplifications: ['part.simplify.led-fit'],
  };
}
export const ledYellow = ledColour('yellow', 2.1, 2.11e-18);
export const ledGreen = ledColour('green', 2.2, 3.05e-19);
export const ledBlue = ledColour('blue', 3.1, 1.12e-18, 3.0);
export const ledWhite = ledColour('white', 3.1, 1.12e-18, 3.0);

export const DIODES: PartDef[] = [d1n4148, d1n4007, d1n5819, d1n4733a, d1n4742a, d1n4728a, dBzx55, ledRed, ledYellow, ledGreen, ledBlue, ledWhite];
