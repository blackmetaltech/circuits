// Ticket (level) definition: DATA ONLY (DESIGN §2.9, §8.3). Adding a ticket is adding one file `src/data/levels/<id>.ts` that exports a
// `LevelDef` and listing it in `index.ts`; no engine code changes. The engine turns each def into a campaign ticket (openTicket) AND a core
// `Level` (levels.ts) from the same data, so checkAllLevels exercises exactly the campaign code path.
// Plain JSON except nothing: everything here is numbers, strings, arrays and records (it is hashed into solution-code rulesets later).
import type { Board, Connector, Pad, PlacedPart, Wire } from '../../sim/board/types';
import type { BenchSpec } from '../../sim/bench/types';

export type MetricId = 'cost' | 'parts' | 'power' | 'area' | 'accuracy';

/** One line of the parts bin. `values` is an explicit SI list or an E-series name (filtered to the part's catalogue values); `variants` limits ratings/packages. */
export interface BinEntry {
  partId: string;
  values?: number[] | 'E12' | 'E24';
  /** Variant ids the ticket offers (default: every variant of the part). */
  variants?: string[];
  /** Most copies of this part the board may hold (default: no limit beyond constraints.maxParts). */
  max?: number;
}

/** A source the BENCH provides (not a placed part): the bench supply or the function generator, wired to connectors. */
export type SupplyDef =
  /** `fixed`: a rail the board offers at a set voltage (3-3's 12 V and 24 V rails); the supply keys do not move it. */
  | { id: string; kind: 'bench'; plus: string; minus: string; fixed?: number }
  /** A bench-driven contact between two connectors (chapter 3): the bouncing arcade button of 3-2 (`press` / `release` seconds, `bounce` = one pattern per condition: the open / close times, s after the first contact),
   *  or a plain switch that closes once (`bounce` absent) at `press` (3-4's charge-sharing switch). */
  | { id: string; kind: 'contact'; plus: string; minus: string; press: number; release?: number; bounce?: number[][]; ron?: number }
  | { id: string; kind: 'gen'; plus: string; minus: string; rOut?: number }
  /** Chapter 4: the wall socket behind an ISOLATION TRANSFORMER (simulated mains: a sine of `vrms` volts rms and `f` Hz between the two connectors, floating: only a 100 Mohm insulation resistance ties it to ground). A condition or a selector
   *  sets `vrms` (key 'vrms') to the pack's low / nominal / high mains. */
  | { id: string; kind: 'mains'; plus: string; minus: string; vrms: number; f: number };

/** A live switch on the bench (chapter 4): a few positions, each a set of overrides exactly like a bench condition (the mains tolerance, the load). The bench plan still lists every condition it runs; the selector only chooses what the LIVE view shows. */
export interface SelectorDef {
  id: string;
  /** i18n key of the switch's name ("MAINS", "LOAD"). */
  labelKey: string;
  options: { labelKey: string; set: { target: string; key: string; value: number }[] }[];
  /** Index of the position the ticket starts on. */
  initial: number;
}

/** A parameter the player must find by measuring. Learner uses `learner`; Engineer and Sandbox draw from `seeded` (deterministic, from the save seed). */
export interface HiddenDef {
  id: string;
  /** Part uid (a fixed part, e.g. 'f1') or supply id the value applies to. */
  target: string;
  /** Element parameter ('r', 'emf', 'v', 'ilim'...). */
  key: string;
  learner: number;
  seeded: [number, number];
}

/** A bench condition: parameter overrides and ambient temperature; every spec must pass in every condition. */
export interface Condition {
  id: string;
  /** Overrides on element parameters, plus `key: 'pos'` on a fixed slide wire / pot (the jockey or wiper position 0..1 for this condition). */
  set?: { target: string; key: string; value: number }[];
  ambientC?: number;
}

export interface BenchPlan {
  /** Transient base step, s. */
  h: number;
  settle?: number | 'periodic';
  window?: number;
  period?: number;
  measurePeriods?: number;
  maxPeriods?: number;
  ic?: 'zero' | 'op';
  conditions: Condition[];
  /** Specs. Probes may use part tokens: `i(@led-red-5mm#1)` = current of the first placed LED, `v(@led-red-5mm#1.A,@led-red-5mm#1.K)` = across its pins. */
  specs: BenchSpec[];
  /** spec id -> i18n key of its name (shown on the ticket card and in the bench report). */
  names: Record<string, string>;
  ambientC: number;
  /** Bench-only test loads (chapter 2): a resistor from node `a` to node `b` (connector names, `0` = GND, or a part pin written `@partId#n.PIN`) that exists ONLY in the formal bench run, never in the live view. A condition's `set`
   *  overrides its `r` (`{ target: <id>, key: 'r', value }`): 'the 100 ohm test load', 'the shunt'. */
  testLoads?: { id: string; a: string; b: string; r: number }[];
  /** Chapter 4 (4-3): the linear regulator's internal thermal shutdown runs on a compressed clock: its time constant is this many SECONDS for a bare TO-220 (a sink variant keeps its ratio), so cycling fits a bench window and a scope sweep. */
  regTau?: number;
  /** Chapter 4 (4-3): the junction limit the ratings check applies to semiconductors (deg C), tighter than the part's own maximum ("Tj <= 125 C at Ta = 40 C"). */
  tjLimit?: number;
}

