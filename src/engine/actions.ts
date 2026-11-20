// Player actions (DESIGN §8.4). Every action mutates a CLONE of the state (the core commits only on success) and teaches on failure:
// each rejection is an i18n key + variables turned into English by `say`. Numeric arguments are quantised on entry (quant.ts).
import { fail, need, ok, type ActionFn } from '@core/kit';
import { INSTRUMENTS, nearMatches } from '../data/parts';
import type { LevelDef } from '../data/levels/types';
import type { Pad, PlacedPart, Wire } from '../sim/board/types';
import { buildConnectivity } from '../sim/board/connectivity';
import { padKey } from '../sim/board/grid';
import { explainedText } from './queries';
import { pinPads } from '../sim/board/footprints';
import { advanceLive } from '../sim/live';
import { sig } from '../sim/explain';
import { t } from '../i18n';
import { REGIONS } from '../regions';
import { formatMinor } from '../regions/data';
import {
  allowedValues, allowedVariants, checkPartSpot, checkWire, getDef, isProblem, nextId, normalisePath, occupancy, problem, snapValue, sortParts, sortWires,
  type Problem,
} from './board';
import { q, snap125 } from './quant';
import { MAX_WIRES, newScope, newTicketProgress, pushFailure, pushUndo, type BoardSnapshot, type NodeState, type TicketState } from './state';
import { levelDefOf, openTicketIn, refBoard } from './tickets';
import { benchTicket, evalHint, liveCfg, liveRig, probeOn } from './ticket-run';
import { refuse, refuseKey, say } from './text';
import { danglingEnds, padWhat } from './touch';
import { capFirst, nameVars, partName } from './names';

type Defs = readonly LevelDef[];
const SANDBOX_PARTS = 80, CAMPAIGN_PARTS = 40;

// ---------------------------------------------------------------- argument and ticket helpers
const str = (v: unknown, name: string): string => { if (typeof v !== 'string' || v === '') refuseKey('err.arg.str', { name }); return v as string; };
const int = (v: unknown, name: string): number => { if (typeof v !== 'number' || !Number.isInteger(v)) refuseKey('err.arg.int', { name }); return v as number; };
const num = (v: unknown, name: string): number => { if (typeof v !== 'number' || !Number.isFinite(v)) refuseKey('err.arg.num', { name }); return v as number; };

function open(s: NodeState, defs: Defs): { tk: TicketState; def: LevelDef } {
  if (!s.ticket) refuseKey('err.noTicket');
  const def = levelDefOf(defs, s.ticket!.id);
  if (!def) refuseKey('ticket.unknown', { id: s.ticket!.id, known: defs.map((d) => d.id).join(', ') });
  return { tk: s.ticket!, def: def! };
}
const sandbox = (s: NodeState): boolean => s.mode === 'sandbox';

const binList = (def: LevelDef): string => def.bin.map((b) => getDef(b.partId)?.id ?? b.partId).join(', ');
function binEntry(s: NodeState, def: LevelDef, partId: string) {
  const d = getDef(partId);
  if (!d) refuseKey('err.part.unknown', { id: partId, near: nearMatches(partId).join(', ') || '-' });
  if (sandbox(s)) return { d: d!, entry: null };
  if (def.constraints?.forbid?.includes(partId)) refuseKey('err.bin.forbidden', { name: partId });
  const entry = def.bin.find((b) => b.partId === partId);
  if (!entry) refuseKey('err.bin.notIn', { name: partId, bin: binList(def) });
  return { d: d!, entry: entry! };
}

const same = (a: unknown, b: unknown): boolean => JSON.stringify(a) === JSON.stringify(b);
type BoardCopy = { parts: PlacedPart[]; wires: Wire[] };
const copyBoard = (tk: TicketState): BoardCopy => ({ parts: structuredClone(tk.board.parts), wires: structuredClone(tk.board.wires) });

/** Record what an edit touched (before-versions) on the undo stack, clear redo and the stale bench verdict. */
function commit(tk: TicketState, key: string, before: BoardCopy): void {
  const e: BoardSnapshot = { key, parts: {}, wires: {} };
  const ids = new Set<string>([...before.parts.map((p) => p.uid), ...tk.board.parts.map((p) => p.uid)]);
  for (const uid of [...ids].sort()) {
    const b = before.parts.find((p) => p.uid === uid) ?? null, a = tk.board.parts.find((p) => p.uid === uid) ?? null;
    if (!same(a, b)) e.parts[uid] = b;
  }
  const wids = new Set<string>([...before.wires.map((w) => w.wid), ...tk.board.wires.map((w) => w.wid)]);
  for (const wid of [...wids].sort()) {
    const b = before.wires.find((w) => w.wid === wid) ?? null, a = tk.board.wires.find((w) => w.wid === wid) ?? null;
    if (!same(a, b)) e.wires[wid] = b;
  }
  if (Object.keys(e.parts).length + Object.keys(e.wires).length === 0) return;
  pushUndo(tk.undo, e); tk.redo = []; tk.lastBench = null;
}

/** Apply an undo/redo entry to the board and return the entry that reverses it. */
function applyEntry(tk: TicketState, e: BoardSnapshot): BoardSnapshot {
  const inv: BoardSnapshot = { key: e.key, parts: {}, wires: {} };
  const b = tk.board;
  for (const uid of Object.keys(e.parts)) {
    const cur = b.parts.find((p) => p.uid === uid) ?? null;
    inv.parts[uid] = cur ? structuredClone(cur) : null;
    b.parts = b.parts.filter((p) => p.uid !== uid);
    const was = e.parts[uid]; if (was) b.parts.push(structuredClone(was));
  }
  for (const wid of Object.keys(e.wires)) {
    const cur = b.wires.find((w) => w.wid === wid) ?? null;
    inv.wires[wid] = cur ? structuredClone(cur) : null;
    b.wires = b.wires.filter((w) => w.wid !== wid);
    const was = e.wires[wid]; if (was) b.wires.push(structuredClone(was));
  }
  sortParts(b); sortWires(b);
  const live = new Set(b.parts.map((p) => p.uid));
  tk.live.smoked = tk.live.smoked.filter((u) => live.has(u));
  for (const u of Object.keys(tk.live.temps)) if (!live.has(u)) delete tk.live.temps[u];
  for (const u of Object.keys(tk.live.notes ?? {})) if (!tk.live.smoked.includes(u)) delete tk.live.notes![u];
  tk.lastBench = null;
  return inv;
}

