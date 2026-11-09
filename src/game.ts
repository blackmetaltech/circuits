// The game definition the core engine runs. Everything the Godot front-end shows comes from queries; every player command is an
// action returning {ok, message} with a teaching message (an i18n key's English). M0 skeleton: only openTicket / closeTicket exist
// (against a placeholder ticket table); the rest of DESIGN §8.4 arrives with the board, bench and instruments in M1-M2.
import { baseState, fail, log, need, ok, type GameDef } from '@core/kit';
import { formatMinor } from './regions/data';
import { LEVELS } from './levels';
import { PERSONAS } from './personas';
import { t } from './i18n';
import { REGIONS } from './regions';
import { FAILURE_LOG_CAP, SCOPE_POINTS_CAP, UNDO_CAP, newNodeState, newTicketProgress, type Metrics, type NodeState } from './engine/state';
import { PLACEHOLDER_TICKETS, openTicketIn, ticketDef } from './engine/tickets';

export const GAME_ID = 'node-circuits';

/** A regional string the game needs; a pack that lacks one is a bug in the pack. */
function regionString(region: string, key: string): string {
  const v = REGIONS.get(region).strings[key];
  if (v === undefined) throw new Error(`Region '${region}' has no string '${key}'.`);
  return v;
}

const ZERO_METRICS: Metrics = { cost: 0, parts: 0, power: 0, area: 0 };
const wallet = (s: Readonly<NodeState>): string => formatMinor(s.progress.wallet, REGIONS.get(s.region));

