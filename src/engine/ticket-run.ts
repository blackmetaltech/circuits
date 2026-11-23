// Everything the actions and queries share about a running ticket: lookups, the live rig, the bench run, hints. Engine layer: may use state.
import { findPart } from '../data/parts';
import type { LevelDef } from '../data/levels/types';
import type { Board } from '../sim/board/types';
import { buildRig, type Rig, type RigOverride } from '../sim/rig';
import { runTicketBench } from '../sim/bench/ticket';
import { makeProbe } from '../sim/mna/tran';
import { solveOp } from '../sim/mna/op';
import { sig } from '../sim/explain';
import { say } from './text';
import { BENCH_FAILURE_CAP, SCOPE_POINTS_CAP, LIVE_HIST_CAP, LIVE_X_CAP, type BenchResult, type NodeState, type TicketState } from './state';
import type { LiveCfg } from '../sim/live';
import { newScope } from './state';
import { REGIONS } from '../regions';
import { hashOf } from '@core/kit/hash';
import { boardMetrics } from './metrics';
import { refBoard } from './tickets';
import { getDef } from './board';
import type { HintExpr } from '../data/levels/types';
import { bridgeFault, rSide, refs, scanBridge, type BridgeScan } from './nullcheck';

/** Names of the specs every ticket has implicitly (the always-on ratings check). */
const IMPLICIT_SPEC: Record<string, string> = { ratings: 'bench.spec.ratings' };

export const hiddenOverrides = (def: LevelDef, tk: TicketState): RigOverride[] =>
  (def.hidden ?? []).filter((h) => tk.hidden[h.id] !== undefined).map((h) => ({ target: h.target, key: h.key, value: tk.hidden[h.id]! }));

/** The overrides of the live switches (chapter 4: the mains tolerance, the load): each selector's current position is a bench condition's `set`. */
export const selectorOverrides = (def: LevelDef, tk: TicketState): RigOverride[] =>
  (def.selectors ?? []).flatMap((sd) => (sd.options[tk.sel?.[sd.id] ?? sd.initial]?.set ?? []).map((o) => ({ target: o.target, key: o.key, value: o.value })));

/** The live circuit: board + bench sources + scope probes + DMM + hidden parameters + smoked parts. */
export function liveRig(tk: TicketState, def: LevelDef): Rig {
  // 0.6 condition dial: the chosen test condition's settings ride on top of the selectors (and its ambient, if it has one)
  const lc = tk.liveCond ? def.bench.conditions.find((c) => c.id === tk.liveCond) : undefined;
  const rig = buildRig({
    board: tk.board, getDef, supplies: def.supplies, supply: tk.instruments.supply, gen: tk.instruments.gen,
    overrides: [...hiddenOverrides(def, tk), ...selectorOverrides(def, tk), ...(lc?.set ?? [])], smoked: tk.live.smoked, ambientC: lc?.ambientC ?? def.bench.ambientC, instruments: true, regTau: def.bench.regTau, heat: def.bench.heat,
  });
  // a built-in clamp (3-3's coil current): CH1 shows the trace's own probe whether or not the clip is on the board
  if (def.trace?.mode === 'auto' && rig.circuit) { const r = rig.resolve(def.trace.probe); if (r !== null) rig.scope = [r, rig.scope[1]]; }
  // chapter 4: the isolated transformer's secondary is CH2 (a built-in differential probe)
  if (def.trace?.second && rig.circuit) { const r = rig.resolve(def.trace.second.probe); if (r !== null) rig.scope = [rig.scope[0], r]; }
  return rig;
}

/** A single-sweep ticket paces itself by its screen: one sweep is SWEEP_FRAMES frames of play (about three seconds), whatever the time knob says. */
export const SWEEP_FRAMES = 100, SWEEP_STEPS = 4;
export function liveCfg(tk: TicketState, def: LevelDef): LiveCfg {
  const tpd = tk.instruments.scope.timePerDiv ?? newScope().timePerDiv, oneShot = !!def.trace;
  const frameSim = oneShot ? (10 * tpd) / SWEEP_FRAMES : def.live.frameSim;
  return {
    frameSim, h: oneShot ? (def.trace?.h ?? frameSim / SWEEP_STEPS) : def.live.h, thermalSpeed: def.live.thermalSpeed, ambientC: def.bench.ambientC,
    xCap: LIVE_X_CAP, histCap: LIVE_HIST_CAP, scopeCap: SCOPE_POINTS_CAP, timePerDiv: tpd, ic: def.bench.ic === 'op' ? 'op' : 'zero', oneShot,
  };
}
/** What a single sweep depends on: change any of it and the trace starts again from power-on. */
export const sweepKey = (tk: TicketState): string => hashOf({ p: tk.board.parts, w: tk.board.wires, pr: tk.board.probes, t: tk.instruments.scope.timePerDiv, v: tk.instruments.supply.v, s: tk.sel });

