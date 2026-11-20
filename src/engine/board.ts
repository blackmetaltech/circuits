// Board editing rules for the engine (DESIGN §6.2 inventory, §8.4 validation): pad occupancy, part / wire checks, bin and value rules.
// Every check returns an i18n { key, vars } or null; the caller turns it into a teaching message with `t`. Pure functions of the board.
import type { PartDef } from '../data/parts/types';
import { findPart } from '../data/parts';
import { eseries, type ESeries } from '../data/eseries';
import type { BinEntry } from '../data/levels/types';
import type { Board, Pad, PlacedPart, Wire } from '../sim/board/types';
import { padKey, segmentPads } from '../sim/board/grid';
import { pinPads } from '../sim/board/footprints';
import { validateWire } from '../sim/board/connectivity';
import { si } from '../sim/explain';
import { partName } from './names';

export type Problem = { key: string; vars: Record<string, string | number> };
export const problem = (key: string, vars: Record<string, string | number> = {}): Problem => ({ key, vars });
export const padText = (p: Pad): string => `${p[0]},${p[1]}`;
/** How a board connector is named to the player (the ids are the engine's). */
export const connName = (id: string): string => ({ VP: 'V+', GND: 'GND', IN: 'IN', OUT: 'OUT' } as Record<string, string>)[id] ?? id;

export const getDef = (id: string): PartDef | undefined => findPart(id);

/** Canonical order: fixed fixtures first, then by uid prefix and number (p2 before p10), so the board never depends on edit history. */
export function uidCmp(a: string, b: string): number {
  const ma = /^([a-z]+)(\d+)$/.exec(a), mb = /^([a-z]+)(\d+)$/.exec(b);
  if (ma && mb) return ma[1]! < mb[1]! ? -1 : ma[1]! > mb[1]! ? 1 : Number(ma[2]) - Number(mb[2]);
  return a < b ? -1 : a > b ? 1 : 0;
}
export const sortParts = (b: { parts: PlacedPart[] }): void => { b.parts.sort((x, y) => uidCmp(x.uid, y.uid)); };
export const sortWires = (b: { wires: Wire[] }): void => { b.wires.sort((x, y) => uidCmp(x.wid, y.wid)); };
export function nextId(prefix: string, ids: readonly string[]): string {
  let n = 0;
  for (const id of ids) { const m = new RegExp(`^${prefix}(\\d+)$`).exec(id); if (m && Number(m[1]) > n) n = Number(m[1]); }
  return `${prefix}${n + 1}`;
}

// ---------------------------------------------------------------- occupancy
export interface Occupancy {
  pins: Map<string, { uid: string; pin: number }>;
  connectors: Map<string, string>;
  ends: Map<string, string[]>;
  interior: Map<string, string[]>;
}
export function wirePads(path: readonly Pad[]): { ends: Pad[]; interior: Pad[] } {
  const all: Pad[] = [];
  for (let i = 1; i < path.length; i++) for (const p of segmentPads(path[i - 1]!, path[i]!)) if (all.length === 0 || padKey(all[all.length - 1]!) !== padKey(p)) all.push(p);
  return { ends: [path[0]!, path[path.length - 1]!], interior: all.slice(1, -1) };
}
export function occupancy(b: Board, skipUid?: string, skipWid?: string): Occupancy {
  const o: Occupancy = { pins: new Map(), connectors: new Map(), ends: new Map(), interior: new Map() };
  for (const c of b.connectors) o.connectors.set(padKey(c.pad), c.id);
  for (const p of b.parts) {
    if (p.uid === skipUid) continue;
    const d = getDef(p.partId); if (!d) continue;
    pinPads(p, d).forEach((q, i) => o.pins.set(padKey(q), { uid: p.uid, pin: i }));
  }
  const push = (m: Map<string, string[]>, k: string, w: string): void => { const a = m.get(k); if (a) a.push(w); else m.set(k, [w]); };
  for (const w of b.wires) {
    if (w.wid === skipWid || w.path.length < 2) continue;
    const { ends, interior } = wirePads(w.path);
    for (const e of ends) push(o.ends, padKey(e), w.wid);
    for (const i of interior) push(o.interior, padKey(i), w.wid);
  }
  return o;
}

// ---------------------------------------------------------------- parts
const WIRE_ERR: Record<string, string> = { tooShort: 'err.wire.tooShort', notOrthogonal: 'err.wire.diagonal', zeroLength: 'err.wire.zero', outOfBounds: 'err.wire.bounds', nonInteger: 'err.wire.int', loop: 'err.wire.loop' };

/** Can a part with this geometry sit on the board? `skipUid` = the part itself (a move / rotate). */
export function checkPartSpot(b: Board, def: PartDef, geo: Pick<PlacedPart, 'x' | 'y' | 'rot' | 'flip'>, skipUid?: string): Problem | null {
  const pads = pinPads(geo, def);
  const occ = occupancy(b, skipUid);
  for (const q of pads) {
    if (q[0] < 0 || q[0] >= b.w || q[1] < 0 || q[1] >= b.h) return problem('err.part.bounds', { pad: padText(q), w: b.w, h: b.h });
  }
  for (const q of pads) {
    const k = padKey(q), pin = occ.pins.get(k);
    if (pin) { const other = b.parts.find((x) => x.uid === pin.uid)!; const od = getDef(other.partId); return problem('err.pad.occupied', { pad: padText(q), part: partName(b, pin.uid) }); }
    if (occ.interior.has(k)) return problem('err.pad.underWire', { pad: padText(q), wire: occ.interior.get(k)![0]! });
  }
  return null;
}