/** Tiny expression language for hint numbers computed from the live solver (DESIGN §7.2 rung 2). */
export type HintExpr = number | { probe: string } | { op: 'add' | 'sub' | 'mul' | 'div'; a: HintExpr; b: HintExpr };
export interface HintDef {
  /** Rung 1 (nudge): i18n key. */
  nudge: string;
  /** Rung 2: i18n key and the numbers its placeholders get. */
  equation?: { key: string; vars: Record<string, HintExpr> };
}

/** Where Wren's hand-drawn arrow points. The query resolves it to a uid / pad on the live board (`coach` in API-CH1.md). */
export type CoachAnchor =
  | { target: 'bin'; partId: string }
  | { target: 'part'; partId: string; pin?: string }
  | { target: 'connector'; connector: string }
  | { target: 'power' | 'scope' | 'dmm' | 'bench' | 'chit' | 'notebook' | 'jockey' | 'supplyv' };

/**
 * One coach step (DESIGN §7.1). Steps advance on ENGINE conditions, never timers. A step is the active one when `when` holds (default: always) and
 * `done` does not, scanning in order. Conditions are `&`-joined atoms, `!` negates: `always`, `part:<partId>` (one is on the board), `wired` (every placed
 * part has every pin on a node shared with another pin or a connector), `powered`, `flowing` (powered and solved), `smoked`, `benched` (a bench run is on record),
 * `passed` (the last bench passed), `failed`, `probing` (a scope probe or the DMM is attached), `measured` (the DMM shows a reading), `joined:<connector>` (a part leg is on that connector's node), `probed` (the meter leads or scope clip have been on the board at least once), `predicted` (every prediction is entered), `answered` (every answer of `answers` is entered), `jockey` (a fixed slide wire's jockey has been set), `shorted` (the DMM is on its mA range with both leads placed), `supplyset` (the bench supply voltage was changed from the ticket's start value).
 */
export interface CoachStep {
  id: string; key: string; anchor: CoachAnchor; done: string; when?: string;
  /** A measuring step that is not needed to pass: it never holds the coach back; Wren offers it as "Optional: ..." next to the active step. */
  optional?: boolean;
}

/** The one quantity the scope's amber band is drawn for (DESIGN §5.3): a bench spec of kind `level`, shown in `unit` (V, A or W). */
export interface GaugeDef {
  /** Spec id (a `level` spec in `bench.specs`). */
  spec: string;
  unit: 'V' | 'A' | 'W' | 'uA';
  /** Show the magnitude (a null detector: the needle either side of zero is the same distance from the target). */
  abs?: boolean;
  /** Connector id to clip CH1 on when the spec is a node voltage (the arrow's target); the trace then comes from the real probe. */
  clip?: string;
  /** The spec quantity is a source's terminal current / power (negative when it delivers): show its magnitude. */
  flip?: boolean;
}

/** The printed exam figure of an exam-bridge ticket (DESIGN §2.5: the one place a schematic is allowed): sources, each through its own resistor, meet at a named node; a load resistor runs to ground. */
export interface ExamFigure {
  /** 'node' (default): the 1-5 nodal figure. 'pot': the 2-4 slide-wire potentiometer figure. 'caps': the 3-4 capacitor cards. */
  kind?: 'node' | 'pot' | 'caps' | 'zener';
  /** Name of the common node (printed on the figure). */
  node: string;
  sources: { name: string; volts: number; r: { name: string; ohm: number } }[];
  load: { name: string; ohm: number };
  /** kind 'pot': the printed problem (driver cell, rheostat, wire, the two balance lengths, the shunt). */
  pot?: { driverV: number; rheostat: number; wireCm: number; wireOhm: number; l1Cm: number; l2Cm: number; shunt: number };
  /** kind 'caps': card (a) a series / parallel bank across a source, card (b) a charged capacitor shared with an empty one. Capacitances in microfarads, voltages in volts. */
  caps?: { a: { c1: number; c2: number; c3: number; volts: number }; b: { c1: number; v1: number; c2: number } };
  /** kind 'zener': the 4-5 card: a source behind a series resistor, a Zener of `vz` volts with a minimum current, a load. */
  zener?: { volts: number; rs: number; vz: number; izMin: number; rl: number };
}

