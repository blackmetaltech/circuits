// Board contract (DESIGN §3.1, §8.3). Plain JSON: it lives in the game state, is cloned, hashed, saved and put in solution codes.
// Pads are integer grid coordinates [x, y] (pitch 1 unit = 0.1"). Wires are orthogonal polylines that connect ONLY at their
// endpoints (crossings are insulated jumpers). Union-find over wire endpoints, part pins and connectors gives the nodes.

export type Pad = [number, number];
/** Rotation in quarter turns (0..3, clockwise). */
export type Rot = 0 | 1 | 2 | 3;

export interface PlacedPart {
  uid: string;          // 'p1', 'p2'… assigned by the board in placement order (deterministic)
  partId: string;       // catalogue id (src/data/parts)
  value: number | null; // SI value for valued families (Ω, F, H), null otherwise
  variant: string;      // Variant.id
  x: number; y: number; rot: Rot; flip: boolean;
  /** Pot wiper α (0.005..0.995, quantised to 1/1000) or slide-wire jockey position; absent otherwise. */
  pos?: number;
  /** Fixed parts (level fixtures: loads, transformer, black boxes) cannot be moved, deleted or edited. */
  fixed?: boolean;
}

export interface Wire {
  wid: string;          // 'w1', 'w2'…
  /** Part of the ticket's own wiring (pre-wired by the level): the player cannot remove it. */
  fixed?: boolean;
  path: Pad[];          // ≥ 2 pads; consecutive pads share x or y (orthogonal); only path[0] and path[last] connect
}

/** A level connector: a fixed brass edge pad with a stable name (IN, OUT, GND, VP…). GND is node 0. */
export interface Connector {
  id: string;
  pad: Pad;
  role: 'source' | 'load' | 'probe' | 'rail' | 'ground';
}

export interface Board {
  w: number; h: number;
  connectors: Connector[];
  parts: PlacedPart[];
  wires: Wire[];
}
