// Panasonic EEU-FR radial aluminium electrolytic rows for the 220-4700 uF x 10/16/25/35 V grid that ticket 4-1 uses (DESIGN §4.1, 4-1).
// Read from docs/data/panasonic-eeu-fr.txt (pdftotext of the datasheet; footer 04 May 2013): standard-products tables on pages EEE-84 (10 V),
// EEE-85 (16 V and 25 V) and EEE-86 (35 V); spec table (leakage, tan delta) on EEE-82; case/impedance/ripple table on EEE-83.
// Where a value is listed in several cases (suffix L/S/U/Y) the part number that sorts first (unsuffixed, then L, S, U, Y) is used.
// Pairs the series does NOT list have no row here: 10 V and 16 V 330 uF, 25 V 4700 uF, 35 V 3300 and 4700 uF.
import type { CapValueData } from './types';

/** Rated V -> tan delta at 120 Hz, +20 C (EEE-82). Capacitors of 1000 uF or more add 0.02 per 1000 uF (applied linearly in C/1000 uF; the
 *  datasheet sentence "Add 0.02 per 1000 uF for products of 1000 uF or more" is read this way, flagged as an interpretation). */
export const FR_TAN_DELTA_BASE: Record<string, number> = { '6.3V': 0.22, '10V': 0.19, '16V': 0.16, '25V': 0.14, '35V': 0.12, '50V': 0.10 };

/** Leakage, A: I = 0.01 * C(uF) * V (uA) after 2 minutes (EEE-82). */
const leak = (v: string, c: number): number => 0.01 * (c * 1e6) * Number(v.slice(0, -1)) * 1e-6;
const d = (variant: string, value: number, partNo: string, caseDia: number, caseLen: number, esr: number, rippleMa: number, tanDelta: number, page: string): CapValueData =>
  ({ variant, value, partNo, caseDia, caseLen, esr, rippleA: rippleMa / 1000, leakage: leak(variant, value), tanDelta, verified: true, page });

export const EEU_FR_ROWS: CapValueData[] = [
  d('10V', 220e-6, 'EEUFR1A221', 6.3, 11.2, 0.130, 455, 0.1900, 'EEE-84'),
  d('10V', 470e-6, 'EEUFR1A471', 8, 11.5, 0.056, 950, 0.1900, 'EEE-84'),
  d('10V', 680e-6, 'EEUFR1A681', 8, 11.5, 0.056, 950, 0.1900, 'EEE-84'),
  d('10V', 1000e-6, 'EEUFR1A102', 10, 16, 0.028, 1790, 0.2100, 'EEE-84'),
  d('10V', 1500e-6, 'EEUFR1A152', 10, 16, 0.028, 1790, 0.2200, 'EEE-84'),
  d('10V', 2200e-6, 'EEUFR1A222L', 10, 25, 0.018, 2470, 0.2340, 'EEE-84'),
  d('10V', 3300e-6, 'EEUFR1A332', 12.5, 20, 0.018, 2600, 0.2560, 'EEE-84'),
  d('10V', 4700e-6, 'EEUFR1A472L', 12.5, 30, 0.013, 3630, 0.2840, 'EEE-84'),
  d('16V', 220e-6, 'EEUFR1C221', 6.3, 11.2, 0.130, 455, 0.1600, 'EEE-85'),
  d('16V', 470e-6, 'EEUFR1C471', 8, 11.5, 0.056, 950, 0.1600, 'EEE-85'),
  d('16V', 680e-6, 'EEUFR1C681', 10, 12.5, 0.043, 1290, 0.1600, 'EEE-85'),
  d('16V', 1000e-6, 'EEUFR1C102', 10, 16, 0.028, 1790, 0.1800, 'EEE-85'),
  d('16V', 1500e-6, 'EEUFR1C152', 10, 20, 0.020, 2180, 0.1900, 'EEE-85'),
  d('16V', 2200e-6, 'EEUFR1C222', 12.5, 20, 0.018, 2600, 0.2040, 'EEE-85'),
  d('16V', 3300e-6, 'EEUFR1C332L', 12.5, 30, 0.013, 3630, 0.2260, 'EEE-85'),
  d('16V', 4700e-6, 'EEUFR1C472', 16, 25, 0.014, 3820, 0.2540, 'EEE-85'),
  d('25V', 220e-6, 'EEUFR1E221', 8, 11.5, 0.056, 950, 0.1400, 'EEE-85'),
  d('25V', 330e-6, 'EEUFR1E331', 8, 11.5, 0.056, 950, 0.1400, 'EEE-85'),
  d('25V', 470e-6, 'EEUFR1E471', 10, 12.5, 0.043, 1290, 0.1400, 'EEE-85'),
  d('25V', 680e-6, 'EEUFR1E681', 10, 16, 0.028, 1790, 0.1400, 'EEE-85'),
  d('25V', 1000e-6, 'EEUFR1E102', 10, 20, 0.020, 2180, 0.1600, 'EEE-85'),
  d('25V', 1500e-6, 'EEUFR1E152', 12.5, 20, 0.018, 2600, 0.1700, 'EEE-85'),
  d('25V', 2200e-6, 'EEUFR1E222L', 12.5, 30, 0.013, 3630, 0.1840, 'EEE-85'),
  d('25V', 3300e-6, 'EEUFR1E332', 16, 25, 0.014, 3820, 0.2060, 'EEE-85'),
  d('35V', 220e-6, 'EEUFR1V221', 8, 11.5, 0.056, 950, 0.1200, 'EEE-86'),
  d('35V', 330e-6, 'EEUFR1V331U', 10, 12.5, 0.043, 1330, 0.1200, 'EEE-86'),
  d('35V', 470e-6, 'EEUFR1V471', 10, 16, 0.028, 1790, 0.1200, 'EEE-86'),
  d('35V', 680e-6, 'EEUFR1V681', 10, 20, 0.020, 2180, 0.1200, 'EEE-86'),
  d('35V', 1000e-6, 'EEUFR1V102', 12.5, 20, 0.018, 2600, 0.1400, 'EEE-86'),
  d('35V', 1500e-6, 'EEUFR1V152L', 12.5, 30, 0.013, 3630, 0.1500, 'EEE-86'),
  d('35V', 2200e-6, 'EEUFR1V222', 16, 25, 0.014, 3820, 0.1640, 'EEE-86'),];
