// Shared helpers for the op-amp / macro oracles (OA-01..09, FI-03, OS-01). Test support, not a test.
export const SUP = '\nVp vp 0 15\nVn vn 0 -15';
export const IDEAL = '\n.model ideal opamp (ideal=1)';
/** Cards for a DC op-amp circuit: `U1 ip in out vp vn ideal` plus ±15 V rails. */
export const dcAmp = (body: string): string => body + IDEAL + SUP;
