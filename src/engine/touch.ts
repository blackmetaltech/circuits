// What touches what on the board: the plain-words answer to "which pin did my wire land on?" and "is this wire end hanging in the air?".
// Pure functions of the board. Only wire ENDS connect (src/sim/board/connectivity.ts), so an end that meets no pin, connector or other wire end connects nothing.
import type { Board, Pad } from '../sim/board/types';
import { padKey } from '../sim/board/grid';
import { pinPads } from '../sim/board/footprints';
import { getDef, occupancy, padText } from './board';
import { say } from './text';

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
    return { kind: 'pin', uid: p.uid, pin: name, text: say('touch.pin', { part: p.uid, label: lab, kind: d ? d.kind : '' }) };
  }
  const cn = occ.connectors.get(k);
  if (cn) return { kind: 'connector', connector: cn, text: say('touch.connector', { connector: cn }) };
  if (occ.ends.has(k)) return { kind: 'wire', text: say('touch.wire', { wire: occ.ends.get(k)![0]! }) };
  return { kind: 'empty', text: say('touch.empty', { pad: padText(pad) }) };
}

/** Wire ends that meet nothing: no part pin, no connector, no other wire end on their pad. */
export function danglingEnds(b: Board): { wid: string; pad: Pad }[] {
  const occ = occupancy(b), out: { wid: string; pad: Pad }[] = [];
  for (const w of b.wires) {
    for (const e of [w.path[0]!, w.path[w.path.length - 1]!]) {
      const k = padKey(e);
      if (occ.pins.has(k) || occ.connectors.has(k)) continue;
      if ((occ.ends.get(k) ?? []).some((x) => x !== w.wid)) continue;
      out.push({ wid: w.wid, pad: e });
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
