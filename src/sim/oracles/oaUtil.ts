// Shared helpers for the op-amp / macro oracles (OA-01..15, FI-03, OS-01). Test support, not a test.
import { EXPANDERS, type ExpandCtx } from '../mna/netlist';
import type { PartDef } from '../../data/parts/types';
import type { PlacedPart } from '../board/types';
export const SUP = '\nVp vp 0 15\nVn vn 0 -15';
export const IDEAL = '\n.model ideal opamp (ideal=1)';
/** Cards for a DC op-amp circuit: `U1 ip in out vp vn ideal` plus ±15 V rails. */
export const dcAmp = (body: string): string => body + IDEAL + SUP;

/** `.model <name> opamp|cmp (...)` card for ONE channel of a catalogue part, built by the game's own expander (so the oracle sees exactly the
 *  numbers a placed part gets: catalogue row + macro defaults, package Iq split per channel). */
export function partModel(def: PartDef, name = 'm'): string {
  const ctx = { part: { uid: 'u', partId: def.id, value: null, variant: def.variants[0].id, x: 0, y: 0, rot: 0, flip: false } as PlacedPart, def, nodes: [1, 2, 3, 4, 5, 6, 7, 8] } as ExpandCtx;
  const cmp = def.kind === 'CMP', p = EXPANDERS[cmp ? 'CMP' : 'OPAMP']!(ctx)[0].p;
  return `\n.model ${name} ${cmp ? 'cmp' : 'opamp'} (${Object.entries(p).map(([k, v]) => `${k}=${v}`).join(' ')})`;
}
/** ±v supply cards (nodes vp / vn). */
export const rails = (v: number): string => `\nVp vp 0 ${v}\nVn vn 0 -${v}`;