/** Run the pure bench for the open ticket (all conditions) and fold in cost / parts / power / area and the stars. */
/** A rating violation or smoke from the bench is shown as the explainable cause with the player's own numbers when the ratings check has one. */
function richer(f: { key: string; vars: Record<string, string | number> }, causes: readonly { key: string; vars: Record<string, string | number> }[]): { key: string; vars: Record<string, string | number> } {
  if (f.key === 'bench.rating.violation') return causes.find((c) => c.key.startsWith('rating.') && c.vars.part === f.vars.part && c.vars.what === f.vars.what) ?? f;
  if (f.key === 'bench.rating.smoked') return causes.find((c) => c.key.startsWith('smoke.') && c.vars.part === f.vars.part) ?? f;
  return f;
}

type BenchOut = { result: BenchResult; causes: { key: string; vars: Record<string, string | number> }[] };
/** The bench is a pure function of these inputs. Level search probes runBench on every turn, mostly on a board that has
 *  not changed since the last probe, so the same answer is reused instead of simulated again. Exact: the key holds every
 *  input the bench reads, and each caller gets its own deep copy. */
const benchMemo = new WeakMap<LevelDef, Map<string, BenchOut>>();
const BENCH_MEMO_CAP = 64;
export const benchKey = (s: NodeState, tk: TicketState): string =>
  hashOf({ r: s.region, b: tk.board, su: tk.instruments.supply, g: tk.instruments.gen, sm: tk.live.smoked, pr: tk.predictions, h: tk.hidden, sel: tk.sel ?? null });
export function benchTicket(s: NodeState, def: LevelDef): BenchOut {
  const key = benchKey(s, s.ticket!);
  let memo = benchMemo.get(def); if (!memo) benchMemo.set(def, (memo = new Map()));
  const hit = memo.get(key);
  if (hit) return structuredClone(hit);
  const out = benchTicketRaw(s, def);
  if (memo.size >= BENCH_MEMO_CAP) memo.delete(memo.keys().next().value!);
  memo.set(key, structuredClone(out));
  return out;
}
/** The bench without the memo (tests compare the two). */
export function benchTicketRaw(s: NodeState, def: LevelDef): BenchOut {
  const tk = s.ticket!;
  const out = runTicketBench({
    board: tk.board, getDef, supplies: def.supplies, plan: def.bench, hidden: hiddenOverrides(def, tk),
    supply: tk.instruments.supply, gen: tk.instruments.gen, smoked: tk.live.smoked, predictions: tk.predictions,
  });
  const metrics = boardMetrics(tk.board, REGIONS.get(s.region), out.supplyPowerW * 1e6);
  const failuresAll = [...out.failures], rowsAll = [...out.rows];
  let pass = out.pass;
  // a null-detector ticket needs a REAL null: a bridge whose galvanometer never changes sign (cell not across A-B, C not joined to the jockey) can read about zero by accident
  const sc = def.nullCheck ? bridgeScan(tk, def) : null, dead = !!sc && !sc.scan.hasNull;
  if (sc && dead) {
    pass = false;
    const how = sc.scan.kind === 'zero' ? say('bridge.dead.zero') : say(sc.scan.kind === 'pos' ? 'bridge.dead.pos' : 'bridge.dead.neg');
    failuresAll.unshift({ key: 'bench.bridge.dead', vars: { how, why: sc.fault || say('bridge.fault.generic') } });
    const row = rowsAll.find((r) => r.id === def.gauge?.spec); if (row) { row.pass = false; row.margin = Math.min(row.margin, 0); }
  }
  // numbers the player works out and enters (2-2: the distance to the fault), checked against the hidden truth; reported only once the circuit itself is right
  for (const a of def.answers ?? []) {
    const entered = tk.predictions[a.id], hv = tk.hidden[a.hidden] ?? def.hidden?.find((h) => h.id === a.hidden)?.learner ?? 0, truth = hv / a.per;
    if (entered === undefined) { rowsAll.push({ id: a.id, pass: false, margin: -1 }); if (out.pass) { failuresAll.push({ key: 'bench.answer.missing', vars: { id: a.id, unit: a.unit } }); pass = false; } continue; }
    const rel = Math.abs(entered - truth) / Math.max(Math.abs(truth), 1e-12), good = rel <= a.tol;
    metrics.accuracy = Math.round(rel * 1e6);
    rowsAll.push({ id: a.id, pass: good, margin: sig(a.tol - rel, 4) });
    if (!good && out.pass && !dead) {
      const rbox = tk.board.parts.filter((p) => p.partId === 'res-box' && p.value !== null).reduce((acc, p) => acc + (p.value ?? 0), 0);
      const wire = tk.board.parts.find((p) => p.uid === a.wire), d = wire ? getDef(wire.partId) : undefined, lCm = (wire?.pos ?? 0.5) * (d?.model.lengthM ?? 1) * 100;
      const side = rSide(tk.board, def, (uid, pin) => liveRig(tk, def).conn.pinNodes[uid]?.[pin] ?? -1), ok = lCm > 0 && lCm < 100;
      failuresAll.push({ key: 'bench.answer.fail', vars: { id: a.id, entered: String(sig(entered, 6)), unit: a.unit, tol: sig(a.tol * 100, 3), R: sig(rbox, 4), l: sig(lCm, 4), ratio: ok ? sig(side === 'left' ? (100 - lCm) / lCm : lCm / (100 - lCm), 4) : 0, formula: side === 'left' ? 'R × (100 − l) / l' : 'R × l / (100 − l)', side: say(side === 'left' ? 'bridge.side.left' : 'bridge.side.right') } });
      pass = false;
    }
  }
  let stars: 0 | 1 | 2 | 3 = !pass ? 0 : (metrics[def.stars.head] ?? Infinity) <= (def.stars.par[def.stars.head] ?? 0) ? 2 : 1;
  if (def.eb && pass) {
    // exam bridge (DESIGN §2.5), graded on the predictions: 1 star for a correct build, 2 when every prediction is within 5 %, 3 when every one is within 1 %
    const g = out.predictions;
    stars = (g.length > 0 && g.every((p) => p.grade === 'exact') ? 3 : g.length > 0 && g.every((p) => p.grade !== 'miss') ? 2 : 1) as 1 | 2 | 3;
  }
  const result: BenchResult = {
    pass, metrics,
    specs: rowsAll.map((r) => ({ id: r.id, key: def.bench.names[r.id] ?? IMPLICIT_SPEC[r.id] ?? 'bench.spec.other', pass: r.pass, margin: Number.isFinite(r.margin) ? sig(r.margin, 4) : 0 })),
    failures: failuresAll.map((f) => richer(f, out.causes)).sort((a, b) => Number(b.key.startsWith('smoke.')) - Number(a.key.startsWith('smoke.'))).slice(0, BENCH_FAILURE_CAP).map((f) => ({ key: f.key, vars: { ...f.vars } })),
    stars, smoked: out.smoked,
    predictions: out.predictions.map((p) => ({ id: p.id, entered: p.entered, truth: p.truth, grade: p.grade })),
    badSamples: out.badSamples, measured: out.values,
  };
  return { result, causes: out.causes };
}

