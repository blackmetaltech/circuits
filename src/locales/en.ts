// Every player-facing string of the game, keyed. `{name}` marks a variable. Regional names (stall, lane, mentor, customers…) are NOT
// here: they come from the region pack's `strings` and are passed in as variables. Part names and simulator explanations live in
// parts.en.ts and sim.en.ts (owned by the catalogue and the simulator) and are spread in below. Add a locale by copying this file
// and registering it in ../i18n.ts; `checkLocales` (see locales.test.ts) fails when a key or a placeholder is missing.
import { partsEn } from './parts.en';
import { simEn } from './sim.en';

export const en: Record<string, string> = {
  ...partsEn,
  ...simEn,
  // log lines
  'log.start': '{mentor} left you {stall} on {lane}. The bench is yours: open a ticket to begin.',
  // ticket actions
  'ticket.opened': 'Ticket {id} is open: {title}.',
  'ticket.closed': 'Ticket {id} is closed. Back at the counter.',
  'ticket.needId': 'openTicket needs a ticket id, for example 0-0.',
  'ticket.unknown': "There is no ticket '{id}'. Tickets you can open: {known}.",
  'ticket.alreadyOpen': 'Ticket {id} is already open. Close it before opening another.',
  'ticket.noneOpen': 'No ticket is open, so there is nothing to close.',
  // placeholder ticket and level (M0 only; replaced by the real tickets in M2)
  'ticket.0-0.title': 'Empty bench (placeholder)',
  'ticket.0-0.brief': '{customer} has nothing for you yet. {mentor} says to get the bench ready first. This ticket is a placeholder until the real tickets arrive.',
  'level.0-0.title': 'Empty bench (placeholder)',
  'level.0-0.brief': 'A placeholder ticket with an empty board. It cannot be passed yet.',
  // saves and descriptions
  'save.label.counter': 'At the counter · wallet {wallet} · tick {tick}',
  'save.label.ticket': 'Ticket {id} · wallet {wallet} · tick {tick}',
  'describe.counter': 'Tick {tick}: at the counter, no ticket open. Wallet {wallet}.',
  'describe.ticket': 'Tick {tick}: ticket {id} open with {parts} parts and {wires} wires. Wallet {wallet}.',
};
