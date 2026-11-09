// NODE game state (DESIGN §8.3). Plain JSON only: the core engine clones it on every action, hashes it and saves it. No classes,
// Maps, typed arrays, functions or `undefined`-vs-missing tricks. Sub-types live here so the engine, the queries and the tests share them.
import type { BaseState } from '@core/kit';
import type { Board, Pad, PlacedPart, Wire } from '../sim/board/types';

// ---------- caps (DESIGN §8.3; state.size.test.ts proves they keep the state within 64 KB) ----------
/** Undo and redo stacks: at most this many entries each. */
export const UNDO_CAP = 40;
/** Undo and redo stacks: at most this many touched parts+wires in total per stack (a bulk edit like loadBoard is big; the oldest go first). */
export const UNDO_ITEM_BUDGET = 40;
/** progress.failureLog: oldest dropped. */
export const FAILURE_LOG_CAP = 200;
/** Scope ring buffer: points per channel. */
export const SCOPE_POINTS_CAP = 512;
/** MNA unknowns kept in `live.x`. */
export const LIVE_X_CAP = 48;

export type LevelId = string;
export type CustomerId = string;
export type UpgradeId = string;
export type PartUid = string;

/** The four recorded metrics of a pass (DESIGN §2.6, §11.1): all integers so client and server agree bit for bit. */
export interface Metrics {
  /** Sum of the pack's catalogue prices of the placed parts, in the pack currency's minor units (cents, paise). */
  cost: number;
  /** Placed components (wires, jumpers and fixed fixtures excluded). */
  parts: number;
  /** Mean power drawn from the ticket's supplies, µW, rounded to an integer (efficiency tickets add their own metric in M2). */
  power: number;
  /** Bounding box of parts and wires in pads², integer. */
  area: number;
}

/** Result of one bench run. M0 skeleton: the bench worker (M2) widens `specs`; `metrics` and `pass` are the contract. */
export interface BenchResult {
  pass: boolean;
  metrics: Metrics;
  /** One row per spec: the i18n key of its name, whether it passed and the margin (positive = inside the band). */
  specs: { key: string; pass: boolean; margin: number }[];
}

export interface TicketProgress {
  best: Metrics | null;
  stars: 0 | 1 | 2 | 3;
  passed: boolean;
  assisted: boolean;
  attempts: number;
  smokes: number;
  /** Solution code (kit/solution envelope) of the best pass. */
  bestCode: string | null;
}

/** A recorded smoke/failure with the data needed to explain it again later (explanations are keys + vars, never English). */
export interface FailureRecord {
  id: number;
  ticket: LevelId;
  tick: number;
  /** The explanation's i18n key (e.g. 'sim.smoke.overpower'); the part uid, if any, travels in `vars`. Kept this small on purpose: 200 of these are saved. */
  kind: string;
  vars: Record<string, string | number>;
}

export interface Probe { ch: 1 | 2; pad: Pad }

export interface MeterState {
  mode: 'off' | 'dcv' | 'dca' | 'ohm' | 'acv';
  pads: Pad[];
}

export interface SupplyState { on: boolean; v: number; ilim: number }
export interface GenState { shape: 'sine' | 'square' | 'triangle' | 'pulse'; f: number; vpp: number; offset: number; on: boolean }
export interface ScopeSettings {
  timePerDiv: number;
  voltsPerDiv: [number, number];
  trigger: { source: 1 | 2; level: number; edge: 'rise' | 'fall'; mode: 'auto' | 'normal' };
}
export interface BodeSettings { fStart: number; fStop: number; points: number }

/**
 * One undo/redo entry. It stores only what the edit touched: the version each touched part/wire had BEFORE the edit (null = it did
 * not exist). Applying it to the current board restores the board as it was, and the entry that undoes the undo goes on the other
 * stack. (Full board copies cannot meet the 64 KB budget with 2 × 40 entries; see state.size.test.ts.)
 */
export interface BoardSnapshot {
  /** Short action key, for the "Undo: move" tooltip. */
  key: string;
  parts: Record<PartUid, PlacedPart | null>;
  wires: Record<string, Wire | null>;
}

export type TicketBoard = Board & { probes: Probe[]; meter: MeterState };

export interface LiveState {
  powered: boolean;
  frame: number;
  /** Sim seconds. */
  t: number;
  /** MNA unknowns at the last accepted step (<= LIVE_X_CAP numbers). */
  x: number[];
  /** Companion history (capacitor currents, inductor voltages). */
  hist: number[];
  temps: Record<PartUid, number>;
  smoked: PartUid[];
  status: 'ok' | 'float' | 'noconv' | 'loop';
  /** Decimated ring buffer, <= SCOPE_POINTS_CAP points per channel. */
  scope: { ch1: number[]; ch2: number[]; t0: number; dt: number };
}