/** A number the player works out and enters on the ticket's slip (ticket 2-2: the distance to the fault). Checked by the bench against a hidden parameter: truth = hidden[`hidden`] / `per`, within `tol`. */
export interface AnswerDef {
  id: string;
  /** Hidden parameter id the truth comes from (the cable's loop resistance X). */
  hidden: string;
  /** truth = hidden / per (0.1 ohm per metre). */
  per: number;
  /** Fractional tolerance (0.01 = 1 %). */
  tol: number;
  unit: string;
  /** Slide wire part uid ('f3') and the resistance-box value sum named in the failure text: R and l come from the board. */
  wire: string;
}

/** The amber target of a time trace (DESIGN §3.12 `band`, §5.3): a tube in time and voltage. All numbers SI (s, V or A). */
export type TubeDef =
  /** A charging curve v0 -> vInf with time constant tau; the tube is +-dv in value and +-dt in time around it (the Minkowski tube of band.ts). */
  | { kind: 'exp'; v0: number; vInf: number; tau: number; dv: number; dt: number }
  /** Allowed windows: in [t0, t1) the trace must stay between lo and hi (a gate the signal has to pass through, 3-2 and 3-3). Outside every window the trace is free. */
  | { kind: 'windows'; windows: { t0: number; t1: number; lo: number; hi: number }[] };

/** Chapter 3: the scope shows a TIME TRACE of the transient from power-on (one single sweep that forms and holds), against a tube; LOCK means the whole sweep sits in the tube and the listed specs hold. */
export interface TraceDef {
  /** The bench probe the trace shows (`v(out)`, `i(@relay-12v#1)`). */
  probe: string;
  /** 'clip': the CH1 clip's own node (a real probe: its 10 Mohm loads the circuit, which is the 3-1 lesson); 'auto': a built-in clamp on `probe` (the coil current of 3-3). */
  mode: 'clip' | 'auto';
  /** Display unit and its scale from SI ('V' 1, 'mA' 1000). */
  unit: 'V' | 'mA'; scale: number;
  /** Connector the clip belongs on (the arrow's target; clip mode). */
  clip?: string;
  /** Default vertical scale, display units per division. */
  vdiv: number;
  tube: TubeDef;
  /** Bench `metric` / `level` spec ids that must also hold on the captured sweep for LOCK (their probe is this trace). */
  lockSpecs: string[];
  /** The scope's time knob values (s per division), ascending; the first one is the default shown. */
  times: number[];
  /** Short readout label ("OUT", "COIL"). */
  label: string;
  /** Chapter 4 (4-1): a second, built-in channel drawn in amber under CH1 (the isolated transformer's secondary, a differential probe: the `second.probe` expression, label `second.label`). */
  second?: { probe: string; label: string };
  /** Chapter 4: lockSpecs are measured only on the part of the sweep from this time on (the capacitor has charged: the ripple is a steady-state number). */
  settleFrom?: number;
  /** Chapter 4: transient step of the live run, s (default: the sweep's own frame length / 4). */
  h?: number;
  /** Chapter 4: the VOLTS knob steps through exactly this list (V per division), the first entry is the default; and CH1 may be AC coupled (the engine gives `trace.dc` so the ripple can be read at 0.2 V per division). */
  vdivs?: number[];
  ac?: boolean;
  /** The ripple allowance (V peak to peak) the AC-coupled scope draws as its band about the middle line. */
  acBand?: number;
  /** RC / LR tickets: the scope draws a dashed level at 63.2 % of the final value (one time constant) and, once the sweep is in, a cursor at the time the trace crosses it. */
  mark63?: boolean;
}

