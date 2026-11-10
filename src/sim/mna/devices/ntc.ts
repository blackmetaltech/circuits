// NTC thermistor (DESIGN §3.7): R(T) = R25·exp(B·(1/T − 1/T0)), T in kelvin, T0 = 298.15 K. Self-heating is ignored (flagged by the part's
// simplification key); T is a bench condition or a live "heat gun" value, so the netlist expander (netlist.ts) evaluates this once per compile and
// emits a plain resistor. Pure.
import { dmath } from '@core/numerics';

export const KELVIN = 273.15;
/** Resistance at tC °C. */
export const ntcResistance = (r25: number, b: number, tC: number, t0 = 298.15): number => r25 * dmath.exp(b * (1 / (tC + KELVIN) - 1 / t0));
