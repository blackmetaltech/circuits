// ICs (DESIGN §4.3). Every datasheet below was fetched from TI/Microchip on 2026-11-10 and the revision matches DESIGN's [V] mark (SNOSC25D, SLOS068AB, SLOS080W, SLOS075K,
// DS20001733L, SLCS005AH, SLFS022K, SNOSBT0L, SLVS044Z); thetaJA values are the PDIP-8 (or TO-220) rows read from each PDF. The macro-model parameters are
// exactly the ones DESIGN §4.3 lists: parameters it does not list (Ro, Rin where not given, Iq, offsets, A0 where not given) are ABSENT, not invented;
// the macros take their defaults from sim/ (documented in the report).
import { ACCESSED, TAU, TAU_R, semiThermal, variant } from './util';
import type { PartDef } from './types';

const TI = 'https://www.ti.com/lit/ds/symlink';
const dip8 = (theta: number, tj: number, ratings: Record<string, number>) => [variant('DIP8', ratings, semiThermal(theta, tj, TAU.dip8))];
const DUAL_PINS = ['OUT1', 'IN1-', 'IN1+', 'V-', 'IN2+', 'IN2-', 'OUT2', 'V+'];

export const lm741: PartDef = {
  id: 'lm741', kind: 'OPAMP', nameKey: 'part.lm741.name', footprint: 'dip8', pins: ['OS1', 'IN-', 'IN+', 'V-', 'OS2', 'OUT', 'V+', 'NC'],
  variants: dip8(100, 150, { VsMaxAbs: 36 }),
  model: { vccMin: 10, vccMax: 36, A0: 2e5, GBW: 1e6, SR: 0.5e6, Rin: 2e6, Isc: 0.025, headHi: 2, headLo: 2 },
  tolerance: {},
  source: {
    doc: 'TI LM741 operational amplifier, SNOSC25D (May 1998, revised Oct 2015)', url: `${TI}/lm741.pdf`, accessed: ACCESSED,
    note: 'Verified from the PDF: Rin 2 Mohm typ (VS +-20 V, 25 C), Isc 25 mA, SR 0.5 V/us (LM741, unity gain), RthJA 100 C/W for the P (PDIP) package, supply +-5..+-18 V per DESIGN. A0 200 V/mV typ and the +-13 V swing into 2 kohm at +-15 V (headroom 2 V) are DESIGN [V] values. GBW 1 MHz is TYPICAL, not specified by TI for the LM741 (the LM741A row gives 0.437-1.5 MHz; REVIEW resolved). Tj max 150 C is the DESIGN §3.9 default for ICs. ' + TAU_R,
  },
  verified: true, scope: 'campaign', simplifications: ['part.simplify.opamp-macro'],
};

export const lm358: PartDef = {
  id: 'lm358', kind: 'OPAMP', nameKey: 'part.lm358.name', footprint: 'dip8', pins: DUAL_PINS,
  variants: dip8(80.9, 150, { VsMaxAbs: 32 }),
  model: { vccMin: 3, vccMax: 32, GBW: 0.7e6, SR: 0.3e6, Isc: 0.04, Iq: 0.7e-3, headHi: 1.5, headHiHighSupply: 2, footLo: 0.005, cmLo: 0, cmHi: 1.5 },
  tolerance: {},
  source: {
    doc: 'TI LM358 / LM258 / LM2904 dual operational amplifiers, SLOS068AB', url: `${TI}/lm358.pdf`, accessed: ACCESSED,
    note: 'Verified from the PDF: TJ 150 C, RthJA 80.9 C/W (P, PDIP-8). Supply 3-32 V, GBW 0.7 MHz, SR 0.3 V/us, high swing V+ - 1.5 V (V+ - 2 V above 10 V supply), low ~5 mV, common-mode V- .. V+ - 1.5 V, Isc 40 mA, Iq 0.7 mA are the DESIGN [V] values. A0 is not in DESIGN and is absent. ' + TAU_R,
  },
  verified: true, scope: 'campaign', simplifications: ['part.simplify.opamp-macro'],
};

export const tl072: PartDef = {
  id: 'tl072', kind: 'OPAMP', nameKey: 'part.tl072.name', footprint: 'dip8', pins: DUAL_PINS,
  variants: dip8(85, 150, { VsMaxAbs: 36 }),
  model: { vccMin: 10, vccMax: 36, GBW: 5.25e6, SR: 20e6, SRmin: 8e6, Rin: 1e12, Isc: 0.04, headHi: 1.5, headLo: 1.5, cmLo: 4, cmHi: 4 },
  tolerance: {},
  source: {
    doc: 'TI TL07xx low-noise JFET-input operational amplifiers, SLOS080W (Sep 1978, revised Jul 2025)', url: `${TI}/tl072.pdf`, accessed: ACCESSED,
    note: 'Verified from the PDF: TJ 150 C, RthJA 85 C/W (P, PDIP-8, dual). GBW 5.25 MHz (3 MHz for the NS/PS/M variants; the game uses 5.25), SR 20 V/us typ / 8 min (SLOS080W; 13 was an older revision), swing +-13.5 V typ into 10 kohm at +-15 V (headroom 1.5), CM +-11 V min (so 4 V from each rail at +-15 V), Isc 40 mA, Rin 1e12 are DESIGN [V]. ' + TAU_R,
  },
  verified: true, scope: 'campaign', simplifications: ['part.simplify.opamp-macro'],
};