/** The plain-words name of an edit for the undo / redo toast: "placed the 470 Ω resistor", "drew a wire". Part names are read from the board the edit touched (before it is applied). */
function describeEdit(tk: TicketState, e: BoardSnapshot): string {
  const present = new Set(tk.board.parts.map((p) => p.uid));
  const board = { parts: [...tk.board.parts, ...Object.values(e.parts).filter((p): p is PlacedPart => !!p && !present.has(p.uid))] };
  const uid = Object.keys(e.parts)[0], what = uid ? partName(board, uid) : say('name.part.some');
  const wires = Object.keys(e.wires).length;
  switch (e.key) {
    case 'placePart': return say('edit.placed', { what });
    case 'movePart': return say('edit.moved', { what });
    case 'rotatePart': return say('edit.rotated', { what });
    case 'deletePart': return say('edit.deleted', { what });
    case 'setValue': return say('edit.value', { what });
    case 'swapVariant': return say('edit.rating', { what });
    case 'wire': case 'addWire': return say('edit.wire');
    case 'unwire': case 'deleteWire': return say(wires > 1 ? 'edit.unwired.many' : 'edit.unwired');
    case 'loadBoard': return say('edit.loaded');
    default: return say('edit.other');
  }
}
/** Undo / redo while a part is burnt: the burnt part comes back fresh and the power is OFF, so nothing re-burns until the player switches it on again. */
function freshenAfterBurn(tk: TicketState): boolean {
  if (tk.live.smoked.length === 0) return false;
  tk.live.smoked = []; tk.live.temps = {}; delete tk.live.notes;
  tk.live.powered = false; tk.instruments.supply.on = false; tk.instruments.gen.on = false; delete tk.live.paused; resetLive(tk.live);
  return true;
}

const placedCount = (tk: TicketState): number => tk.board.parts.filter((p) => !p.fixed).length;
function partsLimit(s: NodeState, def: LevelDef): number { return sandbox(s) ? SANDBOX_PARTS : (def.constraints?.maxParts ?? CAMPAIGN_PARTS); }
function checkCounts(s: NodeState, tk: TicketState, def: LevelDef, partId: string, extra = 0): void {
  if (placedCount(tk) + 1 + extra > partsLimit(s, def)) refuseKey('err.parts.limit', { max: partsLimit(s, def) });
  const entry = sandbox(s) ? null : def.bin.find((b) => b.partId === partId);
  if (entry?.max !== undefined && tk.board.parts.filter((p) => p.partId === partId && !p.fixed).length + 1 + extra > entry.max) refuseKey('err.bin.max', { name: partId, max: entry.max });
}

function partOf(tk: TicketState, uid: unknown, forEdit: boolean): PlacedPart {
  const id = str(uid, 'uid');
  const p = tk.board.parts.find((x) => x.uid === id);
  if (!p) refuseKey('err.part.none', { uid: id, have: tk.board.parts.map((x) => x.uid).join(', ') || '-' });
  if (forEdit && p!.fixed) refuseKey('err.part.fixed', nm(tk, id));
  return p!;
}

/** The player's name for a part, as {what} (mid-sentence) and {What} (sentence start). */
const nm = (tk: TicketState, uid: string): Record<string, string> => { const what = partName(tk.board, uid); return { what, What: capFirst(what) }; };
const touch = (tk: TicketState): void => { tk.lastBench = null; };
const resetLive = (live: TicketState['live']): void => { live.x = []; live.hist = []; live.h = 0; live.be = 0; live.t = 0; live.issues = []; live.scope = { ch1: [], ch2: [], t0: 0, dt: 0 }; };

function validPad(tk: TicketState, v: unknown, name: string): Pad {
  if (!Array.isArray(v) || v.length !== 2 || !Number.isInteger(v[0]) || !Number.isInteger(v[1])) refuseKey('err.arg.pad', { name });
  const p = v as Pad;
  if (p[0] < 0 || p[0] >= tk.board.w || p[1] < 0 || p[1] >= tk.board.h) refuseKey('err.pad.bounds', { pad: `${p[0]},${p[1]}`, w: tk.board.w, h: tk.board.h });
  return [p[0], p[1]];
}
function nodeAt(tk: TicketState, pad: Pad): boolean { return buildConnectivity(tk.board, getDef).nodeOfPad(pad) >= 0; }

// ---------------------------------------------------------------- placement shared by placePart and loadBoard
function newPart(s: NodeState, tk: TicketState, def: LevelDef, a: { partId: unknown; value: unknown; rating: unknown; x: unknown; y: unknown; rot: unknown; flip: unknown; uid?: string }, extra = 0): PlacedPart {
  const partId = str(a.partId, 'partId');
  const { d, entry } = binEntry(s, def, partId);
  const variants = allowedVariants(d, entry);
  if (variants.length === 0) refuseKey('err.variant.notAllowed', { name: partId, rating: '-', allowed: '-' });
  const rating = a.rating === null || a.rating === undefined || a.rating === '' ? variants[0]! : str(a.rating, 'rating');
  if (!variants.includes(rating)) refuseKey('err.variant.notAllowed', { name: partId, rating, allowed: variants.join(', ') });
  const allowed = allowedValues(d, entry);
  let value: number | null = null;
  if (allowed) { const r = snapValue(d, allowed, a.value); if (isProblem(r)) refuse(r); else value = r.value; }
  else if (a.value !== null && a.value !== undefined) refuseKey('err.value.none', { name: partId });
  const x = int(a.x, 'x'), y = int(a.y, 'y'), rot = int(a.rot ?? 0, 'rot');
  if (rot < 0 || rot > 3) refuseKey('err.arg.rot', { rot });
  const flip = a.flip === true;
  checkCounts(s, tk, def, partId, extra);
  const spot = checkPartSpot(tk.board, d, { x, y, rot: rot as 0 | 1 | 2 | 3, flip });
  if (spot) refuse(spot);
  const uid = a.uid ?? nextId('p', tk.board.parts.map((p) => p.uid));
  const part: PlacedPart = { uid, partId, value, variant: rating, x, y, rot: rot as 0 | 1 | 2 | 3, flip };
  if (d.kind === 'POT' || d.kind === 'SLIDEWIRE') part.pos = 0.5;
  return part;
}

