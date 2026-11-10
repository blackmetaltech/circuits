// Part catalogue contract (DESIGN §4.5, adapted by the build director). Physics only: prices, availability and names that
// vary by region live in the region packs (src/regions/<id>/data.ts), never here. Every number is SI (Ω, F, H, A, V, W, s, K
// differences in °C), never "4k7".

/** Electrical kind: decides which device model the compiler expands the part into. */
export type PartKind =
  | 'R' | 'C' | 'CE' /* polarised electrolytic */ | 'L'
  | 'D' | 'LED' | 'Z' /* Zener */ | 'SCHOTTKY'
  | 'NPN' | 'PNP' | 'DARLINGTON' | 'NMOS'
  | 'OPAMP' | 'CMP' | '555' | 'REG'
  | 'POT' | 'XFMR' | 'RELAY' | 'FUSE' | 'NTC' | 'SLIDEWIRE'
  | 'SPEAKER' | 'MOTOR' | 'HEATER' | 'METER' | 'MISC';

/**
 * Physical footprint: how many pins and where they sit relative to the part origin (src/sim/board/footprints.ts owns the
 * geometry). Pin order of a footprint is matched by PartDef.pins.
 */
export type FootprintId =
  | 'axial2'   // 2 pins, 4 pads apart (resistor, film/ceramic cap, axial diode, inductor)
  | 'radial2'  // 2 pins, 2 pads apart (electrolytic, LED)
  | 'to92'     // 3 pins in a row (BJT, small MOSFET)
  | 'to220'    // 3 pins in a row, wider pitch, heatsink tab
  | 'dip8'     // 2×4 (op-amp duals, 555, LM393)
  | 'pot3'     // 3 pins (trimmer / pot)
  | 'xfmr4'    // 4 pins: primary 1/2, secondary 3/4
  | 'relay5'   // coil 1/2, common, NO, NC
  | 'block2';  // 2-terminal board fixture (heater element, speaker, fan, fuse, battery holder)

export interface Thermal {
  /** Junction/body-to-ambient thermal resistance, °C/W (free air). Resistors: 85 / P_rated (Yageo derating). */
  thetaJA: number;
  /** Optional junction-to-case, °C/W (heatsinkable parts). */
  thetaJC?: number;
  /** Thermal time constant, s ([R] engineering estimate unless sourced; DESIGN §3.9). */
  tauS: number;
  /** Warm → Hot threshold, °C. */
  tMax: number;
  /** Smoke threshold, °C. */
  tFail: number;
  heatsinkable?: boolean;
}

export interface Source {
  /** Document title and number, e.g. "Vishay 1N4001-1N4007 datasheet, doc 88503". */
  doc: string;
  url?: string;
  /** ISO date the document was read. */
  accessed?: string;
  /** Which fields came from where, when not all from `doc` (e.g. "model: Diodes Inc. SPICE 1N4007.spice.txt"). */
  note?: string;
  /**
   * M1-D1 addition. true for textbook ideal elements, which are defined by their constitutive equation and have no datasheet:
   * the provenance test then does not require `url`/`accessed` and the price test skips them (the Textbook bin is free).
   */
  definition?: boolean;
  /**
   * M1-D2b addition. true for a GAME-DEFINED level fixture (a pre-placed board part such as the 4-1 mains transformer): no datasheet exists
   * by design, every number is a lesson value. The provenance test then requires note to say GAME-DEFINED and a codex-note simplification key.
   */
  gameFixture?: boolean;
}

/** A rating variant of a part (e.g. a resistor at ¼ W vs 1 W): a different SKU with its own ratings, thermal data and price. */
export interface Variant {
  id: string;                         // e.g. '0.25W', '25V', 'TO92'
  ratings: Record<string, number>;    // e.g. { P: 0.25, Vmax: 250 }
  thermal: Thermal;
}

export interface PartDef {
  id: string;                         // stable id used in level bins, solution codes and region price tables, e.g. 'res-cf', 'led-red-5mm', '1n4007'
  kind: PartKind;
  /** i18n key of the display name (src/locales/en.ts), never a literal. */
  nameKey: string;
  footprint: FootprintId;
  /** Pin names in footprint pin order, e.g. ['A', 'K'] for a diode, ['C', 'B', 'E'] for a TO-92 2N3904. */
  pins: string[];
  /** Allowed values (SI) for families with a value (resistors, caps, inductors); absent for fixed parts (an LED, a 2N3904). */
  values?: number[];
  /** Rating variants; at least one. The variant id is part of the placed part. */
  variants: Variant[];
  /** Device model parameters, SI (Shockley Is/N/Rs/BV/Ibv, EM Is/Bf/Br/Vaf, Level-1 Vt/Kp/lambda, op-amp A0/GBW/SR/…). */
  model: Record<string, number>;
  /** Monte Carlo tolerance (fraction), e.g. 0.05 for a 5 % resistor; per-parameter ranges for semiconductors. */
  tolerance?: Record<string, number | [number, number]>;
  source: Source;
  /** true only when every physics number was read from `source` (DESIGN §4.0). Campaign parts must be verified. */
  verified: boolean;
  /** Campaign parts appear in level bins; sandbox-only parts may be unverified (shown with an "unverified" tag). */
  scope: 'campaign' | 'sandbox';
  codexKey?: string;
  /** Named simplifications (Codex "What we simplified"), as i18n keys. */
  simplifications?: string[];
}