export const ne5532: PartDef = {
  id: 'ne5532', kind: 'OPAMP', nameKey: 'part.ne5532.name', footprint: 'dip8', pins: DUAL_PINS,
  variants: dip8(85, 150, { VsMaxAbs: 40 }),
  model: { vccMin: 6, vccMax: 40, GBW: 12e6, SR: 5e6 },
  tolerance: {},
  source: {
    doc: 'TI NE5532, NE5532A, SA5532, SA5532A dual low-noise operational amplifiers, SLOS075K', url: `${TI}/ne5532.pdf`, accessed: ACCESSED,
    note: 'Verified from the PDF: TJ 150 C, RthJA 85 C/W (P, PDIP-8). Supply +-3..+-20 V, GBW 12 MHz and SR 5 V/us per DESIGN [V] (Table B1; the revision history confirms 10 -> 12 MHz and 9 -> 5 V/us; REVIEW resolved the product-page conflict toward the datasheet). ' + TAU_R,
  },
  verified: true, scope: 'campaign', simplifications: ['part.simplify.opamp-macro'],
};

export const mcp6002: PartDef = {
  id: 'mcp6002', kind: 'OPAMP', nameKey: 'part.mcp6002.name', footprint: 'dip8', pins: DUAL_PINS,
  variants: dip8(85, 150, { VsMaxAbs: 7 }),
  model: { vccMin: 1.8, vccMax: 6, GBW: 1e6, SR: 0.6e6, Isc: 0.023, headHi: 0.025, footLo: 0.025 },
  tolerance: {},
  source: {
    doc: 'Microchip MCP6001/1R/1U/2/4 1 MHz low-power op amp, DS20001733L', url: 'https://ww1.microchip.com/downloads/en/DeviceDoc/MCP6001-1R-1U-2-4-1-MHz-Low-Power-Op-Amp-DS20001733L.pdf', accessed: ACCESSED,
    note: 'Verified from the PDF: max junction temperature 150 C, 8-lead PDIP thetaJA 85 C/W. Supply 1.8-6 V (VDD-VSS absolute maximum 7.0 V, read), GBW 1 MHz, SR 0.6 V/us, rail-to-rail ~25 mV, Isc +-23 mA at 5.5 V per DESIGN [V]. ' + TAU_R,
  },
  verified: true, scope: 'campaign', simplifications: ['part.simplify.opamp-macro'],
};

export const lm393: PartDef = {
  id: 'lm393', kind: 'CMP', nameKey: 'part.lm393.name', footprint: 'dip8', pins: ['OUT1', 'IN1-', 'IN1+', 'GND', 'IN2+', 'IN2-', 'OUT2', 'VCC'],
  variants: dip8(114.9, 150, { VsMaxAbs: 36 }),
  model: { vccMin: 2, vccMax: 36, IsinkMin: 0.006, IsinkTyp: 0.021, VolMax4mA: 0.4, tResponse: 1.3e-6, cmLo: 0, cmHi: 1.5, cmHiOverTemp: 2 },
  tolerance: {},
  source: {
    doc: 'TI LM393 / LM2903 dual differential comparators, SLCS005AH', url: `${TI}/lm393.pdf`, accessed: ACCESSED,
    note: 'Verified from the PDF: TJ 150 C, RthJA 114.9 C/W (P, PDIP-8). Open collector; sink 6 mA min / 21 mA typ at VOL 1.5 V (VOL 0.4 V max at 4 mA), response 1.3 us, CM V- .. V+ - 1.5 V (V+ - 2 V over temperature), 2-36 V per DESIGN [V] (REVIEW E12 corrected the sink current). ' + TAU_R,
  },
  verified: true, scope: 'campaign', simplifications: ['part.simplify.comparator-macro'],
};