// ---------------------------------------------------------------- hints (DESIGN §7.2)
/** Evaluate a hint expression on the player's board where it solves, falling back to the ref board per probe. */
export function evalHint(e: HintExpr, probe: (p: string) => number | null): number | null {
  if (typeof e === 'number') return e;
  if ('probe' in e) return probe(e.probe);
  const a = evalHint(e.a, probe), b = evalHint(e.b, probe);
  if (a === null || b === null) return null;
  return e.op === 'add' ? a + b : e.op === 'sub' ? a - b : e.op === 'mul' ? a * b : b === 0 ? null : a / b;
}
export function probeOn(board: Board, def: LevelDef, tk: TicketState | null): (p: string) => number | null {
  const rig = buildRig({ board: { ...board, probes: [], meter: { mode: 'off', pads: [] } }, getDef, supplies: def.supplies, supply: tk?.instruments.supply ?? { v: 0, ilim: 0.1 }, gen: tk?.instruments.gen ?? { shape: 'sine', f: 1000, vpp: 1, offset: 0 }, overrides: tk ? [...hiddenOverrides(def, tk), ...selectorOverrides(def, tk)] : [], ambientC: def.bench.ambientC, regTau: def.bench.regTau, heat: def.bench.heat });
  const ckt = rig.circuit;
  let x: Float64Array | null | undefined;
  return (p) => {
    if (!ckt || rig.errors.length > 0) return null;
    const r = rig.resolve(p); if (r === null) return null;
    if (x === undefined) { const op = solveOp(ckt); x = op.ok ? op.x : null; }
    return x ? makeProbe(ckt, r)(x, new Array(ckt.stateSize).fill(0)) : null;
  };
}

/** The bridge scan of a null-detector ticket on the player's board (cached on the board's wiring: the jockey position is not part of the key), with the wiring fault in words. */
let scanCache: { key: string; out: { scan: BridgeScan; fault: string } | null } | null = null;
export function bridgeScan(tk: TicketState, def: LevelDef): { scan: BridgeScan; fault: string } | null {
  if (!def.nullCheck) return null;
  const key = hashOf({ id: def.id, p: tk.board.parts.map((p) => ({ ...p, pos: undefined })), w: tk.board.wires, v: tk.instruments.supply.v, h: tk.hidden });
  if (scanCache && scanCache.key === key) return scanCache.out;
  const probe = def.bench.specs.find((x) => x.id === def.gauge?.spec);
  let out: { scan: BridgeScan; fault: string } | null = null;
  if (probe && probe.kind === 'level') {
    const scan = scanBridge(tk.board, def, (b) => probeOn(b, def, tk)(probe.probe));
    if (scan) { const r = refs(tk.board, liveRig(tk, def).conn); out = { scan, fault: bridgeFault(def, r.nodeOf, r.legsOn) }; }
  }
  scanCache = { key, out };
  return out;
}
export const partCount = (board: Board, partId: string): number => board.parts.filter((p) => p.partId === partId).length;
export const defOfPart = (id: string): ReturnType<typeof findPart> => findPart(id);
