// Null-detector tickets (2-2, 2-4): is there a real balance? The jockey is swept end to end on a COPY of the board and the galvanometer current is read at every step.
// A bridge that is wired wrongly (the cell not across A-B, C not joined to the jockey) reads about zero or one sign everywhere: the "zero" the bench spec sees is then an
// accident, not a balance. Pure helpers: the caller supplies the probe and the node lookup, so this file imports nothing from the ticket layer.
import type { LevelDef } from '../data/levels/types';
import type { Board } from '../sim/board/types';
import type { Connectivity } from '../sim/board/connectivity';
import { getDef } from './board';
import { say } from './text';

export interface BridgeScan {
  /** True when the gauge current changes sign somewhere along the wire (a null exists). */
  hasNull: boolean;
  /** The null's distance from end A in cm (interpolated), when there is one. */
  nullCm: number | null;
  /** Largest |current| seen (A) and the sign pattern: 'zero' (flat, nothing flows), 'pos' | 'neg' (one sign everywhere), 'cross'. */
  maxAbs: number;
  kind: 'zero' | 'pos' | 'neg' | 'cross';
}

const STEPS = 40;
const FLAT = 2e-7;   // below this the needle cannot leave zero (the spec band is 10 uA; one millimetre of jockey is about 16 uA)

/** Sweep the jockey of the ticket's fixed slide wire; `probeAt(board)` returns the gauge current on a board copy (null when it cannot be solved). */
export function scanBridge(board: Board, def: LevelDef, probeAt: (b: Board) => number | null): BridgeScan | null {
  const nc = def.nullCheck; if (!nc) return null;
  const wire = board.parts.find((p) => p.uid === nc.wire); if (!wire) return null;
  const lenCm = (getDef(wire.partId)?.model.lengthM ?? 1) * 100;
  const cur: number[] = [];
  for (let i = 0; i <= STEPS; i++) {
    const v = probeAt({ ...board, parts: board.parts.map((p) => (p === wire ? { ...p, pos: i / STEPS } : p)) });
    if (v === null || !Number.isFinite(v)) return null;
    cur.push(v);
  }
  const maxAbs = Math.max(...cur.map(Math.abs));
  if (maxAbs < FLAT) return { hasNull: false, nullCm: null, maxAbs, kind: 'zero' };
  let nullPos: number | null = null;
  for (let i = 1; i <= STEPS && nullPos === null; i++) {
    const a = cur[i - 1]!, b = cur[i]!;
    if (a === 0) nullPos = (i - 1) / STEPS; else if (a * b < 0) nullPos = (i - 1 + a / (a - b)) / STEPS;
  }
  if (nullPos === null && cur[STEPS] === 0) nullPos = 1;
  const kind = nullPos !== null ? 'cross' : cur[0]! > 0 ? 'pos' : 'neg';
  return { hasNull: nullPos !== null, nullCm: nullPos === null ? null : Math.round(nullPos * lenCm * 100) / 100, maxAbs, kind };
}

/** The first unmet wiring requirement of the ticket's `nullCheck.faults`, as plain words ('' when all hold). `nodeOf(ref)`: node of a pin `uid.pin` / connector id (-1 when absent);
 * `legsOn(ref)`: how many part legs share that pin's node. */
export function bridgeFault(def: LevelDef, nodeOf: (ref: string) => number, legsOn: (ref: string) => number): string {
  for (const f of def.nullCheck?.faults ?? []) {
    for (const need of f.need) {
      const at = need.indexOf(':'), kind = need.slice(0, at), arg = need.slice(at + 1);
      let ok = true;
      if (kind === 'link') { const [a, b] = arg.split('~'), na = nodeOf(a ?? ''), nb = nodeOf(b ?? ''); ok = na >= 0 && na === nb; }
      else if (kind === 'shared') ok = legsOn(arg) > 1;
      if (!ok) return say(f.key);
    }
  }
  return '';
}

/** Which side of C the plug R sits on, from the wiring: 'left' = R between A and C (balance X = R (100 - l) / l), 'right' = R between C and B (X = R l / (100 - l)). */
export function rSide(board: Board, def: LevelDef, nodeOfPin: (uid: string, pin: number) => number): 'left' | 'right' {
  const w = def.nullCheck?.wire ?? def.answers?.[0]?.wire; if (!w) return 'left';
  const wire = board.parts.find((p) => p.uid === w), d = wire ? getDef(wire.partId) : undefined; if (!wire || !d) return 'left';
  const nb = nodeOfPin(w, d.pins.indexOf('B')), na = nodeOfPin(w, d.pins.indexOf('A'));
  const box = board.parts.find((p) => !p.fixed && p.partId === 'res-box');
  if (!box) return 'left';
  const ns = getDef(box.partId)!.pins.map((_, i) => nodeOfPin(box.uid, i));
  return nb >= 0 && ns.includes(nb) && !ns.includes(na) ? 'right' : 'left';
}

export const balanceFormula = (side: 'left' | 'right'): string => (side === 'left' ? 'X = R (100 - l) / l' : 'X = R l / (100 - l)');

/** Node lookups on a built connectivity: `uid.pin` or a connector id. */
export function refs(board: Board, conn: Connectivity): { nodeOf: (ref: string) => number; legsOn: (ref: string) => number; nodeOfPin: (uid: string, pin: number) => number } {
  const nodeOfPin = (uid: string, pin: number): number => (pin >= 0 ? (conn.pinNodes[uid]?.[pin] ?? -1) : -1);
  const nodeOf = (ref: string): number => {
    if (ref.includes('.')) {
      const at = ref.indexOf('.'), uid = ref.slice(0, at), pin = ref.slice(at + 1), p = board.parts.find((x) => x.uid === uid), d = p ? getDef(p.partId) : undefined;
      return d ? nodeOfPin(uid, d.pins.indexOf(pin)) : -1;
    }
    const c = board.connectors.find((x) => x.id === ref);
    return c ? conn.nodeOfPad(c.pad) : -1;
  };
  return { nodeOf, nodeOfPin, legsOn: (ref) => { const n = nodeOf(ref); return n >= 0 ? (conn.nodes[n]?.pins.length ?? 0) : 0; } };
}
