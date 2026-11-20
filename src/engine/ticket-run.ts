// Everything the actions and queries share about a running ticket: lookups, the live rig, the bench run, hints. Engine layer: may use state.
import { findPart } from '../data/parts';
import type { LevelDef } from '../data/levels/types';
import type { Board } from '../sim/board/types';
import { buildRig, type Rig, type RigOverride } from '../sim/rig';
import { runTicketBench } from '../sim/bench/ticket';
import { makeProbe } from '../sim/mna/tran';
import { solveOp } from '../sim/mna/op';
import { sig } from '../sim/explain';
import { BENCH_FAILURE_CAP, SCOPE_POINTS_CAP, LIVE_HIST_CAP, LIVE_X_CAP, type BenchResult, type NodeState, type TicketState } from './state';
import type { LiveCfg } from '../sim/live';
import { newScope } from './state';
import { REGIONS } from '../regions';
import { boardMetrics } from './metrics';
import { refBoard } from './tickets';
import { getDef } from './board';
import type { HintExpr } from '../data/levels/types';

/** Names of the specs every ticket has implicitly (the always-on ratings check). */
const IMPLICIT_SPEC: Record<string, string> = { ratings: 'bench.spec.ratings' };

export const hiddenOverrides = (def: LevelDef, tk: TicketState): RigOverride[] =>
  (def.hidden ?? []).filter((h) => tk.hidden[h.id] !== undefined).map((h) => ({ target: h.target, key: h.key, value: tk.hidden[h.id]! }));

/** The live circuit: board + bench sources + scope probes + DMM + hidden parameters + smoked parts. */
export function liveRig(tk: TicketState, def: LevelDef): Rig {
  return buildRig({
    board: tk.board, getDef, supplies: def.supplies, supply: tk.instruments.supply, gen: tk.instruments.gen,
    overrides: hiddenOverrides(def, tk), smoked: tk.live.smoked, ambientC: def.bench.ambientC, instruments: true,
  });
}

export const liveCfg = (tk: TicketState, def: LevelDef): LiveCfg => ({
  frameSim: def.live.frameSim, h: def.live.h, thermalSpeed: def.live.thermalSpeed, ambientC: def.bench.ambientC,
  xCap: LIVE_X_CAP, histCap: LIVE_HIST_CAP, scopeCap: SCOPE_POINTS_CAP, timePerDiv: tk.instruments.scope.timePerDiv ?? newScope().timePerDiv,
});

/** Run the pure bench for the open ticket (all conditions) and fold in cost / parts / power / area and the stars. */
/** A rating violation or smoke from the bench is shown as the explainable cause with the player's own numbers when the ratings check has one. */
function richer(f: { key: string; vars: Record<string, string | number> }, causes: readonly { key: string; vars: Record<string, string | number> }[]): { key: string; vars: Record<string, string | number> } {
  if (f.key === 'bench.rating.violation') return causes.find((c) => c.key.startsWith('rating.') && c.vars.part === f.vars.part && c.vars.what === f.vars.what) ?? f;
  if (f.key === 'bench.rating.smoked') return causes.find((c) => c.key.startsWith('smoke.') && c.vars.part === f.vars.part) ?? f;
  return f;
}

export function benchTicket(s: NodeState, def: LevelDef): { result: BenchResult; causes: { key: string; vars: Record<string, string | number> }[] } {
  const tk = s.ticket!;
  const out = runTicketBench({
    board: tk.board, getDef, supplies: def.supplies, plan: def.bench, hidden: hiddenOverrides(def, tk),
    supply: tk.instruments.supply, gen: tk.instruments.gen, smoked: tk.live.smoked, predictions: tk.predictions,
  });
  const metrics = boardMetrics(tk.board, REGIONS.get(s.region), out.supplyPowerW * 1e6);
  const failuresAll = [...out.failures], rowsAll = [...out.rows];
  let pass = out.pass;
  // numbers the player works out and enters (2-2: the distance to the fault), checked against the hidden truth; reported only once the circuit itself is right
  for (const a of def.answers ?? []) {
    const entered = tk.predictions[a.id], hv = tk.hidden[a.hidden] ?? def.hidden?.find((h) => h.id === a.hidden)?.learner ?? 0, truth = hv / a.per;
    if (entered === undefined) { rowsAll.push({ id: a.id, pass: false, margin: -1 }); if (out.pass) { failuresAll.push({ key: 'bench.answer.missing', vars: { id: a.id, unit: a.unit } }); pass = false; } continue; }
    const rel = Math.abs(entered - truth) / Math.max(Math.abs(truth), 1e-12), good = rel <= a.tol;
    metrics.accuracy = Math.round(rel * 1e6);
    rowsAll.push({ id: a.id, pass: good, margin: sig(a.tol - rel, 4) });
    if (!good && out.pass) {
      const rbox = tk.board.parts.filter((p) => p.partId === 'res-box' && p.value !== null).reduce((acc, p) => acc + (p.value ?? 0), 0);
      const wire = tk.board.parts.find((p) => p.uid === a.wire), d = wire ? getDef(wire.partId) : undefined, lCm = (wire?.pos ?? 0.5) * (d?.model.lengthM ?? 1) * 100;
      failuresAll.push({ key: 'bench.answer.fail', vars: { id: a.id, entered: String(sig(entered, 6)), unit: a.unit, tol: sig(a.tol * 100, 3), R: sig(rbox, 4), l: sig(lCm, 4), ratio: lCm > 0 && lCm < 100 ? sig((100 - lCm) / lCm, 4) : 0 } });
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
    failures: failuresAll.map((f) => richer(f, out.causes)).slice(0, BENCH_FAILURE_CAP).map((f) => ({ key: f.key, vars: { ...f.vars } })),
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
  const rig = buildRig({ board: { ...board, probes: [], meter: { mode: 'off', pads: [] } }, getDef, supplies: def.supplies, supply: tk?.instruments.supply ?? { v: 0, ilim: 0.1 }, gen: tk?.instruments.gen ?? { shape: 'sine', f: 1000, vpp: 1, offset: 0 }, overrides: tk ? hiddenOverrides(def, tk) : [], ambientC: def.bench.ambientC });
  const ckt = rig.circuit;
  let x: Float64Array | null | undefined;
  return (p) => {
    if (!ckt || rig.errors.length > 0) return null;
    const r = rig.resolve(p); if (r === null) return null;
    if (x === undefined) { const op = solveOp(ckt); x = op.ok ? op.x : null; }
    return x ? makeProbe(ckt, r)(x, new Array(ckt.stateSize).fill(0)) : null;
  };
}
export const partCount = (board: Board, partId: string): number => board.parts.filter((p) => p.partId === partId).length;
export const defOfPart = (id: string): ReturnType<typeof findPart> => findPart(id);
