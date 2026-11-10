// Parameter defaults of the behavioural macros (DESIGN §3.7) and the card model types that name them. A catalogue model or a `.model` card gives the
// numbers it has; everything it does not give is filled HERE with the sim defaults below, each flagged [E] = engineering estimate, not a datasheet read
// (the catalogue deliberately leaves them absent, see data/parts/ics.ts). Keys of the input are lower case.
import type { Params } from '../types';

export type Raw = Record<string, number | undefined>;
const pick = (m: Raw, k: string, d: number): number => (m[k] === undefined ? d : m[k]!);

/** Op-amp. ideal=1: the Textbook variant (A0 1e6, no pole, no slew, hard rails, Ro 0, Rin 1e12, no Iq).
 *  Defaults [E]: A0 1e5, Rin 1e9 Ω, Ro 75 Ω, Isc 25 mA, Iq 1.5 mA, headroom 1.5 V. GBW and SR default to 'none' (0). */
export function opampParams(m: Raw): Params {
  if (m.ideal) return { a0: pick(m, 'a0', 1e6), gbw: 0, sr: 0, rin: pick(m, 'rin', 1e12), ro: 0, isc: 0.025, iq: 0, headhi: 0, headlo: 0 };
  return {
    a0: pick(m, 'a0', 1e5), gbw: pick(m, 'gbw', 0), sr: pick(m, 'sr', 0), rin: pick(m, 'rin', 1e9), ro: pick(m, 'ro', 75), isc: pick(m, 'isc', 0.025),
    iq: pick(m, 'iq', 1.5e-3), headhi: pick(m, 'headhi', 1.5), headlo: pick(m, 'headlo', pick(m, 'footlo', 1.5)),
  };
}
/** Comparator (LM393 family): A0 2e5, response 1.3 µs, sink limit 21 mA typ, Ron 50 Ω (DESIGN §3.7), Iq 0.4 mA [E]. */
export function comparatorParams(m: Raw): Params {
  return { a0: pick(m, 'a0', 2e5), tresp: pick(m, 'tresponse', pick(m, 'tresp', 1.3e-6)), isink: pick(m, 'isinktyp', pick(m, 'isink', 0.021)), ron: pick(m, 'ron', 50), iq: pick(m, 'iq', 0.4e-3) };
}
/** 555 (NE555): 3×5 kΩ, thresholds from the divider, Vol 0.1 V, Voh = Vcc − 1.7 V, Ro 10 Ω, discharge Ron 5 Ω [E] (DESIGN §3.7 says 10 Ω, which with R1 = 1 kΩ shifts OS-01 by −1.08 %, outside its ±1 %; see the report), reset below 0.7 V, Icc 2 mA (5 V) .. 9 mA (15 V). */
export function timerParams(m: Raw): Params {
  return { rdiv: 5000, ro: pick(m, 'ro', 10), ron: pick(m, 'rondis', 5), vohdrop: pick(m, 'vohdrop100ma5v', 1.7), vol: 0.1, vreset: 0.7, icc5: pick(m, 'icc5v', 2e-3), icc15: pick(m, 'icc15v', 9e-3) };
}
/** Linear regulator. 7805: Vreg 5 V, Iq 5 mA to GND (DESIGN §3.7). LM317: Vreg = Vref, Iadj, Iq injected into OUT = IminLoad.
 *  Rout 10 mΩ [E] (load regulation), thermal: thetaja / tau (°C/W, s) and the shutdown pair come from the catalogue; ta 25 °C. thermal = 0 switches the latch off. */
export function regulatorParams(m: Raw): Params {
  return {
    vreg: pick(m, 'vreg', pick(m, 'vref', 5)), vdo: pick(m, 'vdo', 2), ilim: pick(m, 'isc', pick(m, 'ilim', 1.5)), iqgnd: pick(m, 'iqgnd', 0), iqout: pick(m, 'iqout', 0),
    iadj: pick(m, 'iadj', 0), rout: pick(m, 'rout', 0.01), thetaja: pick(m, 'thetaja', 54), tau: pick(m, 'tau', 60), ta: pick(m, 'ta', 25),
    tshut: pick(m, 'tshutdown', pick(m, 'tshut', 150)), thyst: pick(m, 'thyst', 15), thermal: pick(m, 'thermal', 1),
  };
}
/** Relay: coil R + L, pull-in / drop-out current, contact Ron / Roff (catalogue model). */
export function relayParams(m: Raw): Params {
  return { rcoil: pick(m, 'rcoil', 200), lcoil: pick(m, 'lcoil', 0.1), ipull: pick(m, 'ipull', 0.04), idrop: pick(m, 'idrop', 0.015), ron: pick(m, 'roncontact', pick(m, 'ron', 0.05)), roff: pick(m, 'roffcontact', pick(m, 'roff', 1e9)) };
}
/** Fuse: R_cold (absent from the catalogue; [E] 0.15 Ω / Irated), I²t over a 50 ms window, blown = 1e9 Ω. */
export function fuseParams(m: Raw): Params {
  const ir = pick(m, 'irated', 1);
  return { r: pick(m, 'r', 0.15 / ir), irated: ir, window: pick(m, 'windows', pick(m, 'window', 0.05)), roff: 1e9 };
}
/** Logic pin: Thevenin source v behind Ro (25 Ω pin, DESIGN §3.7). */
export function logicParams(m: Raw): Params { return { v: pick(m, 'v', 0), ro: pick(m, 'ro', 25) }; }

export interface MacroType { kind: string; terminals: number; params: (m: Raw) => Params }
/** `.model name <type> (...)` types usable by a `U` card (netlist.ts). */
export const MACRO_TYPES: Readonly<Record<string, MacroType>> = Object.freeze({
  opamp: { kind: 'OA', terminals: 5, params: opampParams },
  cmp: { kind: 'CMP', terminals: 5, params: comparatorParams },
  '555': { kind: 'TMR', terminals: 8, params: timerParams },
  reg: { kind: 'REG', terminals: 3, params: regulatorParams },
  relay: { kind: 'RLY', terminals: 5, params: relayParams },
  fuse: { kind: 'FUSE', terminals: 2, params: fuseParams },
  logic: { kind: 'LOGIC', terminals: 2, params: logicParams },
});
