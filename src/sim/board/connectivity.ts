// Board connectivity (DESIGN §3.1): union-find over wire ENDPOINTS, part pins and connectors gives the electrical nodes.
//  - Only path[0] and path[last] of a wire connect; interior pads (corners, crossings) never do.
//  - Pins that share a pad share a node. Connectors sit on pads like pins do.
//  - Ground connectors (role 'ground') are all node 0, even without a wire between them.
//  - Node ids: 0 = ground, then non-ground nodes sorted by their smallest pad in row-major order (y, then x), so numbering
//    does not depend on part / wire / connector order.
//  - A floating island is a group of nodes, joined only through parts, that never reaches node 0.
import type { PartDef } from '../../data/parts/types';
import type { Board, Pad, Wire } from './types';
import { inBounds, isInt, padCmp, padKey } from './grid';
import { pinPads } from './footprints';

export type BoardErrorCode =
  | 'tooShort' | 'notOrthogonal' | 'zeroLength' | 'outOfBounds' | 'nonInteger' | 'loop'
  | 'noDef' | 'pinCount' | 'pinOutOfBounds' | 'dupUid' | 'dupWid';
export interface BoardError { code: BoardErrorCode; uid?: string; wid?: string }

/** Wire rules: ≥ 2 pads, integer pads in bounds, every segment orthogonal and non-zero, endpoints distinct. */
export function validateWire(w: Wire, bounds: { w: number; h: number }): BoardError | null {
  const p = w.path, err = (code: BoardErrorCode): BoardError => ({ code, wid: w.wid });
  if (p.length < 2) return err('tooShort');
  for (const q of p) if (!isInt(q[0]) || !isInt(q[1])) return err('nonInteger');
  for (const q of p) if (!inBounds(bounds, q)) return err('outOfBounds');
  for (let i = 1; i < p.length; i++) {
    if (p[i][0] === p[i - 1][0] && p[i][1] === p[i - 1][1]) return err('zeroLength');
    if (p[i][0] !== p[i - 1][0] && p[i][1] !== p[i - 1][1]) return err('notOrthogonal');
  }
  if (p[0][0] === p[p.length - 1][0] && p[0][1] === p[p.length - 1][1]) return err('loop');
  return null;
}

/** Whole-board structural validation (wires, pin counts, pins on the board, unique ids). */
export function validateBoard(b: Board, getDef: (partId: string) => PartDef | undefined): BoardError[] {
  const out: BoardError[] = [];
  const uids = new Set<string>(), wids = new Set<string>();
  for (const w of b.wires) {
    if (wids.has(w.wid)) out.push({ code: 'dupWid', wid: w.wid });
    wids.add(w.wid);
    const e = validateWire(w, b); if (e) out.push(e);
  }
  for (const p of b.parts) {
    if (uids.has(p.uid)) out.push({ code: 'dupUid', uid: p.uid });
    uids.add(p.uid);
    const d = getDef(p.partId);
    if (!d) { out.push({ code: 'noDef', uid: p.uid }); continue; }
    const pads = pinPads(p, d);
    if (pads.length !== d.pins.length) out.push({ code: 'pinCount', uid: p.uid });
    else if (pads.some((q) => !inBounds(b, q))) out.push({ code: 'pinOutOfBounds', uid: p.uid });
  }
  return out;
}

export interface ConnNode {
  id: number;
  /** Connector id when the node has one (first in id order), else 'n<id>'; ground is '0'. */
  name: string;
  ground: boolean;
  pads: Pad[];                                  // row-major sorted
  connectors: string[];
  pins: { uid: string; pin: number }[];
  wires: string[];
}
export interface Connectivity {
  nodes: ConnNode[];                            // nodes[0] is ground (empty when the board has no ground connector)
  hasGround: boolean;
  pinNodes: Record<string, number[]>;           // part uid → node of each pin (PartDef.pins order)
  connectorNodes: Record<string, number>;
  islands: number[][];                          // node-id groups with parts/connectors that never reach node 0
  unconnectedPins: { uid: string; pin: number; pad: Pad }[];
  errors: BoardError[];                         // noDef / pinCount found while building (wire rules: validateBoard)
  /** Node of a pad, or −1 when nothing terminates there. */
  nodeOfPad(p: Pad): number;
}

