// What touches what on the board: the plain-words answer to "which pin did my wire land on?" and "is this wire end hanging in the air?".
// Pure functions of the board. Only wire ENDS connect (src/sim/board/connectivity.ts), so an end that meets no pin, connector or other wire end connects nothing.
import type { Board, Pad } from '../sim/board/types';
import { padKey } from '../sim/board/grid';
import { pinPads } from '../sim/board/footprints';
import { connName, getDef, occupancy, wirePads } from './board';
import { say } from './text';
import { partName } from './names';

/** How a pin is named to the player: the LED and diode legs by polarity, everything else by its pin name. */
export function pinLabel(partId: string, pinName: string): string {
  const d = getDef(partId);
  if (d && (d.kind === 'LED' || d.kind === 'D')) {
    if (pinName === 'A') return d.kind === 'LED' ? 'A +' : 'A (anode)';
    if (pinName === 'K') return d.kind === 'LED' ? 'K -' : 'K (cathode)';
  }
  return pinName;
}

export interface PadWhat { kind: 'pin' | 'connector' | 'wire' | 'empty'; text: string; uid?: string; pin?: string; connector?: string }

/** What sits on a pad: a part pin (with its polarity name), a board connector, another wire's end, or nothing. */
export function padWhat(b: Board, pad: Pad, skipWid?: string): PadWhat {
  const occ = occupancy(b, undefined, skipWid), k = padKey(pad);
  const pin = occ.pins.get(k);
  if (pin) {
    const p = b.parts.find((x) => x.uid === pin.uid)!, d = getDef(p.partId);
    const name = d ? d.pins[pin.pin]! : String(pin.pin + 1), lab = pinLabel(p.partId, name);
    return { kind: 'pin', uid: p.uid, pin: name, text: say('touch.pin', { part: partName(b, p.uid), label: lab, kind: d ? d.kind : '' }) };
  }
  const cn = occ.connectors.get(k);
  if (cn) return { kind: 'connector', connector: cn, text: say('touch.connector', { connector: connName(cn) }) };
  if (occ.ends.has(k)) return { kind: 'wire', text: say('touch.wire', { wire: occ.ends.get(k)![0]! }) };
  return { kind: 'empty', text: say('touch.empty') };
}

/** Wire ends that meet nothing: no part pin, no connector, no other wire end on their pad. */
export function danglingEnds(b: Board): { wid: string; pad: Pad; first: boolean }[] {
  const occ = occupancy(b), out: { wid: string; pad: Pad; first: boolean }[] = [];
  for (const w of b.wires) {
    for (const [i, e] of [w.path[0]!, w.path[w.path.length - 1]!].entries()) {
      const k = padKey(e);
      if (occ.pins.has(k) || occ.connectors.has(k)) continue;
      if ((occ.ends.get(k) ?? []).some((x) => x !== w.wid)) continue;
      out.push({ wid: w.wid, pad: e, first: i === 0 });
    }
  }
  return out;
}

/** Part pins that nothing is wired to (no wire end, no connector on their pad). */
export function openPins(b: Board): { uid: string; pin: string; pad: Pad }[] {
  const occ = occupancy(b), out: { uid: string; pin: string; pad: Pad }[] = [];
  for (const p of b.parts) {
    const d = getDef(p.partId); if (!d) continue;
    pinPads(p, d).forEach((q, i) => { const k = padKey(q); if (!occ.ends.has(k) && !occ.connectors.has(k)) out.push({ uid: p.uid, pin: d.pins[i]!, pad: q }); });
  }
  return out;
}

// ---------------------------------------------------------------- crossings, runs alongside and junctions (the board's honest rule: a wire joins ONLY at its two ends)
export interface Contacts {
  /** Pads where this wire's middle crosses another wire's middle: insulated jumpers passing over each other, NOT joined. */
  crossings: { pad: Pad; wid: string }[];
  /** Other wires that run along a stretch of this one (sharing unit edges): side by side, NOT joined. */
  alongside: { wid: string; pads: number }[];
  /** Where an end of this wire lands on the same pad as an end of another wire: those ARE joined. */
  joins: { pad: Pad; wid: string }[];
}
const edgesOf = (path: Pad[]): Set<string> => {
  const e = new Set<string>();
  for (let i = 1; i < path.length; i++) {
    const a = path[i - 1]!, b = path[i]!, n = Math.max(Math.abs(b[0] - a[0]), Math.abs(b[1] - a[1])), dx = Math.sign(b[0] - a[0]), dy = Math.sign(b[1] - a[1]);
    for (let k = 0; k < n; k++) { const p = padKey([a[0] + dx * k, a[1] + dy * k]), q = padKey([a[0] + dx * (k + 1), a[1] + dy * (k + 1)]); e.add(p < q ? `${p}|${q}` : `${q}|${p}`); }
  }
  return e;
};
export function wireContacts(b: Board, w: { wid: string; path: Pad[] }): Contacts {
  const out: Contacts = { crossings: [], alongside: [], joins: [] };
  const mine = wirePads(w.path), myInterior = new Set(mine.interior.map(padKey)), myEdges = edgesOf(w.path), myEnds = new Set(mine.ends.map(padKey));
  for (const o of b.wires) {
    if (o.wid === w.wid || o.path.length < 2) continue;
    const th = wirePads(o.path), shared = edgesOf(o.path);
    let run = 0; for (const e of myEdges) if (shared.has(e)) run++;
    if (run > 0) out.alongside.push({ wid: o.wid, pads: run });
    const seen = new Set<string>();
    for (const p of th.interior) { const k = padKey(p); if (myInterior.has(k) && !seen.has(k)) { seen.add(k); if (!neighbourOnRun(k, myEdges, shared)) out.crossings.push({ pad: p, wid: o.wid }); } }
    for (const p of th.ends) if (myEnds.has(padKey(p))) out.joins.push({ pad: p, wid: o.wid });
  }
  return out;
}
/** A shared interior pad is a crossing (not part of a side-by-side run) unless one of its unit edges is shared by both wires. */
function neighbourOnRun(k: string, a: Set<string>, b: Set<string>): boolean {
  for (const e of a) if (b.has(e) && e.split('|').includes(k)) return true;
  return false;
}

/** Every crossing and every junction on the board, for the drawing: hop-overs where wires pass over each other, solder dots where two or more things are joined on one pad. */
export function boardJunctions(b: Board): { crossings: { pad: Pad; a: string; b: string }[]; joins: { pad: Pad; n: number }[] } {
  const crossings: { pad: Pad; a: string; b: string }[] = [], seen = new Set<string>();
  for (const w of b.wires) for (const c of wireContacts(b, w).crossings) { const key = [w.wid, c.wid].sort().join('~') + padKey(c.pad); if (!seen.has(key)) { seen.add(key); crossings.push({ pad: c.pad, a: w.wid < c.wid ? w.wid : c.wid, b: w.wid < c.wid ? c.wid : w.wid }); } }
  const occ = occupancy(b), joins: { pad: Pad; n: number }[] = [];
  for (const [k, wids] of occ.ends) {
    const n = wids.length + (occ.pins.has(k) ? 1 : 0) + (occ.connectors.has(k) ? 1 : 0);
    if (n >= 3 || (wids.length >= 2)) { const [x, y] = k.split(',').map(Number); joins.push({ pad: [x!, y!], n }); }
  }
  return { crossings, joins };
}
