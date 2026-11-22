// Tickets in the campaign state (DESIGN §8.3): a ticket is opened INSIDE the campaign state (`s.level` stays null) from a data-only LevelDef.
// The same `openTicketIn` runs for the openTicket action and for the core Level setup (levels.ts), so both take the same code path.
import { withRng } from '@core/kit';
import type { Board, PlacedPart } from '../sim/board/types';
import type { HiddenDef, LevelDef } from '../data/levels/types';
import { sig } from '../sim/explain';
import { newTicketState, type NodeState, type TicketState } from './state';

/** A ticket's `after` list: every entry must be passed; an entry written `a|b` is met by passing either (chapter 2 opens after 1-4 OR the 1-5 exam). Returns the unmet entries (empty = unlocked). */
export function unmetAfter(def: LevelDef, passed: (id: string) => boolean): string[] {
  return (def.after ?? []).filter((a) => !a.split('|').some((id) => passed(id)));
}
export const isUnlocked = (def: LevelDef, passed: (id: string) => boolean): boolean => unmetAfter(def, passed).length === 0;

export const levelDefOf = (defs: readonly LevelDef[], id: unknown): LevelDef | undefined => defs.find((d) => d.id === id);

/** The board a ticket starts with: its connectors and fixed parts, plus a repair ticket's faulty board unless `bare`. */
export function startBoard(def: LevelDef, bare = false): Board {
  const b: Board = { w: def.board.w, h: def.board.h, connectors: structuredClone(def.board.connectors), ...(def.board.keepOut ? { keepOut: structuredClone(def.board.keepOut) } : {}), parts: structuredClone(def.fixed) as PlacedPart[], wires: (def.fixedWires ?? []).map((path, i) => ({ wid: `fw${i + 1}`, path: path.map((q) => [q[0], q[1]] as [number, number]), fixed: true })) };
  if (def.fault && !bare) {
    def.fault.parts.forEach((p, i) => b.parts.push({ ...structuredClone(p), uid: `x${i + 1}` } as PlacedPart));
    def.fault.wires.forEach((path, i) => b.wires.push({ wid: `xw${i + 1}`, path: path.map((q) => [q[0], q[1]] as [number, number]) }));
  }
  return b;
}
/** The uids of a repair ticket's parts that arrive burnt. */
export const faultSmoked = (def: LevelDef): string[] => (def.fault?.smoked ?? []).map((i) => `x${i + 1}`);

/** Hidden parameters: Learner uses the fixed value, every other mode draws from the save's rng (3 significant figures, so codes stay short). */
export function drawHidden(s: NodeState, hidden: readonly HiddenDef[] | undefined): Record<string, number> {
  const out: Record<string, number> = {};
  for (const h of hidden ?? []) out[h.id] = s.mode === 'learner' ? h.learner : withRng(s, (r) => sig(r.range(h.seeded[0], h.seeded[1]), 3));
  return out;
}

/** The ref solution as a board (uids p1, p2... in placement order, wires w1...), used by hints and the expert persona. */
export function refBoard(def: LevelDef): Board {
  const b = startBoard(def, true);
  def.ref.parts.forEach((p, i) => b.parts.push({ ...p, uid: `p${i + 1}` } as PlacedPart));
  def.ref.wires.forEach((path, i) => b.wires.push({ wid: `w${i + 1}`, path: path.map((q) => [q[0], q[1]] as [number, number]) }));
  for (const [uid, mm] of Object.entries(def.ref.jockeys ?? {})) { const p = b.parts.find((x) => x.uid === uid); if (p) p.pos = mm / 1000; }
  return b;
}

export function openTicketIn(s: NodeState, def: LevelDef): void {
  const ps = def.instruments;
  const presets = { supply: ps.supply, gen: ps.gen, scope: ps.scope };
  const ticket: TicketState = newTicketState(def.id, startBoard(def), presets, drawHidden(s, def.hidden));
  for (const uid of faultSmoked(def)) ticket.live.smoked.push(uid);
  s.ticket = ticket;
}