function newWire(tk: TicketState, path: unknown, wid?: string): Wire {
  if (!Array.isArray(path)) refuseKey('err.arg.path');
  const pts = normalisePath((path as unknown[]).map((p, i) => validPad(tk, p, `path[${i}]`)));
  const bad = checkWire(tk.board, pts);
  if (bad) refuse(bad);
  if (tk.board.wires.length >= MAX_WIRES) refuseKey('err.wires.limit', { max: MAX_WIRES });
  return { wid: wid ?? nextId('w', tk.board.wires.map((w) => w.wid)), path: pts };
}

/** The answer to a new wire: which pin / connector each end landed on, and a warning for an end that touches nothing. */
function wireAdded(tk: TicketState, w: Wire): [string, Record<string, unknown>] {
  const ends = [w.path[0]!, w.path[w.path.length - 1]!] as Pad[], what = ends.map((e) => padWhat(tk.board, e, w.wid));
  const hang = danglingEnds(tk.board).filter((e) => e.wid === w.wid);
  let msg = say('wire.added', { wid: w.wid });
  for (const h of hang) msg += ' ' + say('wire.dangling', { pad: `${h.pad[0]},${h.pad[1]}` });
  return [msg, { wid: w.wid, landed: ends.map((e, i) => ({ pad: e, kind: what[i]!.kind, text: what[i]!.text })), dangling: hang.map((h) => h.pad) }];
}

// ---------------------------------------------------------------- pad-to-pad routing (the `wire` action)
/** Candidate orthogonal routes from a to b, simplest first: straight, the two L shapes, then Z shapes through nearby columns and rows. */
function routes(a: Pad, b: Pad, w: number, h: number): Pad[][] {
  const out: Pad[][] = [];
  if (a[0] === b[0] || a[1] === b[1]) out.push([a, b]);
  out.push([a, [b[0], a[1]], b], [a, [a[0], b[1]], b]);
  const near = (c: number, span: number): number[] => { const r: number[] = []; for (let d = 1; d <= span; d++) r.push(c + d, c - d); return r; };
  const mx = Math.floor((a[0] + b[0]) / 2), my = Math.floor((a[1] + b[1]) / 2);
  for (const x of [mx, ...near(mx, Math.max(w, h))]) if (x >= 0 && x < w) out.push([a, [x, a[1]], [x, b[1]], b]);
  for (const y of [my, ...near(my, Math.max(w, h))]) if (y >= 0 && y < h) out.push([a, [a[0], y], [b[0], y], b]);
  return out;
}

/** Fallback router: cheapest orthogonal path over the whole board (Dijkstra on pad + heading). It may cross other wires (drawn as hop-overs) but never runs over a leg,
 * a connector or another wire's end; turns and running along another wire cost extra, so the route stays tidy. Deterministic (ties broken by index order). */
function autoRoute(b: { w: number; h: number; parts: PlacedPart[]; wires: Wire[]; connectors: { id: string; pad: Pad }[] }, a: Pad, z: Pad): Pad[] | null {
  const occ = occupancy(b as never);
  const ak = padKey(a), zk = padKey(z), W = b.w, H = b.h, N = W * H;
  const blocked = (x: number, y: number): boolean => { const k = padKey([x, y]); return k !== ak && k !== zk && (occ.pins.has(k) || occ.connectors.has(k) || occ.ends.has(k)); };
  const DX = [1, 0, -1, 0], DY = [0, 1, 0, -1];
  const dist = new Float64Array(N * 4).fill(Infinity), prev = new Int32Array(N * 4).fill(-1), done = new Uint8Array(N * 4);
  const open: number[] = [];
  for (let d = 0; d < 4; d++) { const s = (a[1] * W + a[0]) * 4 + d; dist[s] = 0; open.push(s); }
  let goal = -1;
  while (open.length > 0) {
    let bi = 0; for (let i = 1; i < open.length; i++) if (dist[open[i]!]! < dist[open[bi]!]! || (dist[open[i]!] === dist[open[bi]!] && open[i]! < open[bi]!)) bi = i;
    const cur = open.splice(bi, 1)[0]!; if (done[cur]) continue; done[cur] = 1;
    const cell = Math.floor(cur / 4), dir = cur % 4, cx = cell % W, cy = Math.floor(cell / W);
    if (cx === z[0] && cy === z[1]) { goal = cur; break; }
    for (let nd = 0; nd < 4; nd++) {
      const nx = cx + DX[nd]!, ny = cy + DY[nd]!;
      if (nx < 0 || ny < 0 || nx >= W || ny >= H || blocked(nx, ny)) continue;
      const nk = padKey([nx, ny]);
      const cost = dist[cur]! + 1 + (nd === dir || (cx === a[0] && cy === a[1]) ? 0 : 3) + (occ.interior.has(nk) ? 2 : 0);
      const ns = (ny * W + nx) * 4 + nd;
      if (cost < dist[ns]!) { dist[ns] = cost; prev[ns] = cur; open.push(ns); }
    }
  }
  if (goal < 0) return null;
  const cells: Pad[] = [];
  for (let s = goal; s >= 0; s = prev[s]!) { const cell = Math.floor(s / 4); cells.push([cell % W, Math.floor(cell / W)]); }
  cells.reverse();
  return normalisePath(cells.filter((p, i) => i === 0 || p[0] !== cells[i - 1]![0] || p[1] !== cells[i - 1]![1]));
}