export interface TicketState {
  id: LevelId;
  /** Seeded hidden params (encore / engineer); Learner uses the level's fixed values. */
  hidden: Record<string, number>;
  board: TicketBoard;
  instruments: { supply: SupplyState; gen: GenState; scope: ScopeSettings; bode: BodeSettings | null };
  live: LiveState;
  undo: BoardSnapshot[];
  redo: BoardSnapshot[];
  predictions: Record<string, number>;
  lastBench: BenchResult | null;
  tolerance: { done: number; total: number; failures: number } | null;
}

export interface NodeProgress {
  tickets: Record<LevelId, TicketProgress>;
  /** Integer minor units of the pack currency (cents, paise): no float money. */
  wallet: number;
  upgrades: UpgradeId[];
  reputation: Record<CustomerId, number>;
  codexSeen: string[];
  /** Capped at FAILURE_LOG_CAP, oldest dropped. */
  failureLog: FailureRecord[];
}

export interface NodeState extends BaseState {
  progress: NodeProgress;
  /** The open ticket, or null at the stall counter. Opened inside the campaign state; `level` stays null (DESIGN §8.3). */
  ticket: TicketState | null;
}

// ---------- constructors ----------
export const newMeter = (): MeterState => ({ mode: 'off', pads: [] });
export const newSupply = (): SupplyState => ({ on: false, v: 0, ilim: 0.1 });
export const newGen = (): GenState => ({ shape: 'sine', f: 1000, vpp: 1, offset: 0, on: false });
export const newScope = (): ScopeSettings => ({ timePerDiv: 1e-3, voltsPerDiv: [1, 1], trigger: { source: 1, level: 0, edge: 'rise', mode: 'auto' } });
export const newLive = (): LiveState => ({ powered: false, frame: 0, t: 0, x: [], hist: [], temps: {}, smoked: [], status: 'ok', scope: { ch1: [], ch2: [], t0: 0, dt: 0 } });
export const newTicketProgress = (): TicketProgress => ({ best: null, stars: 0, passed: false, assisted: false, attempts: 0, smokes: 0, bestCode: null });
export const newProgress = (): NodeProgress => ({ tickets: {}, wallet: 0, upgrades: [], reputation: {}, codexSeen: [], failureLog: [] });

/** A freshly opened ticket on `board` (a deep copy is taken, so the level table is never aliased into the state). */
export function newTicketState(id: LevelId, board: Board): TicketState {
  const b = structuredClone(board);
  return {
    id, hidden: {}, board: { ...b, probes: [], meter: newMeter() },
    instruments: { supply: newSupply(), gen: newGen(), scope: newScope(), bode: null },
    live: newLive(), undo: [], redo: [], predictions: {}, lastBench: null, tolerance: null,
  };
}

/** The campaign state on top of a core `baseState(...)`: empty progress, no ticket open. */
export function newNodeState(base: BaseState): NodeState {
  return { ...base, progress: newProgress(), ticket: null };
}

// ---------- capped mutators (the only way the engine appends to a capped list) ----------
const items = (e: BoardSnapshot): number => Object.keys(e.parts).length + Object.keys(e.wires).length;

/** Push an undo/redo entry, then drop the oldest while the stack exceeds UNDO_CAP entries or UNDO_ITEM_BUDGET touched items (the newest entry always stays). */
export function pushUndo(stack: BoardSnapshot[], e: BoardSnapshot): void {
  stack.push(e);
  let total = 0; for (const x of stack) total += items(x);
  while (stack.length > 1 && (stack.length > UNDO_CAP || total > UNDO_ITEM_BUDGET)) total -= items(stack.shift()!);
}

export function pushFailure(p: NodeProgress, r: FailureRecord): void {
  p.failureLog.push(r);
  if (p.failureLog.length > FAILURE_LOG_CAP) p.failureLog.splice(0, p.failureLog.length - FAILURE_LOG_CAP);
}

/** Scope samples are stored to 1e-5 (10 µV, far below one pixel of any scope setting) so the ring buffer stays small and the state hash is stable. Non-finite -> 0. */
export const quantiseSample = (v: number): number => (Number.isFinite(v) ? Math.round(v * 1e5) / 1e5 : 0);

export function pushScope(scope: LiveState['scope'], ch: 1 | 2, v: number): void {
  const a = ch === 1 ? scope.ch1 : scope.ch2;
  a.push(v);
  if (a.length > SCOPE_POINTS_CAP) a.splice(0, a.length - SCOPE_POINTS_CAP);
}
