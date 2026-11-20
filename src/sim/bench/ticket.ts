// The ticket bench (DESIGN §3.12, §8.6): a PURE function (board, plan, hidden overrides, instrument settings, smoked parts, predictions) → verdict.
// It is independent of the live state (the engine passes the saved smoked list only because "the customer won't take burnt parts"), so bots
// can run it in parallel. Conditions run one after another; every spec must pass in every condition. The cost gate (§3.11) is always on.
import type { PartDef } from '../../data/parts/types';
import type { BenchPlan } from '../../data/levels/types';
import { buildRig, type RigBoard, type RigGen, type RigOverride } from '../rig';
import { checkRatings, ratingProbes } from '../ratings';
import { refuseSmoked } from '../smoke';
import type { SupplyDef } from '../../data/levels/types';
import { runBench } from './run';
import { BENCH_FLOP_LIMIT } from './cost';
import type { BenchFailure, BenchSpec } from './types';

export interface TicketBenchInput {
  board: RigBoard;
  getDef: (partId: string) => PartDef | undefined;
  supplies: readonly SupplyDef[];
  plan: BenchPlan;
  /** Hidden-parameter overrides (already resolved to numbers). */
  hidden: readonly RigOverride[];
  supply: { v: number; ilim: number };
  gen: RigGen;
  smoked: readonly string[];
  predictions: Readonly<Record<string, number>>;
  flopLimit?: number;
}
export interface SpecRow { id: string; pass: boolean; margin: number }
export interface TicketBenchOut {
  pass: boolean;
  failures: BenchFailure[];
  rows: SpecRow[];
  /** Mean power drawn from the supplies, W, averaged over the conditions. */
  supplyPowerW: number;
  smoked: string[];
  /** The explainable causes behind rating failures and smoke (key + the player's own numbers, §7.3), over all conditions. */
  causes: BenchFailure[];
  predictions: { id: string; entered: number; truth: number; grade: string }[];
  badSamples: Record<string, number[]>;
}

const BIG = 1e30;
const nodesOf = (probe: string): string[] => {
  const m = /^[vV]\(([^)]*)\)$/.exec(probe.trim()); if (!m) return [];
  return m[1]!.split(',').map((s) => s.trim().toLowerCase()).filter((s) => s !== '0' && s !== 'gnd');
};