// ---------------------------------------------------------------- the action table
export function makeActions(defs: Defs): Record<string, ActionFn<NodeState>> {
  const A: Record<string, ActionFn<NodeState>> = {
    /** Open ticket `id` on the bench (inside the campaign state: `level` stays null). */
    openTicket: (s, id: unknown) => {
      need(typeof id === 'string' && id !== '', t('ticket.needId'));
      const def = levelDefOf(defs, id);
      if (!def) fail(t('ticket.unknown', { id: String(id), known: defs.map((x) => x.id).join(', ') }));
      need(!s.ticket, t('ticket.alreadyOpen', { id: s.ticket?.id ?? '' }));
      const missing = (def!.after ?? []).filter((a) => !s.progress.tickets[a]?.passed);
      if (missing.length > 0 && !sandbox(s)) refuseKey('ticket.locked', { id: def!.id, needs: missing.join(', ') });
      openTicketIn(s, def!);
      return ok(t('ticket.opened', { id: def!.id, title: t(def!.titleKey) }));
    },
    /** Close the open ticket and go back to the counter (the board is dropped; progress stays). */
    closeTicket: (s) => {
      need(s.ticket, t('ticket.noneOpen'));
      const id = s.ticket.id; s.ticket = null;
      return ok(t('ticket.closed', { id }));
    },

    // ---- board
    placePart: (s, partId: unknown, value: unknown, rating: unknown, x: unknown, y: unknown, rot: unknown, flip: unknown) => {
      const { tk, def } = open(s, defs), before = copyBoard(tk);
      const part = newPart(s, tk, def, { partId, value, rating, x, y, rot, flip });
      tk.board.parts.push(part); sortParts(tk.board); commit(tk, 'placePart', before);
      const d = getDef(part.partId)!;
      return ok(say(d.kind === 'CE' ? 'part.placed.polar' : 'part.placed', { ...nm(tk, part.uid), name: t(d.nameKey) }), { uid: part.uid, value: part.value, variant: part.variant });
    },
    movePart: (s, uid: unknown, x: unknown, y: unknown) => {
      const { tk } = open(s, defs), p = partOf(tk, uid, true), before = copyBoard(tk);
      const nx = int(x, 'x'), ny = int(y, 'y');
      const spot = checkPartSpot(tk.board, getDef(p.partId)!, { x: nx, y: ny, rot: p.rot, flip: p.flip }, p.uid);
      if (spot) refuse(spot);
      p.x = nx; p.y = ny; commit(tk, 'movePart', before);
      const hang = danglingEnds(tk.board).length;
      return ok(say('part.moved', { ...nm(tk, p.uid), x: nx, y: ny }) + (hang > 0 ? ' ' + say('part.moved.hanging', { n: hang }) : ''));
    },
    rotatePart: (s, uid: unknown, flip?: unknown) => {
      const { tk } = open(s, defs), p = partOf(tk, uid, true), before = copyBoard(tk);
      const rot = flip === true ? p.rot : (((p.rot + 1) % 4) as 0 | 1 | 2 | 3), fl = flip === true ? !p.flip : p.flip;
      const spot = checkPartSpot(tk.board, getDef(p.partId)!, { x: p.x, y: p.y, rot, flip: fl }, p.uid);
      if (spot) refuse(spot);
      p.rot = rot; p.flip = fl; commit(tk, 'rotatePart', before);
      return ok(say('part.rotated', { ...nm(tk, p.uid), rot: rot * 90 }));
    },
    deletePart: (s, uid: unknown) => {
      const { tk } = open(s, defs), p = partOf(tk, uid, true), before = copyBoard(tk);
      const gone0 = nm(tk, p.uid);
      const legs = new Set(before.parts.filter((x) => x.uid === p.uid).flatMap((x) => { const d = getDef(x.partId); return d ? pinPads(x, d).map((q) => `${q[0]},${q[1]}`) : []; }));
      tk.board.parts = tk.board.parts.filter((x) => x.uid !== p.uid);
      // a wire whose end was held only by this part's leg now hangs in the air: take it off too (undo puts it back)
      const hanging = danglingEnds(tk.board).filter((e) => legs.has(`${e.pad[0]},${e.pad[1]}`)).map((e) => e.wid);
      const gone = [...new Set(hanging)];
      tk.board.wires = tk.board.wires.filter((w) => !gone.includes(w.wid));
      tk.live.smoked = tk.live.smoked.filter((u) => u !== p.uid); delete tk.live.temps[p.uid];
      commit(tk, 'deletePart', before);
      return ok(say(gone.length > 0 ? 'part.deleted.wires' : 'part.deleted', { ...gone0, n: gone.length }), { removedWires: gone });
    },
    setValue: (s, uid: unknown, value: unknown) => {
      const { tk, def } = open(s, defs), p = partOf(tk, uid, true), before = copyBoard(tk);
      const { d, entry } = binEntry(s, def, p.partId), allowed = allowedValues(d, entry);
      if (!allowed) refuseKey('err.value.none', { name: p.partId });
      const r = snapValue(d, allowed!, value); if (isProblem(r)) refuse(r); else p.value = r.value;
      commit(tk, 'setValue', before);
      return ok(say('part.valueSet', nm(tk, p.uid)), { value: p.value });
    },
    swapVariant: (s, uid: unknown, rating: unknown) => {
      const { tk, def } = open(s, defs), p = partOf(tk, uid, true), before = copyBoard(tk);
      const { d, entry } = binEntry(s, def, p.partId), variants = allowedVariants(d, entry), r = str(rating, 'rating');
      if (!variants.includes(r)) refuseKey('err.variant.notAllowed', { name: p.partId, rating: r, allowed: variants.join(', ') });
      p.variant = r; commit(tk, 'swapVariant', before);
      return ok(say('part.swapped', { ...nm(tk, p.uid), rating: r }));
    },
    addWire: (s, path: unknown) => {
      const { tk } = open(s, defs), before = copyBoard(tk);
      const w = newWire(tk, path);
      tk.board.wires.push(w); sortWires(tk.board); commit(tk, 'addWire', before);
      return ok(...wireAdded(tk, w));
    },
    /** Pad-to-pad wire: the engine picks a clean orthogonal route (the click-drag of the UI). */
    wire: (s, a: unknown, b: unknown) => {
      const { tk } = open(s, defs), before = copyBoard(tk);
      const pa = validPad(tk, a, 'a'), pb = validPad(tk, b, 'b');
      if (pa[0] === pb[0] && pa[1] === pb[1]) refuseKey('err.wire.samePad');
      let found: Pad[] | null = null;
      for (const r of routes(pa, pb, tk.board.w, tk.board.h)) {
        const pts = normalisePath(r.map((p) => [p[0], p[1]] as Pad));
        if (!checkWire(tk.board, pts)) { found = pts; break; }
      }
      if (!found) { const r = autoRoute(tk.board, pa, pb); if (r && !checkWire(tk.board, r)) found = r; }
      if (!found) refuseKey('err.wire.noRoute', { a: `${pa[0]},${pa[1]}`, b: `${pb[0]},${pb[1]}` });
      const w = newWire(tk, found);
      tk.board.wires.push(w); sortWires(tk.board); commit(tk, 'wire', before);
      const [msg, extra] = wireAdded(tk, w);
      return ok(msg, { ...extra, path: w.path });
    },
    /** Remove a wire by id, or every wire that ends on a pad. */
    unwire: (s, target: unknown) => {
      const { tk } = open(s, defs), before = copyBoard(tk);
      if (typeof target === 'string') {
        if (!tk.board.wires.some((w) => w.wid === target)) refuseKey('err.wire.none', { wid: target, have: tk.board.wires.map((w) => w.wid).join(', ') || '-' });
        if (tk.board.wires.find((w) => w.wid === target)!.fixed) refuseKey('err.wire.fixed');
        tk.board.wires = tk.board.wires.filter((w) => w.wid !== target); commit(tk, 'unwire', before);
        return ok(say('wire.deleted', { wid: target }), { removed: [target] });
      }
      const p = validPad(tk, target, 'pad');
      const hit = tk.board.wires.filter((w) => !w.fixed && ((w) => { const f = w.path[0]!, l = w.path[w.path.length - 1]!; return (f[0] === p[0] && f[1] === p[1]) || (l[0] === p[0] && l[1] === p[1]); })(w));
      if (hit.length === 0) refuseKey('err.unwire.none', { pad: `${p[0]},${p[1]}` });
      const ids = hit.map((w) => w.wid);
      tk.board.wires = tk.board.wires.filter((w) => !ids.includes(w.wid)); commit(tk, 'unwire', before);
      return ok(say('wire.unwired', { n: ids.length, pad: `${p[0]},${p[1]}` }), { removed: ids });
    },
    deleteWire: (s, wid: unknown) => {
      const { tk } = open(s, defs), id = str(wid, 'wid'), before = copyBoard(tk);
      if (!tk.board.wires.some((w) => w.wid === id)) refuseKey('err.wire.none', { wid: id, have: tk.board.wires.map((w) => w.wid).join(', ') || '-' });
      if (tk.board.wires.find((w) => w.wid === id)!.fixed) refuseKey('err.wire.fixed');
      tk.board.wires = tk.board.wires.filter((w) => w.wid !== id); commit(tk, 'deleteWire', before);
      return ok(say('wire.deleted', { wid: id }));
    },

    // ---- instruments
    attachProbe: (s, ch: unknown, pad: unknown) => {
      const { tk, def } = open(s, defs);
      if (!def.instruments.scope && !sandbox(s)) refuseKey('err.instrument.none', { what: 'scope' });
      const c = int(ch, 'ch'); if (c !== 1 && c !== 2) refuseKey('err.probe.channel', { ch: c });
      const p = validPad(tk, pad, 'pad');
      if (!nodeAt(tk, p)) refuseKey('err.probe.nothing', { pad: `${p[0]},${p[1]}` });
      tk.board.probes = tk.board.probes.filter((x) => x.ch !== c); tk.board.probes.push({ ch: c as 1 | 2, pad: p }); tk.board.probes.sort((a, b) => a.ch - b.ch);
      tk.live.scope = { ch1: [], ch2: [], t0: 0, dt: 0 }; tk.probed = true;
      return ok(say('probe.attached', { ch: c, what: padWhat(tk.board, p).text }));
    },
    detachProbe: (s, ch: unknown) => {
      const { tk } = open(s, defs), c = int(ch, 'ch');
      if (!tk.board.probes.some((x) => x.ch === c)) refuseKey('err.probe.none', { ch: c });
      tk.board.probes = tk.board.probes.filter((x) => x.ch !== c); tk.live.scope = { ch1: [], ch2: [], t0: 0, dt: 0 };
      return ok(say('probe.detached', { ch: c }));
    },
    setMeter: (s, mode: unknown, pads?: unknown) => {
      const { tk } = open(s, defs);
      const MODES = ['off', 'dcv', 'dca', 'ohm', 'acv'];
      if (typeof mode !== 'string' || !MODES.includes(mode)) refuseKey('err.meter.mode', { mode: String(mode), modes: MODES.join(', ') });
      if (mode === 'off') { tk.board.meter = { mode: 'off', pads: [] }; return ok(say('meter.off')); }
      const list = Array.isArray(pads) ? pads : [];
      if (list.length < 1 || list.length > 2) refuseKey('err.meter.pads', { mode: mode as string });
      const ps = list.map((p, i) => validPad(tk, p, `pads[${i}]`));
      for (const p of ps) if (!nodeAt(tk, p)) refuseKey('err.probe.nothing', { pad: `${p[0]},${p[1]}` });
      const conn = buildConnectivity(tk.board, getDef);
      if ((mode === 'dca' || mode === 'ohm') && ps.length < 2) refuseKey('err.meter.twoLeads', { mode: mode as string });
      if (ps.length === 2 && conn.nodeOfPad(ps[0]!) === conn.nodeOfPad(ps[1]!)) refuseKey('err.meter.sameNode', { mode: mode as string });
      tk.board.meter = { mode: mode as 'dcv' | 'dca' | 'ohm' | 'acv', pads: ps, red: ps[0] ?? null, black: ps[1] ?? null };
      return ok(say('meter.set', { mode: mode as string }));
    },
    /** Drag one DMM lead ('red' | 'black') onto a pad, or take it off the board (pad null). The first lead turns the dial from off to volts. */
    dmmLead: (s, lead: unknown, pad: unknown) => {
      const { tk } = open(s, defs);
      if (lead !== 'red' && lead !== 'black') refuseKey('err.meter.lead', { lead: String(lead) });
      const m = tk.board.meter, key = lead as 'red' | 'black';
      if (pad === null || pad === undefined) m[key] = null;
      else { const p = validPad(tk, pad, 'pad'); if (!nodeAt(tk, p)) refuseKey('err.probe.nothing', { pad: `${p[0]},${p[1]}` }); m[key] = p; }
      m.pads = m.red && m.black ? [m.red, m.black] : [];
      if (m.pads.length === 2) tk.probed = true;
      if (m.mode === 'off' && (m.red || m.black)) m.mode = 'dcv';
      return ok(say(m[key] ? 'meter.lead.set' : 'meter.lead.off', { lead: key, what: m[key] ? padWhat(tk.board, m[key]!).text : '-' }));
    },
    /** Turn the DMM dial: 'off' | 'dcv' (V) | 'dca' (mA) | 'ohm'. Leads stay where they are. */
    dmmDial: (s, mode: unknown) => {
      const { tk } = open(s, defs);
      const MODES = ['off', 'dcv', 'dca', 'ohm'];
      if (typeof mode !== 'string' || !MODES.includes(mode)) refuseKey('err.meter.dial', { mode: String(mode), modes: MODES.join(', ') });
      tk.board.meter.mode = mode as 'off' | 'dcv' | 'dca' | 'ohm';
      return ok(say('meter.dial', { mode: mode as string }));
    },
    setSupply: (s, v: unknown, ilim?: unknown) => {
      const { tk, def } = open(s, defs);
      if (!def.supplies.some((x) => x.kind === 'bench')) refuseKey('err.instrument.none', { what: 'supply' });
      const m = INSTRUMENTS.find((i) => i.id === 'inst-psu')!.model;
      const volts = q.volts(num(v, 'v')), amps = q.amps(ilim === undefined ? tk.instruments.supply.ilim : num(ilim, 'ilim'));
      if (volts < m.vMin! || volts > m.vMax!) refuseKey('err.supply.range', { v: volts, lo: m.vMin!, hi: m.vMax! });
      if (amps < m.iLimMin! || amps > m.iLimMax!) refuseKey('err.supply.ilim', { i: amps, lo: m.iLimMin!, hi: m.iLimMax! });
      tk.instruments.supply.v = volts; tk.instruments.supply.ilim = amps; touch(tk);
      return ok(say('supply.set', { v: volts, ilim: amps }));
    },
    setGen: (s, shape: unknown, f: unknown, vpp: unknown, offset?: unknown) => {
      const { tk, def } = open(s, defs);
      if (!def.supplies.some((x) => x.kind === 'gen')) refuseKey('err.instrument.none', { what: 'gen' });
      const SH = ['sine', 'square', 'triangle', 'pulse'];
      if (typeof shape !== 'string' || !SH.includes(shape)) refuseKey('err.gen.shape', { shape: String(shape), shapes: SH.join(', ') });
      const m = INSTRUMENTS.find((i) => i.id === 'inst-fgen')!.model;
      const fr = q.sig3(num(f, 'f')), vp = q.sig3(num(vpp, 'vpp')), off = q.sig3(offset === undefined ? 0 : num(offset, 'offset'));
      if (fr < m.fMin! || fr > m.fMax!) refuseKey('err.gen.f', { f: fr, lo: m.fMin!, hi: m.fMax! });
      if (vp < m.vppMin! || vp > m.vppMax!) refuseKey('err.gen.vpp', { vpp: vp, lo: m.vppMin!, hi: m.vppMax! });
      if (Math.abs(off) > m.vppMax! / 2) refuseKey('err.gen.offset', { offset: off, max: m.vppMax! / 2 });
      Object.assign(tk.instruments.gen, { shape: shape as 'sine', f: fr, vpp: vp, offset: off });
      return ok(say('gen.set', { shape: shape as string, f: fr, vpp: vp }));
    },
    setScope: (s, settings: unknown) => {
      const { tk } = open(s, defs);
      if (typeof settings !== 'object' || settings === null || Array.isArray(settings)) refuseKey('err.scope.arg');
      const a = settings as { timePerDiv?: unknown; voltsPerDiv?: unknown; trigger?: { source?: unknown; level?: unknown; edge?: unknown; mode?: unknown } };
      const sc = tk.instruments.scope = { ...newScope(), ...tk.instruments.scope };
      if (a.timePerDiv !== undefined) { const v = num(a.timePerDiv, 'timePerDiv'); if (v < 1e-6 || v > 1) refuseKey('err.scope.time', { v }); sc.timePerDiv = snap125(v, 1e-6, 1); }
      if (a.voltsPerDiv !== undefined) {
        if (!Array.isArray(a.voltsPerDiv) || a.voltsPerDiv.length !== 2) refuseKey('err.scope.volts', { v: '-' });
        const vs = (a.voltsPerDiv as unknown[]).map((x) => num(x, 'voltsPerDiv'));
        for (const v of vs) if (v < 1e-3 || v > 50) refuseKey('err.scope.volts', { v });
        sc.voltsPerDiv = [snap125(vs[0]!, 1e-3, 50), snap125(vs[1]!, 1e-3, 50)];
      }
      const tr = a.trigger;
      if (tr !== undefined) {
        if (tr.source !== undefined) { if (tr.source !== 1 && tr.source !== 2) refuseKey('err.probe.channel', { ch: String(tr.source) }); sc.trigger.source = tr.source as 1 | 2; }
        if (tr.level !== undefined) sc.trigger.level = q.volts(num(tr.level, 'level'));
        if (tr.edge !== undefined) { if (tr.edge !== 'rise' && tr.edge !== 'fall') refuseKey('err.scope.edge', { edge: String(tr.edge) }); sc.trigger.edge = tr.edge as 'rise' | 'fall'; }
        if (tr.mode !== undefined) { if (tr.mode !== 'auto' && tr.mode !== 'normal') refuseKey('err.scope.mode', { mode: String(tr.mode) }); sc.trigger.mode = tr.mode as 'auto' | 'normal'; }
      }
      tk.live.scope = { ch1: [], ch2: [], t0: 0, dt: 0 };
      return ok(say('scope.set'));
    },
    setPot: (s, uid: unknown, alpha: unknown) => {
      const { tk } = open(s, defs), p = partOf(tk, uid, false), d = getDef(p.partId)!;
      if (d.kind !== 'POT') refuseKey('err.pot.kind', { uid: p.uid, name: p.partId });
      const a = q.alpha(num(alpha, 'alpha')), lo = d.model.alphaMin ?? 0, hi = d.model.alphaMax ?? 1;
      if (a < lo || a > hi) refuseKey('err.pot.range', { alpha: a, lo, hi });
      p.pos = a; touch(tk);
      return ok(say('pot.set', { uid: p.uid, alpha: a }));
    },
    setJockey: (s, uid: unknown, l: unknown) => {
      const { tk } = open(s, defs), p = partOf(tk, uid, false), d = getDef(p.partId)!;
      if (d.kind !== 'SLIDEWIRE') refuseKey('err.jockey.kind', { uid: p.uid, name: p.partId });
      const lenMm = (d.model.lengthM ?? 1) * 1000, mm = q.mm(num(l, 'l'));
      if (mm < 0 || mm > lenMm) refuseKey('err.jockey.range', { l: mm, max: lenMm });
      p.pos = mm / lenMm; touch(tk);
      return ok(say('jockey.set', { uid: p.uid, l: mm }));
    },

    // ---- live
    power: (s, on: unknown) => {
      const { tk } = open(s, defs);
      if (typeof on !== 'boolean') refuseKey('err.arg.bool', { name: 'on' });
      tk.live.powered = on as boolean; tk.instruments.supply.on = on as boolean; tk.instruments.gen.on = on as boolean;
      delete tk.live.paused; resetLive(tk.live);
      return ok(say(on ? 'power.on' : 'power.off'));
    },
    /** Run or pause the sim (the UI's run/pause button): while paused, `advance` does nothing. Powering on or off resumes. */
    setRunning: (s, on: unknown) => {
      const { tk } = open(s, defs);
      if (typeof on !== 'boolean') refuseKey('err.arg.bool', { name: 'on' });
      if (on) delete tk.live.paused; else tk.live.paused = true;
      return ok(say(on ? 'run.running' : 'run.paused'), { paused: !on });
    },
    advance: (s, frames?: unknown) => {
      const { tk, def } = open(s, defs);
      const n = frames === undefined ? 1 : int(frames, 'frames');
      if (n < 1 || n > 8) refuseKey('err.advance.frames', { frames: n });
      if (tk.live.paused) return ok(say('run.paused'), { frames: 0, smoked: [], status: tk.live.status, paused: true });
      const live = tk.live, onBoard = new Set(tk.board.parts.map((p) => p.uid));
      live.smoked = live.smoked.filter((u) => onBoard.has(u));
      for (const u of Object.keys(live.temps)) if (!onBoard.has(u)) delete live.temps[u];
      const out = advanceLive(live, liveRig(tk, def), liveCfg(tk, def), n);
      live.issues = out.issues.slice(0, 4).map((i) => ({ key: i.key, vars: { ...i.vars } }));
      const rec = (s.progress.tickets[tk.id] ??= newTicketProgress());
      for (const ev of out.events) {
        const id = (s.progress.failureLog[s.progress.failureLog.length - 1]?.id ?? 0) + 1;
        // freeze the explanation now: it names the numbers and the loop as they were when the part burned, whatever the player edits afterwards
        const uid = typeof ev.vars.part === 'string' ? ev.vars.part : '';
        if (uid) (live.notes ??= {})[uid] = explainedText({ key: ev.key, vars: ev.vars }, tk, def, s.progress.failureLog.filter((x) => x.ticket === tk.id).length + rec.attempts);
        pushFailure(s.progress, { id, ticket: tk.id, tick: s.tick, kind: ev.key, vars: ev.vars });
        rec.smokes += 1;
        s.log.push({ tick: s.tick, level: 'bad', text: say(ev.key, nameVars(tk.board, ev.vars)) });
      }
      if (out.events.length > 0) return ok(say('live.smoked', { part: out.events.map((e) => partName(tk.board, e.part)).join(', '), text: say(out.events[0]!.key, nameVars(tk.board, out.events[0]!.vars)) }), { frames: out.frames, smoked: out.events.map((e) => e.part), status: live.status });
      return ok(say('live.advanced', { n: out.frames, t: sig(live.t, 3) }), { frames: out.frames, smoked: [], status: live.status });
    },
    /** The formal test. `coached` = the player's own bench button: a ticket whose lesson is measuring (measureFirst) refuses until the meter or scope has been used. */
    runBench: (s, coached?: unknown) => {
      const { tk, def } = open(s, defs);
      if (coached === true && def.measureFirst && !tk.probed) refuseKey('bench.measureFirst');
      // the player's own bench button with the power switch OFF: switch it on (the click and the toast say so) rather than testing a dark bench
      const autoPower = coached === true && !tk.live.powered;
      if (autoPower) { tk.live.powered = true; tk.instruments.supply.on = true; tk.instruments.gen.on = true; delete tk.live.paused; resetLive(tk.live); }
      const { result, causes } = benchTicket(s, def);
      tk.lastBench = result;
      const rec = (s.progress.tickets[tk.id] ??= newTicketProgress());
      rec.attempts += 1;
      for (const uid of result.smoked) if (!tk.live.smoked.includes(uid)) { tk.live.smoked.push(uid); delete tk.live.temps[uid]; rec.smokes += 1; }
      for (const c of causes) if (c.key.startsWith('smoke.') && typeof c.vars.part === 'string' && !tk.live.notes?.[c.vars.part]) (tk.live.notes ??= {})[c.vars.part] = explainedText({ key: c.key, vars: c.vars as Record<string, string | number> }, tk, def, s.progress.failureLog.filter((x) => x.ticket === tk.id).length + rec.attempts - 1);
      for (const c of causes) if (c.key.startsWith('smoke.')) {
        const id = (s.progress.failureLog[s.progress.failureLog.length - 1]?.id ?? 0) + 1;
        const vars: Record<string, string | number> = {}; for (const [k, v] of Object.entries(c.vars)) vars[k] = typeof v === 'number' ? sig(v, 3) : v;
        pushFailure(s.progress, { id, ticket: tk.id, tick: s.tick, kind: c.key, vars });
      }
      if (result.pass) {
        // payment: the fee on the first pass plus a bonus for every star earned for the first time (never paid twice)
        const first = !rec.passed, newStars = Math.max(0, result.stars - rec.stars), pay = def.pay ? (first ? def.pay.fee : 0) + def.pay.perStar * newStars : 0;
        if (pay > 0) { s.progress.wallet += pay; result.pay = pay; s.log.push({ tick: s.tick, level: 'good', text: say('wallet.paid', { amount: formatMinor(pay, REGIONS.get(s.region)) }) }); }
        rec.passed = true; rec.stars = Math.max(rec.stars, result.stars) as 0 | 1 | 2 | 3;
        const head = def.stars.head;
        if (rec.best === null || result.metrics[head] < rec.best[head]) rec.best = { ...result.metrics };
        const pack = REGIONS.get(s.region);
        s.log.push({ tick: s.tick, level: 'good', text: say('bench.pass', { id: tk.id, stars: result.stars, cost: formatMinor(result.metrics.cost, pack) }) });
        return ok((autoPower ? say('bench.autoPower') + ' ' : '') + say('bench.pass', { id: tk.id, stars: result.stars, cost: formatMinor(result.metrics.cost, pack) }), { pass: true, stars: result.stars, metrics: result.metrics, pay: result.pay ?? 0, autoPowered: autoPower });
      }
      return ok((autoPower ? say('bench.autoPower') + ' ' : '') + say('bench.fail', { id: tk.id, n: result.failures.length }), { pass: false, stars: 0, metrics: result.metrics, autoPowered: autoPower });
    },

    // ---- history
    undo: (s) => {
      const { tk } = open(s, defs);
      const e = tk.undo.pop(); if (!e) refuseKey('err.undo.none');
      const what = describeEdit(tk, e!), inv = applyEntry(tk, e!); pushUndo(tk.redo, inv);
      const fresh = freshenAfterBurn(tk);
      return ok(say('undo.done', { what }) + (fresh ? ' ' + say('undo.fresh') : ''), { fresh });
    },
    redo: (s) => {
      const { tk } = open(s, defs);
      const e = tk.redo.pop(); if (!e) refuseKey('err.redo.none');
      const what = describeEdit(tk, e!), inv = applyEntry(tk, e!); pushUndo(tk.undo, inv);
      const fresh = freshenAfterBurn(tk);
      return ok(say('redo.done', { what }) + (fresh ? ' ' + say('undo.fresh') : ''), { fresh });
    },

    // ---- teaching
    hint: (s) => {
      const { tk, def } = open(s, defs);
      if (!def.hints) refuseKey('err.hint.none');
      const rung = Math.min(3, tk.hintRung + 1);
      tk.hintRung = rung;
      if (s.mode === 'engineer') { const rec = (s.progress.tickets[tk.id] ??= newTicketProgress()); rec.assisted = true; }
      if (rung === 1 || !def.hints!.equation) return ok(t(def.hints!.nudge), { rung });
      if (rung === 2) {
        const mine = probeOn(tk.board, def, tk), ref = probeOn(refBoard(def), def, tk);
        const probe = (p: string): number | null => mine(p) ?? ref(p);
        const vars: Record<string, string | number> = {};
        for (const [k, e] of Object.entries(def.hints!.equation.vars)) { const v = evalHint(e, probe); vars[k] = v === null ? '-' : sig(v, 3); }
        return ok(t(def.hints!.equation.key, vars), { rung });
      }
      // rung 3: the ghost of one missing part from the reference solution, at its suggested pad (never an auto-solve)
      const have = tk.board.parts.filter((p) => !p.fixed).map((p) => `${p.partId}@${p.value}`);
      const ref = refBoard(def);
      for (const p of ref.parts) {
        if (p.fixed) continue;
        const k = `${p.partId}@${p.value}`, i = have.indexOf(k);
        if (i >= 0) { have.splice(i, 1); continue; }
        const d = getDef(p.partId)!;
        return ok(say('hint.ghost', { name: t(d.nameKey), value: p.value === null ? '-' : String(p.value), x: p.x, y: p.y }), { rung, ghost: { partId: p.partId, value: p.value, variant: p.variant, x: p.x, y: p.y, rot: p.rot, flip: p.flip } });
      }
      return ok(say('hint.complete'), { rung });
    },
    predict: (s, id: unknown, value: unknown) => {
      const { tk, def } = open(s, defs), pid = str(id, 'id');
      const known = def.bench.specs.filter((x) => x.kind === 'predict').map((x) => x.id);
      if (!known.includes(pid)) refuseKey('err.predict.unknown', { id: pid, known: known.join(', ') || '-' });
      tk.predictions[pid] = sig(num(value, 'value'), 6); touch(tk);
      return ok(say('predict.set', { id: pid }));
    },
    replaceSmoked: (s, uid: unknown) => {
      const { tk } = open(s, defs), id = str(uid, 'uid');
      if (!tk.board.parts.some((p) => p.uid === id)) refuseKey('err.part.none', { uid: id, have: tk.board.parts.map((x) => x.uid).join(', ') || '-' });
      if (!tk.live.smoked.includes(id)) refuseKey('err.smoked.none', nm(tk, id));
      tk.live.smoked = tk.live.smoked.filter((u) => u !== id); delete tk.live.temps[id]; if (tk.live.notes) delete tk.live.notes[id]; resetLive(tk.live); tk.lastBench = null;
      // the fresh part starts cold and the power goes OFF: it must not burn again until the player switches the power on
      tk.live.powered = false; tk.instruments.supply.on = false; tk.instruments.gen.on = false; delete tk.live.paused;
      return ok(say('part.replaced', nm(tk, id)));
    },

    // ---- boards as data (solution-code actions; the code format itself is M2-3)
    loadBoard: (s, payload: unknown) => {
      const { tk, def } = open(s, defs), before = copyBoard(tk);
      if (typeof payload !== 'object' || payload === null) refuseKey('err.board.payload');
      const pl = payload as { parts?: unknown; wires?: unknown };
      if (!Array.isArray(pl.parts) || !Array.isArray(pl.wires)) refuseKey('err.board.payload');
      tk.board.parts = tk.board.parts.filter((p) => p.fixed); tk.board.wires = tk.board.wires.filter((w) => w.fixed);
      let n = 0;
      for (const raw of pl.parts as Record<string, unknown>[]) {
        const uid = typeof raw.uid === 'string' && /^p\d+$/.test(raw.uid) && !tk.board.parts.some((p) => p.uid === raw.uid) ? raw.uid : undefined;
        const part = newPart(s, tk, def, { partId: raw.partId, value: raw.value ?? null, rating: raw.variant, x: raw.x, y: raw.y, rot: raw.rot, flip: raw.flip, uid });
        if (typeof raw.pos === 'number' && part.pos !== undefined) part.pos = q.alpha(raw.pos);
        tk.board.parts.push(part); sortParts(tk.board); n++;
      }
      for (const raw of pl.wires as Record<string, unknown>[]) { const w = newWire(tk, raw.path, typeof raw.wid === 'string' && /^w\d+$/.test(raw.wid) && !tk.board.wires.some((x) => x.wid === raw.wid) ? raw.wid : undefined); tk.board.wires.push(w); sortWires(tk.board); }
      commit(tk, 'loadBoard', before);
      return ok(say('board.loaded', { parts: n, wires: tk.board.wires.length }));
    },
    exportSolution: (s) => {
      const { tk } = open(s, defs);
      if (!tk.lastBench?.pass) refuseKey('err.export.notPassed');
      const board = { parts: tk.board.parts.filter((p) => !p.fixed).map((p) => ({ ...p })), wires: tk.board.wires.map((w) => ({ wid: w.wid, path: w.path.map((q2) => [q2[0], q2[1]]) })) };
      return ok(say('export.ready', { id: tk.id }), { ticket: tk.id, board, metrics: { ...tk.lastBench!.metrics }, code: null });
    },
  };
  return A;
}