export interface LevelDef {
  id: string;
  chapter: number;
  titleKey: string;
  briefKey: string;
  /** Region-pack customer id (strings `customer.<id>`). */
  customer: string;
  teaches: string[];
  board: { w: number; h: number; connectors: Connector[]; /** Chapter 4: the keep-out rectangles of the mains section (HIGH VOLTAGE, hatched red). */ keepOut?: { x: number; y: number; w: number; h: number }[] };
  /** Pre-placed, non-removable parts (battery, load, transformer). Their uids are fixed by the level ('f1', 'f2'...) and must have `fixed: true`. */
  fixed: PlacedPart[];
  /** Pre-wired, non-removable wires (paths of pads), uids fw1, fw2...: e.g. the exam's source minus ends tied to the GND pad. */
  fixedWires?: Pad[][];
  /** Bench-provided sources (bench supply, function generator). Batteries are fixed parts instead. */
  supplies: SupplyDef[];
  /** Initial instrument settings. A bench supply / generator / scope the ticket does not mention stays unusable. */
  instruments: {
    supply?: { v: number; ilim: number };
    gen?: { shape: 'sine' | 'square' | 'triangle' | 'pulse'; f: number; vpp: number; offset: number };
    scope?: { timePerDiv: number; voltsPerDiv: [number, number] };
  };
  bin: BinEntry[];
  constraints?: { maxParts?: number; forbid?: string[] };
  bench: BenchPlan;
  /** Live frame: `frameSim` sim seconds per frame at base step `h`; thermal runs `thermalSpeed` times faster than wall time (30 frames/s). */
  live: { frameSim: number; h: number; thermalSpeed: number };
  hidden?: HiddenDef[];
  stars: { head: MetricId; par: Record<Exclude<MetricId, 'accuracy'>, number> & { accuracy?: number } };
  hints?: HintDef;
  /** Reference solution the expert persona replays: parts in placement order (uids are assigned p1, p2... in that order) and wires. */
  ref: {
    parts: Omit<PlacedPart, 'uid'>[]; wires: Pad[][];
    /** Exam-bridge predictions (and answers) the expert enters (id -> value). */ predictions?: Record<string, number>;
    /** Jockey positions (mm from end A) of FIXED slide wires, by part uid ('f3'). */ jockeys?: Record<string, number>;
    /** Bench supply setting the expert uses (the ticket lets the player set it). */ supply?: { v: number; ilim: number };
  };
  scope: 'must' | 'stretch';
  /** Payment in the pack currency's minor units: `fee` on the first pass plus `perStar` for every star earned for the first time (estimates: game values). */
  pay?: { fee: number; perStar: number };
  coach?: CoachStep[];
  /** The player's own bench button refuses until the meter or scope has been used at least once (measuring is the lesson: 1-4). */
  measureFirst?: boolean;
  /** i18n key of the refusal when `measureFirst` is unmet (default 'bench.measureFirst', the 1-4 text). */
  measureFirstKey?: string;
  gauge?: GaugeDef;
  /** A null-detector ticket (2-2, 2-4): the slide wire `wire` (fixed part uid) is swept end to end on a copy of the board; a bench pass needs a real sign change of the gauge probe
   * (a dead bridge reads about zero everywhere and must not pass). `faults` are tried in order for the diagnosis: `need` are coach atoms `link:a~b` / `shared:ref`; the first unmet one names the fault (key + `where`). */
  nullCheck?: { wire: string; faults: { key: string; need: string[] }[] };
  /** Exam-bridge ticket (printed exam card, predict then probe). */
  eb?: boolean;
  /** The exam figure drawn on the problem slip (exam-bridge tickets). */
  figure?: ExamFigure;
  /** Numbers the player enters on the slip and the bench checks against the hidden truth (2-2). */
  answers?: AnswerDef[];
  /** i18n key of the one-line spec printed on the ticket chit (chapter 2: the scope band is a null or a match, not a range). */
  specShort?: string;
  /** Plain-words explainer for a missed level spec: 'divider' (2-1, the load on the bottom resistor). */
  explain?: 'divider' | 'bridge' | 'blackbox' | 'pot' | 'rc' | 'debounce' | 'coil' | 'caps' | 'rectifier' | 'zener' | 'regulator' | 'lm317' | 'zenerexam';
  /** Chapter 3: the scope's time trace and its tube (see TraceDef). */
  trace?: TraceDef;
  /** Engraved slots on the board where a bin part belongs (2-2, 2-4): a clear outlined spot between two pads, shown until a part of `partId` is placed. */
  slots?: { id: string; partId: string; a: Pad; b: Pad; textKey: string }[];
  /** The customer's thank-you quotes what the bench measured: `spec` is a `level` spec; the exact line when within `within` (fraction) of `target`, the near line otherwise. */
  thanks?: { spec: string; target: number; within: number; exactKey: string; nearKey: string };
  /** Chapter 4: a mains ticket (4-1). It opens with the safety card (first view: not skippable), the isolation transformer stands on the bench and the Bench Card carries the "do not try this at home" ribbon. */
  mains?: boolean;
  /** Chapter 4: live switches (mains tolerance, load): what the live view shows; the bench plan runs every condition itself. */
  selectors?: SelectorDef[];
  /** Where the ticket's chit hangs on the chapter-1 notebook page, in 0..1 page coordinates. */
  chit?: { x: number; y: number };
  /** Chapter-1 tickets of the vertical slice etc.; a ticket unlocks when every id here is passed (empty = open). */
  after?: string[];
}

export type { Board, Wire };
