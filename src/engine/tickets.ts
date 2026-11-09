// PLACEHOLDER ticket table (M0-2). Replaced in M2 by the real ticket files (src/data/levels/<id>.ts, DESIGN §2.9).
// One placeholder ticket `0-0` with an empty board and its connectors exists so that openTicket / closeTicket, the core Level
// harness and the Godot front-end have something to run. It cannot be passed. Nothing here is campaign content.
import type { Board } from '../sim/board/types';
import { newTicketState, type CustomerId, type LevelId, type NodeState } from './state';

export interface PlaceholderTicket {
  id: LevelId;
  /** i18n keys: the ticket's title and brief. The brief may use {customer}, {mentor}, {stall}, {lane} (all region-pack strings). */
  titleKey: string; briefKey: string;
  customer: CustomerId;
  board: Board;
}

export const PLACEHOLDER_TICKETS: readonly PlaceholderTicket[] = [
  {
    id: '0-0', titleKey: 'ticket.0-0.title', briefKey: 'ticket.0-0.brief', customer: 'kid_torch',
    board: {
      w: 24, h: 16,
      connectors: [{ id: 'IN', pad: [0, 4], role: 'source' }, { id: 'OUT', pad: [23, 4], role: 'load' }, { id: 'GND', pad: [0, 12], role: 'ground' }],
      parts: [], wires: [],
    },
  },
];

export const ticketDef = (id: unknown): PlaceholderTicket | undefined => PLACEHOLDER_TICKETS.find((t) => t.id === id);

/** Open ticket `id` on `s`. Shared by the openTicket action and the core Level setup, so both take the same code path. */
export function openTicketIn(s: NodeState, id: LevelId): void {
  const def = ticketDef(id);
  if (!def) throw new Error(`openTicketIn: unknown ticket '${id}'`);
  s.ticket = newTicketState(def.id, def.board);
}