export function runTicketBench(inp: TicketBenchInput): TicketBenchOut {
  const { plan } = inp;
  const failures: BenchFailure[] = [], badSamples: Record<string, number[]> = {}, predictions: TicketBenchOut['predictions'] = [];
  const marginOf = new Map<string, number>();
  const failedIds = new Set<string>();
  const specIds: string[] = [...plan.specs.map((s) => s.id)];
  if (!specIds.includes('ratings')) specIds.push('ratings');
  const smokedOut: string[] = [], causes: BenchFailure[] = [];
  let powerSum = 0, conds = 0;
  const floatAll = new Set<string>();   // specs whose probe sits on a circuit with no tie to the GND pad: no number is shown for them

  const burnt = refuseSmoked({ smoked: [...inp.smoked] }, inp.board.parts.map((p) => p.uid));
  if (burnt.length > 0) {
    for (const f of burnt) failures.push(f);
    return { pass: false, failures, rows: specIds.map((id) => ({ id, pass: false, margin: -1 })), supplyPowerW: 0, smoked: burnt.map((b) => String(b.vars.part)), causes, predictions, badSamples };
  }

  for (const cond of plan.conditions) {
    const overrides: RigOverride[] = [...inp.hidden, ...(cond.set ?? [])];
    const ta = cond.ambientC ?? plan.ambientC;
    const mk = (probeLoads: string[]) => buildRig({ board: inp.board, getDef: inp.getDef, supplies: inp.supplies, supply: inp.supply, gen: inp.gen, overrides, ambientC: ta, probeLoads });
    const rig0 = mk([]);
    // resolve spec probes against the board; a spec whose part is not on the board fails with a teaching key
    const specs: BenchSpec[] = [], loads: string[] = [];
    for (const s of plan.specs) {
      if (s.kind === 'level' || s.kind === 'band' || s.kind === 'metric' || s.kind === 'predict') {
        const orig = s.kind === 'predict' ? s.of.probe : s.probe;
        const probe = rig0.resolve(orig);
        if (probe === null) { failures.push({ key: 'bench.part.missing', vars: { id: s.id, probe: orig, cond: cond.id } }); failedIds.add(s.id); continue; }
        for (const n of nodesOf(probe)) if (!loads.includes(n)) loads.push(n);
        if (s.kind === 'predict') {
          const entered = inp.predictions[s.id];
          if (entered === undefined) { failures.push({ key: 'bench.predict.missing', vars: { id: s.id, cond: cond.id } }); failedIds.add(s.id); continue; }
          specs.push({ ...s, entered, of: { ...s.of, probe } });
        } else specs.push({ ...s, probe } as BenchSpec);
      } else specs.push(s);
    }
    const rig = mk(loads);
    if (rig.errors.length > 0) { for (const e of rig.errors) failures.push({ key: e.key, vars: { ...e.vars, cond: cond.id } }); for (const id of specIds) failedIds.add(id); continue; }
    const ckt = rig.circuit!;
    const blocks = ckt.issues.filter((i) => i.severity === 'block');
    if (blocks.length > 0) { for (const b of blocks) failures.push({ key: b.key, vars: { ...b.vars, cond: cond.id } }); for (const id of specIds) failedIds.add(id); continue; }
    const probes = ratingProbes(rig, rig.rated);
    const full: BenchSpec[] = specs.filter((s) => s.kind !== 'rating');
    full.push({ kind: 'rating', id: 'ratings', probes });
    const psIds = rig.sources.filter((id) => ckt.elementIndex[id] !== undefined);
    for (const id of psIds) full.push({ kind: 'level', id: `__ps:${id}`, probe: `p(${id})`, lo: -BIG, hi: BIG });
    const r = runBench(ckt, full, {
      h: plan.h, settle: plan.settle, window: plan.window, period: plan.period, measurePeriods: plan.measurePeriods, maxPeriods: plan.maxPeriods,
      ic: plan.ic, ratings: (w) => { const rr = checkRatings(rig, rig.rated, w, { ta }); for (const c of rr.failures) causes.push({ key: c.key, vars: { ...c.vars, cond: cond.id } }); return { violations: rr.violations, smoked: rr.smoked }; }, maxFlops: inp.flopLimit ?? BENCH_FLOP_LIMIT, condition: cond.id,
    });
    conds++;
    // A voltage probe on an island that never reaches the GND connector can only read leakage (a few microvolts): say the real problem instead of a meaningless number.
    const islandNodes = new Set<string>(); for (const i of rig0.circuit?.issues ?? []) if (i.code === 'island') for (const n of i.nodes) islandNodes.add(n.toLowerCase());
    const floatIds = new Set<string>(specs.filter((s) => (s.kind === 'level' || s.kind === 'metric' || s.kind === 'band' || s.kind === 'predict') && nodesOf(s.kind === 'predict' ? s.of.probe : s.probe).some((n) => islandNodes.has(n))).map((s) => s.id));
    if (floatIds.size > 0) {
      r.failures = r.failures.filter((f) => !(typeof f.vars.id === 'string' && floatIds.has(f.vars.id) && /^bench\.(level|metric|band)\./.test(f.key)));
      if (!failures.some((f) => f.key === 'bench.floating')) failures.push({ key: 'bench.floating', vars: { id: [...floatIds][0]!, cond: cond.id } });
      for (const id of floatIds) { failedIds.add(id); floatAll.add(id); }
    }
    for (const f of r.failures) { failures.push(f); if (typeof f.vars.id === 'string') failedIds.add(f.vars.id); if (f.key === 'bench.rating.smoked' && !smokedOut.includes(String(f.vars.part))) smokedOut.push(String(f.vars.part)); }
    if (r.failures.length > 0 && r.failures.every((f) => f.vars.id === undefined)) for (const id of specIds) failedIds.add(id);   // a whole-bench failure (cost gate, no convergence)
    for (const s of specs) {
      const v = r.metrics[s.id]; if (v === undefined) continue;
      let m = 0;
      if (s.kind === 'level' || s.kind === 'metric') m = Number.isNaN(v) ? -1 : Math.min(v - s.lo, s.hi - v);
      else if (s.kind === 'band') m = -v;
      else if (s.kind === 'mask') m = v;
      else if (s.kind === 'safety') m = v >= 1 ? 0 : -1;
      const cur = marginOf.get(s.id); marginOf.set(s.id, cur === undefined ? m : Math.min(cur, m));
    }
    const rv = r.metrics.ratings; if (rv !== undefined) { const cur = marginOf.get('ratings'); marginOf.set('ratings', cur === undefined ? -rv : Math.min(cur, -rv)); }
    for (const [id, t] of Object.entries(r.badSamples)) { const a = badSamples[id] ?? (badSamples[id] = []); for (const x of t) if (a.length < 64) a.push(x); }
    for (const p of r.predictions) if (!floatAll.has(p.id) && !predictions.some((q) => q.id === p.id)) predictions.push({ id: p.id, entered: p.entered, truth: p.truth, grade: p.grade });
    let p = 0; for (const id of psIds) p -= r.metrics[`__ps:${id}`] ?? 0;
    powerSum += p;
  }
  const rows = specIds.map((id) => ({ id, pass: !failedIds.has(id), margin: marginOf.get(id) ?? (failedIds.has(id) ? -1 : 0) }));
  return { pass: failures.length === 0, failures, rows, supplyPowerW: conds > 0 ? powerSum / conds : 0, smoked: smokedOut, causes, predictions, badSamples };
}