/** Wire rules: orthogonal, in bounds, connects only at its ends: no pin / connector / wire end may sit under its middle, and its ends may not land on another wire's middle. */
export function checkWire(b: Board, path: Pad[], skipWid?: string): Problem | null {
  if (!Array.isArray(path)) return problem('err.wire.tooShort');
  for (const q of path) if (!Array.isArray(q) || q.length !== 2 || !Number.isInteger(q[0]) || !Number.isInteger(q[1])) return problem('err.wire.int');
  const bad = validateWire({ wid: 'w?', path }, b);
  if (bad) return problem(WIRE_ERR[bad.code] ?? 'err.wire.bad', bad.code === 'outOfBounds' ? { w: b.w, h: b.h } : {});
  const occ = occupancy(b, undefined, skipWid);
  const { ends, interior } = wirePads(path);
  for (const q of interior) {
    const k = padKey(q);
    if (occ.pins.has(k)) return problem('err.wire.overPin', { pad: padText(q), part: partName(b, occ.pins.get(k)!.uid) });
    if (occ.connectors.has(k)) return problem('err.wire.overConnector', { pad: padText(q), connector: connName(occ.connectors.get(k)!) });
    if (occ.ends.has(k)) return problem('err.wire.overEnd', { pad: padText(q), wire: occ.ends.get(k)![0]! });
  }
  for (const q of ends) { const k = padKey(q); if (occ.interior.has(k)) return problem('err.wire.tJunction', { pad: padText(q), wire: occ.interior.get(k)![0]! }); }
  const a = padKey(ends[0]!), z = padKey(ends[1]!);
  for (const w of b.wires) {
    if (w.wid === skipWid) continue;
    const e0 = padKey(w.path[0]!), e1 = padKey(w.path[w.path.length - 1]!);
    if ((e0 === a && e1 === z) || (e0 === z && e1 === a)) return problem('err.wire.duplicate', { wire: w.wid });
  }
  return null;
}

/** Collinear middle points carry no information: drop them so every wire has exactly one encoding. */
export function normalisePath(path: Pad[]): Pad[] {
  const out: Pad[] = [];
  for (const q of path) {
    while (out.length >= 2) {
      const a = out[out.length - 2]!, m = out[out.length - 1]!;
      if ((a[0] === m[0] && m[0] === q[0]) || (a[1] === m[1] && m[1] === q[1])) out.pop(); else break;
    }
    out.push([q[0], q[1]]);
  }
  return out;
}

// ---------------------------------------------------------------- bin, variants, values
export interface BinView { entry: BinEntry | null; sandbox: boolean }

const unitOf = (d: PartDef): string => (d.kind === 'C' || d.kind === 'CE' ? 'F' : d.kind === 'L' ? 'H' : d.kind === 'R' || d.kind === 'POT' ? 'Ω' : '');

/** Allowed values of a part under a bin entry (null = the part has no value). */
export function allowedValues(d: PartDef, entry: BinEntry | null): number[] | null {
  // a bin entry with an explicit list gives values to a part the catalogue leaves valueless (textbook ideal sources / exact resistors)
  if (!d.values) return Array.isArray(entry?.values) ? entry!.values.slice() : null;
  const v = entry?.values;
  if (Array.isArray(v)) return v.slice();
  if (v === 'E12' || v === 'E24') {
    const lo = d.values[0]!, hi = d.values[d.values.length - 1]!;
    const set = eseries(v as ESeries, lo, hi);
    return d.values.filter((x) => set.some((y) => Math.abs(y - x) <= 1e-9 * y));
  }
  return d.values.slice();
}
export const allowedVariants = (d: PartDef, entry: BinEntry | null): string[] => (entry?.variants ? d.variants.map((x) => x.id).filter((id) => entry.variants!.includes(id)) : d.variants.map((x) => x.id));

/** Snap `v` to an allowed value (exact to 1e-9 relative), or say which neighbours exist. */
export function snapValue(d: PartDef, allowed: number[], v: unknown): { value: number } | Problem {
  if (typeof v !== 'number' || !Number.isFinite(v) || v <= 0) return problem('err.value.number', { name: d.id });
  const hit = allowed.find((x) => Math.abs(x - v) <= 1e-9 * x);
  if (hit !== undefined) return { value: hit };
  const lo = allowed.filter((x) => x < v).pop(), hi = allowed.find((x) => x > v);
  const u = unitOf(d), near = [lo, hi].filter((x): x is number => x !== undefined).map((x) => si(x, u)).join(' / ');
  return problem('err.value.notAllowed', { value: si(v, u), name: d.id, near: near || '-' });
}

export const isProblem = (x: unknown): x is Problem => typeof x === 'object' && x !== null && 'key' in x;