export function buildConnectivity(board: Board, getDef: (partId: string) => PartDef | undefined): Connectivity {
  const errors: BoardError[] = [];
  // vertex 0 is the virtual ground; pads are 1..
  const parent: number[] = [0];
  const find = (a: number): number => { while (parent[a] !== a) { parent[a] = parent[parent[a]]; a = parent[a]; } return a; };
  const union = (a: number, b: number): void => { const ra = find(a), rb = find(b); if (ra !== rb) parent[Math.max(ra, rb)] = Math.min(ra, rb); };
  const index = new Map<string, number>();
  const pads: Pad[] = [[NaN, NaN]];
  const pinsAt: { uid: string; pin: number }[][] = [[]], wiresAt: string[][] = [[]], connAt: string[][] = [[]];
  const vertex = (p: Pad): number => {
    const k = padKey(p); let i = index.get(k);
    if (i === undefined) { i = pads.length; index.set(k, i); pads.push([p[0], p[1]]); parent.push(i); pinsAt.push([]); wiresAt.push([]); connAt.push([]); }
    return i;
  };

  for (const w of board.wires) {
    if (w.path.length < 2) continue;
    const a = vertex(w.path[0]), b = vertex(w.path[w.path.length - 1]);
    wiresAt[a].push(w.wid); wiresAt[b].push(w.wid);
    union(a, b);
  }
  const partPins: { uid: string; verts: number[] }[] = [];
  for (const p of board.parts) {
    const d = getDef(p.partId);
    if (!d) { errors.push({ code: 'noDef', uid: p.uid }); continue; }
    const pp = pinPads(p, d);
    if (pp.length !== d.pins.length) { errors.push({ code: 'pinCount', uid: p.uid }); continue; }
    const verts = pp.map((q, i) => { const v = vertex(q); pinsAt[v].push({ uid: p.uid, pin: i }); return v; });
    partPins.push({ uid: p.uid, verts });
  }
  for (const c of board.connectors) {
    const v = vertex(c.pad); connAt[v].push(c.id);
    if (c.role === 'ground') union(v, 0);
  }

  // components → nodes
  const minPad = new Map<number, Pad>();
  for (let v = 1; v < pads.length; v++) {
    const r = find(v), cur = minPad.get(r);
    if (!cur || padCmp(pads[v], cur) < 0) minPad.set(r, pads[v]);
  }
  const groundRoot = find(0);
  const roots = [...minPad.keys()].filter((r) => r !== groundRoot).sort((a, b) => padCmp(minPad.get(a)!, minPad.get(b)!));
  const idOfRoot = new Map<number, number>([[groundRoot, 0]]);
  roots.forEach((r, i) => idOfRoot.set(r, i + 1));
  const nodes: ConnNode[] = [{ id: 0, name: '0', ground: true, pads: [], connectors: [], pins: [], wires: [] }];
  roots.forEach((_, i) => nodes.push({ id: i + 1, name: '', ground: false, pads: [], connectors: [], pins: [], wires: [] }));
  const nodeOfVertex = (v: number): number => idOfRoot.get(find(v))!;
  for (let v = 1; v < pads.length; v++) {
    const nd = nodes[nodeOfVertex(v)];
    nd.pads.push(pads[v]); nd.connectors.push(...connAt[v]); nd.pins.push(...pinsAt[v]); nd.wires.push(...wiresAt[v]);
  }
  for (const nd of nodes) {
    nd.pads.sort(padCmp); nd.connectors.sort(); nd.wires.sort();
    nd.pins.sort((a, b) => (a.uid < b.uid ? -1 : a.uid > b.uid ? 1 : a.pin - b.pin));
    if (!nd.ground) nd.name = nd.connectors.length ? nd.connectors[0] : 'n' + nd.id;
  }
  const hasGround = board.connectors.some((c) => c.role === 'ground');

  const pinNodes: Record<string, number[]> = {};
  for (const pp of partPins) pinNodes[pp.uid] = pp.verts.map(nodeOfVertex);
  const connectorNodes: Record<string, number> = {};
  for (const c of board.connectors) connectorNodes[c.id] = nodeOfVertex(vertex(c.pad));

  // islands: nodes joined through parts, not reaching ground
  const np = nodes.map((_, i) => i);
  const nf = (a: number): number => { while (np[a] !== a) { np[a] = np[np[a]]; a = np[a]; } return a; };
  for (const pp of partPins) { const ns = pinNodes[pp.uid]; for (let i = 1; i < ns.length; i++) { const a = nf(ns[0]), b = nf(ns[i]); if (a !== b) np[Math.max(a, b)] = Math.min(a, b); } }
  const groups = new Map<number, number[]>();
  for (const nd of nodes) {
    if (nd.id === 0 || (nd.pins.length === 0 && nd.connectors.length === 0)) continue;
    const r = nf(nd.id); if (r === nf(0)) continue;
    const g = groups.get(r); if (g) g.push(nd.id); else groups.set(r, [nd.id]);
  }
  const islands = [...groups.values()].sort((a, b) => a[0] - b[0]);

  const unconnectedPins: Connectivity['unconnectedPins'] = [];
  for (const pp of partPins) pp.verts.forEach((v, i) => {
    const nd = nodes[nodeOfVertex(v)];
    if (nd.pins.length === 1 && nd.wires.length === 0 && nd.connectors.length === 0) unconnectedPins.push({ uid: pp.uid, pin: i, pad: pads[v] });
  });

  return { nodes, hasGround, pinNodes, connectorNodes, islands, unconnectedPins, errors, nodeOfPad: (p) => { const v = index.get(padKey(p)); return v === undefined ? -1 : nodeOfVertex(v); } };
}
