// The game definition the core engine runs. Everything the Godot front-end shows comes from queries; every player command is an
// action returning {ok, message} with a teaching message (an i18n key's English). The campaign uses `openTicket` inside the campaign
// state (`level` stays null); the same ticket data is registered as core Levels (levels.ts) so the core harness exercises the campaign
// code path. `makeGame(defs)` builds the game from a ticket table so tests can add a ticket without touching the shipped table.
import { baseState, log, type GameDef } from '@core/kit';
import { formatMinor } from './regions/data';
import { LEVEL_DEFS, type LevelDef } from './data/levels';
import { makePersonas } from './personas';
import { coreLevels } from './levels';
import { t } from './i18n';
import { REGIONS } from './regions';
import { FAILURE_LOG_CAP, SCOPE_POINTS_CAP, UNDO_CAP, newNodeState, newTicketProgress, type Metrics, type NodeState } from './engine/state';
import { makeActions } from './engine/actions';
import { candidateActions, makeQueries } from './engine/queries';

export const GAME_ID = 'node-circuits';

/** A regional string the game needs; a pack that lacks one is a bug in the pack. */
function regionString(region: string, key: string): string {
  const v = REGIONS.get(region).strings[key];
  if (v === undefined) throw new Error(`Region '${region}' has no string '${key}'.`);
  return v;
}

const ZERO_METRICS: Metrics = { cost: 0, parts: 0, power: 0, area: 0 };
const wallet = (s: Readonly<NodeState>): string => formatMinor(s.progress.wallet, REGIONS.get(s.region));

export function makeGame(defs: readonly LevelDef[]): GameDef<NodeState> {
  return {
    id: GAME_ID,
    title: 'NODE',
    saveVersion: 1,
    /** Game-wide rules version: part of every solution code's ruleset id. Bump when a rule change can change a level score. */
    rulesetVersion: 1,
    regions: REGIONS,
    /** Keep the log short: it is part of the state (64 KB budget, state.size.test.ts). */
    logCap: 60,
    /** Level scores for leaderboards (all four recorded on every pass, DESIGN §2.6): the last bench's metrics or zeros. */
    metrics: (s) => ({ ...(s.ticket?.lastBench?.metrics ?? ZERO_METRICS) }),
    newGame: (seed, mode, ctx) => {
      const s = newNodeState(baseState(GAME_ID, seed, mode, ctx.region.id));
      log(s, t('log.start', { mentor: regionString(ctx.region.id, 'mentor'), stall: regionString(ctx.region.id, 'stall'), lane: regionString(ctx.region.id, 'lane') }));
      return s;
    },
    /** Campaign meta state kept when a core level starts: all of it lives in `progress` (tickets, wallet, upgrades, reputation, codexSeen). */
    carryOver: (prev) => ({ progress: structuredClone(prev.progress) }),
    /** Bench runs record attempts and stars themselves (the same code path for campaign and core levels); here only the win is marked. */
    onLevelEnd: (s, outcome, level) => {
      const p = (s.progress.tickets[level.id] ??= newTicketProgress());
      if (outcome === 'won') p.passed = true;
    },
    actions: makeActions(defs),
    queries: makeQueries(defs),
    systems: [],
    catalogues: () => ({ caps: { undo: UNDO_CAP, failureLog: FAILURE_LOG_CAP, scopePoints: SCOPE_POINTS_CAP } }),
    levels: coreLevels(defs),
    personas: makePersonas(defs),
    invariants: (s) => {
      const v: { rule: string; detail: string }[] = [];
      if (!Number.isInteger(s.progress.wallet)) v.push({ rule: 'wallet is integer minor units', detail: String(s.progress.wallet) });
      if (s.progress.failureLog.length > FAILURE_LOG_CAP) v.push({ rule: 'failure log over its cap', detail: String(s.progress.failureLog.length) });
      const tk = s.ticket;
      if (tk) {
        if (tk.undo.length > UNDO_CAP || tk.redo.length > UNDO_CAP) v.push({ rule: 'undo/redo over its cap', detail: `${tk.undo.length}/${tk.redo.length}` });
        if (tk.live.scope.ch1.length > SCOPE_POINTS_CAP || tk.live.scope.ch2.length > SCOPE_POINTS_CAP) v.push({ rule: 'scope buffer over its cap', detail: `${tk.live.scope.ch1.length}/${tk.live.scope.ch2.length}` });
        const uids = tk.board.parts.map((p) => p.uid);
        if (new Set(uids).size !== uids.length) v.push({ rule: 'duplicate part uid', detail: uids.join(',') });
        const wids = tk.board.wires.map((w) => w.wid);
        if (new Set(wids).size !== wids.length) v.push({ rule: 'duplicate wire id', detail: wids.join(',') });
        for (const u of tk.live.smoked) if (!uids.includes(u)) v.push({ rule: 'smoked part is not on the board', detail: u });
        if (JSON.stringify(s).length > 64 * 1024) v.push({ rule: 'state over the 64 KB budget', detail: String(JSON.stringify(s).length) });
      }
      return v;
    },
    validateSave: (s) => {
      const p = s?.progress;
      if (!p || typeof p !== 'object' || typeof p.tickets !== 'object' || !Number.isInteger(p.wallet)) return t('save.noProgress');
      if (s.ticket !== null && (typeof s.ticket !== 'object' || typeof s.ticket.id !== 'string' || !defs.some((d) => d.id === s.ticket.id))) return t('save.badTicket');
      return null;
    },
    saveLabel: (s) => (s.ticket ? t('save.label.ticket', { id: s.ticket.id, wallet: wallet(s), tick: s.tick }) : t('save.label.counter', { wallet: wallet(s), tick: s.tick })),
    describe: (s) => (s.ticket
      ? t('describe.ticket', { tick: s.tick, id: s.ticket.id, parts: s.ticket.board.parts.length, wires: s.ticket.board.wires.length, wallet: wallet(s) })
      : t('describe.counter', { tick: s.tick, wallet: wallet(s) })),
    legalActions: (s, full) => candidateActions(s, defs, full),
    /** What the UI receives after every act (DESIGN §8.3): slim, with no undo/redo stacks, no scope ring buffer and no failure log.
     *  Scope, nodes, currents and thermal come through queries. Depths and counts stand in for what is left out. */
    snapshot: (s) => {
      const { progress, ticket, levelActions: _la, log: lg, ...rest } = s as NodeState;
      const { failureLog, ...prog } = progress;
      let tk: unknown = null;
      if (ticket) {
        const { undo, redo, live, hidden: _hidden, ...tr } = ticket; const { scope, x: _x, hist: _h, ...liveSlim } = live;
        tk = { ...tr, live: { ...liveSlim, scopeLen: scope.ch1.length }, undoDepth: undo.length, redoDepth: redo.length };
      }
      return { ...rest, log: lg.slice(-150), progress: { ...prog, failureCount: failureLog.length }, ticket: tk };
    },
  };
}

export const GAME: GameDef<NodeState> = makeGame(LEVEL_DEFS);