export const GAME: GameDef<NodeState> = {
  id: GAME_ID,
  title: 'NODE',
  saveVersion: 1,
  /** Game-wide rules version: part of every solution code's ruleset id. Bump when a rule change can change a level score. */
  rulesetVersion: 1,
  regions: REGIONS,
  /** Keep the log short: it is part of the state (64 KB budget, state.size.test.ts). */
  logCap: 60,
  /** Level scores for leaderboards (all four recorded on every pass, DESIGN §2.6). M0 stub: the last bench's metrics or zeros. */
  metrics: (s) => ({ ...(s.ticket?.lastBench?.metrics ?? ZERO_METRICS) }),
  newGame: (seed, mode, ctx) => {
    const s = newNodeState(baseState(GAME_ID, seed, mode, ctx.region.id));
    log(s, t('log.start', { mentor: regionString(ctx.region.id, 'mentor'), stall: regionString(ctx.region.id, 'stall'), lane: regionString(ctx.region.id, 'lane') }));
    return s;
  },
  /** Campaign meta state kept when a core level starts: all of it lives in `progress` (tickets, wallet, upgrades, reputation, codexSeen). */
  carryOver: (prev) => ({ progress: structuredClone(prev.progress) }),
  onLevelEnd: (s, outcome, level) => {
    const p = (s.progress.tickets[level.id] ??= newTicketProgress());
    p.attempts += 1;
    if (outcome === 'won') p.passed = true;
  },
  actions: {
    /** Open ticket `id` on the bench (inside the campaign state: `level` stays null). */
    openTicket: (s, id: unknown) => {
      need(typeof id === 'string' && id !== '', t('ticket.needId'));
      const def = ticketDef(id);
      if (!def) fail(t('ticket.unknown', { id: String(id), known: PLACEHOLDER_TICKETS.map((x) => x.id).join(', ') }));
      need(!s.ticket, t('ticket.alreadyOpen', { id: s.ticket?.id ?? '' }));
      openTicketIn(s, def.id);
      return ok(t('ticket.opened', { id: def.id, title: t(def.titleKey) }));
    },
    /** Close the open ticket and go back to the counter (the board is dropped; progress stays). */
    closeTicket: (s) => {
      need(s.ticket, t('ticket.noneOpen'));
      const id = s.ticket.id; s.ticket = null;
      return ok(t('ticket.closed', { id }));
    },
  },
  queries: {
    /** Campaign progress for the HUD and the chapter board; the wallet is also given formatted for the active region. */
    progress: (s) => {
      const { failureLog, ...rest } = s.progress;
      return { ...rest, failureCount: failureLog.length, walletText: wallet(s) };
    },
    /** The open ticket as a card: title, brief, customer, with the region's names. Null at the counter. */
    ticketCard: (s) => {
      if (!s.ticket) return null;
      const def = ticketDef(s.ticket.id)!;
      const customer = regionString(s.region, `customer.${def.customer}`), mentor = regionString(s.region, 'mentor');
      const stall = regionString(s.region, 'stall'), lane = regionString(s.region, 'lane');
      return { id: def.id, title: t(def.titleKey), brief: t(def.briefKey, { customer, mentor, stall, lane }), customerId: def.customer, customer, mentor, stall, lane };
    },
  },
  systems: [],
  catalogues: () => ({ caps: { undo: UNDO_CAP, failureLog: FAILURE_LOG_CAP, scopePoints: SCOPE_POINTS_CAP } }),
  levels: LEVELS,
  personas: PERSONAS,
  invariants: (s) => {
    const v: { rule: string; detail: string }[] = [];
    if (!Number.isInteger(s.progress.wallet)) v.push({ rule: 'wallet is integer minor units', detail: String(s.progress.wallet) });
    if (s.progress.failureLog.length > FAILURE_LOG_CAP) v.push({ rule: 'failure log over its cap', detail: String(s.progress.failureLog.length) });
    const tk = s.ticket;
    if (tk) {
      if (tk.undo.length > UNDO_CAP || tk.redo.length > UNDO_CAP) v.push({ rule: 'undo/redo over its cap', detail: `${tk.undo.length}/${tk.redo.length}` });
      if (tk.live.scope.ch1.length > SCOPE_POINTS_CAP || tk.live.scope.ch2.length > SCOPE_POINTS_CAP) v.push({ rule: 'scope buffer over its cap', detail: `${tk.live.scope.ch1.length}/${tk.live.scope.ch2.length}` });
    }
    return v;
  },
  validateSave: (s) => {
    const p = s?.progress;
    if (!p || typeof p !== 'object' || typeof p.tickets !== 'object' || !Number.isInteger(p.wallet)) return 'This save has no valid campaign progress block.';
    if (s.ticket !== null && (typeof s.ticket !== 'object' || typeof s.ticket.id !== 'string')) return 'This save has a damaged open ticket.';
    return null;
  },
  saveLabel: (s) => (s.ticket ? t('save.label.ticket', { id: s.ticket.id, wallet: wallet(s), tick: s.tick }) : t('save.label.counter', { wallet: wallet(s), tick: s.tick })),
  describe: (s) => (s.ticket
    ? t('describe.ticket', { tick: s.tick, id: s.ticket.id, parts: s.ticket.board.parts.length, wires: s.ticket.board.wires.length, wallet: wallet(s) })
    : t('describe.counter', { tick: s.tick, wallet: wallet(s) })),
  legalActions: () => [{ name: 'openTicket', args: ['0-0'] }, { name: 'closeTicket' }],
  /** What the UI receives after every act (DESIGN §8.3): slim, with no undo/redo stacks, no scope ring buffer and no failure log.
   *  Scope, nodes, currents and thermal come through queries. Depths and counts stand in for what is left out. */
  snapshot: (s) => {
    const { progress, ticket, levelActions: _la, log: lg, ...rest } = s as NodeState;
    const { failureLog, ...prog } = progress;
    let tk: unknown = null;
    if (ticket) {
      const { undo, redo, live, ...tr } = ticket; const { scope: _scope, ...liveSlim } = live;
      tk = { ...tr, live: liveSlim, undoDepth: undo.length, redoDepth: redo.length };
    }
    return { ...rest, log: lg.slice(-150), progress: { ...prog, failureCount: failureLog.length }, ticket: tk };
  },
};