export const ne555: PartDef = {
  id: 'ne555', kind: '555', nameKey: 'part.ne555.name', footprint: 'dip8', pins: ['GND', 'TRIG', 'OUT', 'RESET', 'CTRL', 'THR', 'DIS', 'VCC'],
  variants: dip8(98.5, 150, { VsMaxAbs: 18 }),
  model: { vccMin: 4.5, vccMax: 16, Iout: 0.2, VohDrop100mA5V: 1.7, Icc5V: 2e-3, Icc15V: 9e-3, thHi: 2 / 3, thLo: 1 / 3 },
  tolerance: {},
  source: {
    doc: 'TI NE555 / SA555 / SE555 precision timers, SLFS022K', url: `${TI}/ne555.pdf`, accessed: ACCESSED,
    note: 'Verified from the PDF: TJ 150 C, RthJA 98.5 C/W (P, PDIP-8). 4.5-16 V, output +-200 mA, VOH ~ Vcc - 1.7 V typ at 100 mA (5 V), Icc 2 mA (5 V) .. 9 mA (15 V) typ, thresholds 2/3 and 1/3 Vcc per DESIGN [V]. VCC absolute maximum 18 V (VsMaxAbs) is read from the PDF ("SE555 maximum is 18V", abs-max table 18 V). ' + TAU_R,
  },
  verified: true, scope: 'campaign', simplifications: ['part.simplify.555-macro'],
};

/** LM7805 (LM340 family). The DESIGN deliberately uses thetaJA 54 C/W (TI application text, TO-220 NDE, free air without copper) over the JEDEC table value 23.9. */
export const lm7805: PartDef = {
  id: 'lm7805', kind: 'REG', nameKey: 'part.lm7805.name', footprint: 'to220', pins: ['IN', 'GND', 'OUT'],
  variants: [variant('TO220', { VinMax: 35, Iout: 1, VdoAt1A: 2 }, semiThermal(54, 150, TAU.to220Bare, { thetaJC: 4, heatsinkable: true }))],
  model: { Vreg: 5.0, Vdo: 2.0, Isc: 2.1, IscPeak: 2.4, tShutdown: 150, tHyst: 15 },
  tolerance: { Vreg: 0.04 },
  source: {
    doc: 'TI LM340 / LM7805 family positive-voltage regulators, SNOSBT0L', url: `${TI}/lm340.pdf`, accessed: ACCESSED,
    note: 'Verified from the PDF: dropout 2 V at 1 A (25 C), short-circuit current 2.1 A, thermal-overload text "TO-220 (NDE) thetaJA is 54 C/W and thetaJC is 4 C/W" (line 208), maximum junction temperature 150 C; the JEDEC table gives RthJA 23.9 (NDE): the game uses 54 (free air, no copper) and says so in the Codex (REVIEW E12). '
      + 'Output 4.8-5.2 V over load/temperature in the table; DESIGN uses 5.0 V +-4 %. Peak 2.4 A and the 135 C resume point (tHyst 15 K) are DESIGN §3.7 values. DC input voltage maximum 35 V is read. ' + TAU_R,
  },
  verified: true, scope: 'campaign', simplifications: ['part.simplify.regulator-macro'],
};

/** LM317. thetaJA 37.9 C/W is the TI table value for the legacy-chip TO-220 KCT row (JEDEC high-K board); the 7805's "54" is an application-text number that the LM317 sheet does not have. */
export const lm317: PartDef = {
  id: 'lm317', kind: 'REG', nameKey: 'part.lm317.name', footprint: 'to220', pins: ['ADJ', 'OUT', 'IN'],
  variants: [variant('TO220', { VinMax: 40, Iout: 1.5, Vdo: 2 }, semiThermal(37.9, 150, TAU.to220Bare, { heatsinkable: true }))],
  model: { Vref: 1.25, Iadj: 50e-6, IadjMax: 100e-6, IminLoad: 3.5e-3, IminLoadMax: 10e-3, Vdo: 2.0, Ilim: 1.5, tShutdown: 150, tHyst: 15 },
  tolerance: { Vref: 0.04 },
  source: {
    doc: 'TI LM317 3-terminal adjustable regulator, SLVS044Z (Sep 1997, revised Apr 2025)', url: `${TI}/lm317.pdf`, accessed: ACCESSED,
    note: 'Verified from the PDF: Iadj 50 uA typ / 100 uA max, Vref table row, legacy chip TJ max 150 C (the new chip lists 0-125 C operating), RthJA 37.9 C/W for the TO-220 KCT legacy-chip row. No junction-to-case(bottom) figure was read (the table only lists RthJC(top) 51.1, which is not a heatsink path), so thetaJC is ABSENT: a heatsink ticket must add it from a sourced value first. Vref 1.25 V (1.2-1.3), min load 3.5 mA typ (10 max), dropout ~2 V, 1.5 A per DESIGN [V]. The +-4 % Vref window is the 1.2-1.3 V range of DESIGN. VinMax 40 V is the table row (3-40 V differential). ' + TAU_R,
  },
  verified: true, scope: 'campaign', simplifications: ['part.simplify.regulator-macro'],
};

export const ICS: PartDef[] = [lm741, lm358, tl072, ne5532, mcp6002, lm393, ne555, lm7805, lm317];
