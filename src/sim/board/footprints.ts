// Pin geometry per FootprintId (DESIGN §3.1; contract in data/parts/types.ts). Offsets are relative to the part origin
// (placed at part.x, part.y) BEFORE rotation/flip, in footprint pin order = PartDef.pins order. Pitch 1 unit = 0.1".
import type { FootprintId, PartDef } from '../../data/parts/types';
import type { Pad, PlacedPart, Rot } from './types';
import { rotateOffset } from './grid';

export const FOOTPRINTS: Readonly<Record<FootprintId, readonly Pad[]>> = {
  axial2: [[0, 0], [4, 0]],
  radial2: [[0, 0], [2, 0]],
  to92: [[0, 0], [1, 0], [2, 0]],
  to220: [[0, 0], [2, 0], [4, 0]],
  // DIP: pins 1-4 down the left column, 5-8 up the right column (0.3" row spacing).
  dip8: [[0, 0], [0, 1], [0, 2], [0, 3], [3, 3], [3, 2], [3, 1], [3, 0]],
  slide3: [[0, 0], [10, -2], [20, 0]],                         // wire end A, jockey terminal J, wire end B
  pot3: [[0, 0], [2, 0], [4, 0]],                              // end A, wiper W, end B
  xfmr4: [[0, 0], [0, 4], [4, 0], [4, 4]],                     // primary 1/2 left, secondary 3/4 right
  relay5: [[0, 0], [0, 4], [4, 0], [4, 2], [4, 4]],            // coil 1/2, common, NO, NC
  block2: [[0, 0], [6, 0]],
};

/** Rotated/flipped pin offsets of a footprint (relative to the origin). */
export function pinOffsets(fp: FootprintId, rot: Rot, flip: boolean): Pad[] {
  return FOOTPRINTS[fp].map((o) => rotateOffset(o, rot, flip));
}

/** Absolute pad of every pin of a placed part, in PartDef.pins order. */
export function pinPads(part: Pick<PlacedPart, 'x' | 'y' | 'rot' | 'flip'>, def: Pick<PartDef, 'footprint'>): Pad[] {
  return pinOffsets(def.footprint, part.rot, part.flip).map((o): Pad => [part.x + o[0], part.y + o[1]]);
}
