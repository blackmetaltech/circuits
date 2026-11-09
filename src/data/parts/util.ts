// Shared helpers for the catalogue files. Pure data builders, no logic that belongs in the simulator.
import type { Thermal, Variant } from './types';

/** ISO date every source below was (re)read by M1-D1. */
export const ACCESSED = '2026-11-10';

/** Standing note appended to every part: thermal time constants are engineering estimates (DESIGN §3.9). */
export const TAU_R = '[R] thermal tau is an engineering estimate per DESIGN §3.9 package class (no datasheet gives it; Codex-flagged "estimate").';

/** DESIGN §3.9 thermal tau classes, seconds. All [R]. */
export const TAU = { axialQuarter: 8, axialHalfToOne: 15, wirewound5W: 40, to92: 30, do41: 20, do35: 20, to220Bare: 60, to220Sink: 180, led: 10, dip8: 30, electrolytic: 60 } as const;

/** Resistor thermal (DESIGN §3.9): theta = 85 / P_rated (Yageo derating 70 -> 155 C), smoke at 250 C. */
export function resistorThermal(p: number, tauS: number): Thermal {
  return { thetaJA: 85 / p, tauS, tMax: 155, tFail: 250 };
}

/** Semiconductor thermal (DESIGN §3.9): tMax = Tj,max, tFail = Tj,max + 25. */
export function semiThermal(thetaJA: number, tjMax: number, tauS: number, extra: Partial<Thermal> = {}): Thermal {
  return { thetaJA, tauS, tMax: tjMax, tFail: tjMax + 25, ...extra };
}

export function variant(id: string, ratings: Record<string, number>, thermal: Thermal): Variant {
  return { id, ratings, thermal };
}
