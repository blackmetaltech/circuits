// Queries (DESIGN §8.5): everything the UI shows. Read-only: none of these mutates the state; derived data is recomputed from the saved
// solution (live.x / live.hist) on the saved board, so a loaded save answers exactly as the running game did.
import { dmath } from '@core/numerics';
import type { QueryFn } from '@core/kit';
import { PARTS } from '../data/parts';
import type { LevelDef } from '../data/levels/types';
import type { Pad } from '../sim/board/types';
import { pinPads } from '../sim/board/footprints';
import { checkRatings, ratingProbes } from '../sim/ratings';
import { explainFailure, si, sig, type DebCtx, type ExplainContext, type LedLoop } from '../sim/explain';
import { nameVars, partNames } from './names';
import { elementPowers, thermalState } from '../sim/thermal';
import { SCOPE_SCREEN_POINTS } from '../sim/live';
import { makeProbe } from '../sim/mna/tran';
import { solveOp } from '../sim/mna/op';
import { compileNetlist } from '../sim/mna/compile';
import { nodeVoltage, terminalCurrents } from '../sim/mna/stamp';
import type { Circuit, Element } from '../sim/mna/types';
import type { Rig } from '../sim/rig';
import { t } from '../i18n';
import { REGIONS } from '../regions';
import { formatMinor } from '../regions/data';
import { padKey } from '../sim/board/grid';
import { allowedValues, allowedVariants, getDef } from './board';
import { partPrice } from './metrics';
import { FAILURE_LOG_CAP, SCOPE_POINTS_CAP, UNDO_CAP, type NodeState, type TicketState } from './state';
import { isUnlocked, levelDefOf } from './tickets';
import { liveRig } from './ticket-run';
import { balanceFormula, rSide } from './nullcheck';
import { say } from './text';
import { buildDebrief, starsRule } from './debrief';
import { makeUiQueries, scopeTarget, shoebox } from './ui';

const regionString = (region: string, key: string): string => { const v = REGIONS.get(region).strings[key]; if (v === undefined) throw new Error(`Region '${region}' has no string '${key}'.`); return v; };

interface Solution { rig: Rig; ckt: Circuit; x: Float64Array; state: number[] }
function solution(tk: TicketState, def: LevelDef): Solution | null {
  const rig = liveRig(tk, def), ckt = rig.circuit;
  if (!ckt || rig.errors.length > 0 || ckt.dim === 0 || tk.live.x.length !== ckt.dim || tk.live.hist.length !== ckt.stateSize) return null;
  return { rig, ckt, x: Float64Array.from(tk.live.x), state: tk.live.hist };
}

/** Solutions this module built (liveFrame passes its one solution to nodes / currents / thermal / ratings so the rig is built once per frame). */
const MINE = new WeakSet<object>();
const given = (pre: unknown): Solution | null => (typeof pre === 'object' && pre !== null && MINE.has(pre) ? (pre as Solution) : null);
const mineSolution = (tk: TicketState, def: LevelDef): Solution | null => { const s = solution(tk, def); if (s) MINE.add(s); return s; };

/** How the chit explains the payout: "fee $3.00 + $1.00 per new star". */
const payText = (def: LevelDef, pack: ReturnType<typeof REGIONS.get>): string => (def.pay ? t('pay.explain', { fee: formatMinor(def.pay.fee, pack), perStar: formatMinor(def.pay.perStar, pack) }) : '');
const PREDICT_GRADE: Record<string, string> = { exact: 'bench.predict.exact', close: 'bench.predict.close', miss: 'bench.predict.miss' };
const text = (f: { key: string; vars: Record<string, string | number> }): string => say(f.key, f.vars);

/** Context the explainers need to put the player's own numbers in (resistances, electrolytics, supply and LED figures). */
/** 3-2: what OUT did. From the scope's own sweep when it is complete (the same samples the player sees), otherwise the exact RC response of the same circuit. */
function debounceTrace(tk: TicketState, def: LevelDef, r: number, c: number, vSrc: number): DebCtx | undefined {
  const k = def.supplies.find((x) => x.kind === 'contact'); if (!k || k.press === undefined || k.release === undefined) return undefined;
  const pull = tk.board.parts.find((p) => p.partId === 'pullup-10k'), rPull = pull ? (getDef(pull.partId)!.model.R ?? 10e3) : 10e3;
  const sc = tk.live.scope, n = SCOPE_SCREEN_POINTS;
  if (sc.dt > 0 && sc.ch1.length >= n) {
    const at = (t: number): number => Math.max(0, Math.min(sc.ch1.length - 1, Math.round((t - sc.t0) / sc.dt))), seg = (a: number, b: number): number[] => sc.ch1.slice(at(a), at(b) + 1);
    const press = seg(k.press, k.release), rel = seg(k.release, sc.t0 + (sc.ch1.length - 1) * sc.dt);
    if (press.length > 0 && rel.length > 0) return { vStart: sc.ch1[Math.max(0, at(k.press) - 1)]!, vLow: Math.min(...press), vAtRelease: sc.ch1[at(k.release)]!, vHigh: Math.max(...rel), tPress: k.press, tRelease: k.release, rPull, fromScope: true };
  }
  const end = 0.1, dtl = k.release - k.press, vRel = vSrc * dmath.exp(-dtl / (r * c));
  return { vStart: vSrc, vLow: vRel, vAtRelease: vRel, vHigh: vSrc - (vSrc - vRel) * dmath.exp(-(end - k.release) / ((r + rPull) * c)), tPress: k.press, tRelease: k.release, rPull, fromScope: false };
}
function explainCtx(tk: TicketState | null, def: LevelDef | undefined, prior = 0): ExplainContext {
  const kinds: Record<string, string> = {};
  const names: Record<string, string> = tk ? partNames(tk.board) : {};
  const ctx: ExplainContext = { resistance: {}, electrolytic: [], led: {}, miss: { names, kinds }, prior };
  if (!tk || !def) return ctx;
  const rig = liveRig(tk, def);
  let vSupply = 0, rSource = 0;
  for (const e of rig.netlist.elements) {
    if (e.kind === 'BAT') { vSupply = Math.max(vSupply, e.p.emf ?? 0); rSource = e.p.r ?? 0; }
    if (e.kind === 'BENCH') vSupply = Math.max(vSupply, e.p.v ?? 0);
  }
  const resistors = tk.board.parts.filter((p) => getDef(p.partId)?.kind === 'R' && p.value !== null);
  const rRes = resistors.reduce((a, p) => a + (p.value ?? 0), 0);
  const rWhat = resistors.length === 1 ? names[resistors[0]!.uid]! : `${resistors.length} resistors`;
  const nLeds = tk.board.parts.filter((p) => getDef(p.partId)?.kind === 'LED').length;
  if (def.explain) ctx.miss!.mode = def.explain;
  if (def.explain === 'divider') {   // 2-1: the player's top resistor (IN to OUT) and bottom resistor (OUT to GND), the fixed load, the supply
    const cn = rig.conn.connectorNodes, nIn = cn.IN ?? -1, nOut = cn.OUT ?? -1, nGnd = cn.GND ?? -1;
    const between = (a: number, b: number): number => { let sum = 0, any = false; for (const p of resistors) { const n = rig.conn.pinNodes[p.uid] ?? []; if ((n[0] === a && n[1] === b) || (n[0] === b && n[1] === a)) { sum += p.value ?? 0; any = true; } } return any ? sum : 0; };
    const fixedLoad = tk.board.parts.find((p) => p.fixed && getDef(p.partId)?.kind === 'LOAD'), load = fixedLoad ? (getDef(fixedLoad.partId)!.model.R ?? 0) : 0;
    const r1 = between(nIn, nOut), r2 = between(nOut, nGnd);
    if (r1 > 0 && r2 > 0 && load > 0) ctx.divider = { r1, r2, rLoad: load, vin: vSupply };
    else if (load > 0 && resistors.length > 0) {   // no resistor from OUT to GND: say which half is missing instead of "check each value"
      const touches = (n: number): boolean => n >= 0 && resistors.some((p) => (rig.conn.pinNodes[p.uid] ?? []).includes(n));
      if (r1 > 0 && r2 === 0 && !touches(nGnd)) ctx.dividerFault = { kind: resistors.length === 1 ? 'nobottom' : 'floating', r1, rLoad: load, vin: vSupply };
      else if (r1 === 0 && r2 > 0 && !touches(nIn)) ctx.dividerFault = { kind: 'notop', r1: 0, rLoad: load, vin: vSupply };
    }
  }
  // chapter 3: the player's RC filter (the resistor and the capacitor between them), the scope probe's load, and the coil with its rail
  if (def.explain === 'rc' || def.explain === 'debounce') {
    const caps = tk.board.parts.filter((p) => { const k = getDef(p.partId)?.kind; return (k === 'C' || k === 'CE') && p.value !== null; });
    const res = resistors.filter((p) => !p.fixed);
    const crossSpec = def.bench.specs.find((x) => x.kind === 'metric' && x.metric === 'crossingTime');
    const rr = res.reduce((a, p) => a + (p.value ?? 0), 0), cc = caps.reduce((a, p) => a + (p.value ?? 0), 0);
    if (crossSpec && crossSpec.kind === 'metric' && rr > 0 && cc > 0) ctx.rc = { r: rr, c: cc, rProbe: 10e6, vSrc: vSupply, level: crossSpec.params?.level ?? 0, tLo: crossSpec.lo, tHi: crossSpec.hi };
    if (def.explain === 'debounce' && ctx.rc) ctx.rc.deb = debounceTrace(tk, def, rr, cc, vSupply);
  }
  if (def.explain === 'coil') {
    const relay = tk.board.parts.find((p) => getDef(p.partId)?.kind === 'RELAY');
    if (relay) {
      const rails = def.supplies.filter((x) => x.kind === 'bench' && x.fixed !== undefined);
      const wired = rails.filter((x) => { const n = rig.conn.connectorNodes[x.plus]; return n !== undefined && n >= 0 && (rig.conn.nodes[n]?.pins.length ?? 0) > 0; });
      const m = getDef(relay.partId)!.model;
      ctx.coil = { relay: relay.uid, rCoil: m.Rcoil ?? 200, lCoil: m.Lcoil ?? 0.1, iPull: m.Ipull ?? 0.04, rSeries: resistors.filter((p) => !p.fixed).reduce((a, p) => a + (p.value ?? 0), 0), vRail: wired.length > 0 ? Math.max(...wired.map((x) => (x as { fixed?: number }).fixed ?? 0)) : 0 };
    }
  }
  // chapter 4: the rectifier, the Zener shunt, the regulator and the LM317 as built
  if (def.explain === 'rectifier') {
    const load = tk.board.parts.find((p) => p.fixed && getDef(p.partId)?.model.cc !== undefined);
    ctx.rect = { c: tk.board.parts.filter((p) => getDef(p.partId)?.kind === 'CE' && p.value !== null).reduce((a, p) => a + (p.value ?? 0), 0), i: load?.value ?? 0.1, nDiodes: tk.board.parts.filter((p) => !p.fixed && getDef(p.partId)?.kind === 'D').length };
  }
  if (def.explain === 'zener') {
    const z = tk.board.parts.find((p) => !p.fixed && getDef(p.partId)?.kind === 'Z'), zd = z ? getDef(z.partId) : undefined;
    ctx.zener = { r: resistors.filter((p) => !p.fixed).reduce((a, p) => a + (p.value ?? 0), 0), vz: zd ? ((zd.variants[0]!.ratings.Vz ?? zd.model.BV ?? 5.1)) : 5.1, slope: zd?.model.Rs ?? 7, izt: zd?.model.Ibv ?? 0.005 };
  }
  if (def.explain === 'regulator') {
    const reg = tk.board.parts.find((p) => !p.fixed && getDef(p.partId)?.kind === 'REG'), rd = reg ? getDef(reg.partId) : undefined, rv = rd ? (rd.variants.find((x) => x.id === reg!.variant) ?? rd.variants[0]!) : undefined;
    ctx.reg = { rpre: resistors.filter((p) => !p.fixed).reduce((a, p) => a + (p.value ?? 0), 0), vrail: Math.max(0, ...def.supplies.map((x) => (x.kind === 'bench' ? x.fixed ?? 0 : 0))), vout: rd?.model.Vreg ?? 5, theta: rv?.thermal.thetaJA ?? 54, ta: def.bench.ambientC, tjMax: def.bench.tjLimit ?? 125 };
  }
  if (def.explain === 'lm317') {
    const reg = tk.board.parts.find((p) => !p.fixed && getDef(p.partId)?.kind === 'REG');
    if (reg) {
      const nodes = rig.conn.pinNodes[reg.uid] ?? [], nAdj = nodes[0] ?? -1, nOut = nodes[1] ?? -1, nGnd = rig.conn.connectorNodes.GND ?? -1;
      const between = (a: number, b: number): number => resistors.filter((p) => { const n = rig.conn.pinNodes[p.uid] ?? []; return (n[0] === a && n[1] === b) || (n[0] === b && n[1] === a); }).reduce((acc, p) => acc + (p.value ?? 0), 0);
      const r1 = between(nAdj, nOut), r2 = between(nAdj, nGnd);
      if (r1 > 0 && r2 > 0) ctx.lm317 = { r1, r2 };
    }
  }
  for (const p of tk.board.parts) {
    const d = getDef(p.partId); if (!d) continue;
    kinds[p.uid] = d.kind;
    if (d.kind === 'R' || d.kind === 'HEATER') (ctx.resistance as Record<string, number>)[p.uid] = p.value ?? d.model.R ?? 0;
    if (d.kind === 'CE') (ctx.electrolytic as string[]).push(p.uid);
    if (d.kind === 'LED') {
      const v = d.variants.find((x) => x.id === p.variant) ?? d.variants[0]!, iw = v.ratings.IFwork ?? 0.02, m = d.model;
      const vf = m.N! * 0.025852 * dmath.log(iw / m.Is! + 1) + iw * m.Rs!;
      (ctx.led as Record<string, LedLoop>)[p.uid] = { vSupply, vForward: vf, rSource, rLed: m.Rs! + (m.N! * 0.025852) / iw, rRes, rWhat, nLeds, model: { Is: m.Is!, N: m.N!, Rs: m.Rs! }, iRated: v.ratings.IF };
    }
  }
  return ctx;
}
/** The customer's thank-you quoting what the bench measured (2-1: "Dead on: 3.358 volts."), to the precision of the band; '' when the ticket has none. */
function thanksText(def: LevelDef, measured: Record<string, number> | undefined): string {
  const th = def.thanks, v = th ? measured?.[th.spec] : undefined;
  if (!th || v === undefined) return '';
  return say(Math.abs(v - th.target) <= th.within * th.target ? th.exactKey : th.nearKey, { v: String(sig(v, 4)) });
}
export const explainedText = (f: { key: string; vars: Record<string, string | number> }, tk: TicketState | null, def: LevelDef | undefined, prior = 0): string => text(explainFailure(f, explainCtx(tk, def, prior)));

/** Current into the part at each node (sum over its elements), from the saved solution. */
function partPinCurrents(sol: Solution, uid: string): Record<number, number> {
  const out: Record<number, number> = {};
  for (const ce of sol.ckt.elements) {
    if ((ce.el.owner || ce.el.id) !== uid) continue;
    const cur = terminalCurrents(ce, sol.x, sol.state);
    ce.el.nodes.forEach((n, k) => { out[n] = (out[n] ?? 0) + (cur[k] ?? 0); });
  }
  return out;
}

export function makeQueries(defs: readonly LevelDef[]): Record<string, QueryFn<NodeState>> {
  const defOf = (s: NodeState): { tk: TicketState; def: LevelDef } | null => { if (!s.ticket) return null; const def = levelDefOf(defs, s.ticket.id); return def ? { tk: s.ticket, def } : null; };
  const wallet = (s: NodeState): string => formatMinor(s.progress.wallet, REGIONS.get(s.region));

  const Q: Record<string, QueryFn<NodeState>> = {
    /** Campaign progress for the HUD and the chapter board; the wallet is also given formatted for the active region. */
    progress: (s) => { const { failureLog, ...rest } = s.progress; return { ...rest, failureCount: failureLog.length, walletText: wallet(s) }; },
    /** The campaign ticket list with lock state (the core `levels` query is the core-Level list and is reserved). */
    tickets: (s) => defs.map((d) => {
      const p = s.progress.tickets[d.id];
      return { id: d.id, chapter: d.chapter, title: t(d.titleKey), customerId: d.customer, scope: d.scope, passed: !!p?.passed, stars: p?.stars ?? 0, attempts: p?.attempts ?? 0, unlocked: isUnlocked(d, (a) => !!s.progress.tickets[a]?.passed) };
    }),
    /** The open ticket as a card: title, brief, customer with the region's names, specs, bin, par. Null at the counter. */
    ticketCard: (s) => {
      const o = defOf(s); if (!o) return null;
      const { def } = o;
      const customer = regionString(s.region, `customer.${def.customer}`), mentor = regionString(s.region, 'mentor');
      const stall = regionString(s.region, 'stall'), lane = regionString(s.region, 'lane');
      // an exam hides the numbers the student is about to predict until every prediction is locked in (the balance lengths, the test cell's EMF, the band)
      const examHidden = def.eb === true && !def.bench.specs.filter((x) => x.kind === 'predict').every((x) => o.tk.predictions[x.id] !== undefined);
      const sources = o.tk.board.parts.filter((p) => p.fixed && ['cell-2v', 'cell-test', 'ideal-vsource'].includes(p.partId)).map((p) => {
        const d = getDef(p.partId)!, emf = p.partId === 'ideal-vsource' ? (p.value ?? 0) : (d.model.emf ?? 0);
        return { uid: p.uid, partId: p.partId, name: t(d.nameKey), volts: p.partId === 'cell-test' && examHidden ? null : sig(emf, 4), hidden: p.partId === 'cell-test' && examHidden };
      });
      return {
        id: def.id, chapter: def.chapter, title: t(def.titleKey), brief: t(def.briefKey, { customer, mentor, stall, lane }), customerId: def.customer, customer, mentor, stall, lane,
        examHidden, sources,
        specs: def.bench.specs.filter((x) => def.bench.names[x.id] && !(examHidden && (x.kind === 'level' || x.kind === 'metric'))).map((x) => ({ id: x.id, name: t(def.bench.names[x.id]!) })),
        bin: def.bin.map((b) => ({ partId: b.partId, values: allowedValues(getDef(b.partId)!, b), variants: allowedVariants(getDef(b.partId)!, b), max: b.max ?? null })),
        maxParts: def.constraints?.maxParts ?? 40, stars: def.stars, instruments: { supply: def.supplies.some((x) => x.kind === 'bench'), gen: def.supplies.some((x) => x.kind === 'gen'), scope: !!def.instruments.scope },
        hasHints: !!def.hints, hintRung: o.tk.hintRung,
        shoebox: shoebox(s, o.tk, def), eb: def.eb === true, fee: def.pay?.fee ?? 0, feeText: def.pay ? formatMinor(def.pay.fee, REGIONS.get(s.region)) : '',
        conditions: def.bench.conditions.map((c) => ({ id: c.id, set: c.set ?? [], ambientC: c.ambientC ?? def.bench.ambientC })),
        targets: def.bench.specs.flatMap((x) => (x.kind === 'level' && !examHidden ? [{ id: x.id, name: def.bench.names[x.id] ? t(def.bench.names[x.id]!) : '', lo: x.lo, hi: x.hi }] : [])),
        predictions: def.bench.specs.flatMap((x) => (x.kind === 'predict' ? [{ id: x.id, name: def.bench.names[x.id] ? t(def.bench.names[x.id]!) : '', unit: x.unit ?? (x.of.probe.trim().toLowerCase().startsWith('i(') ? 'A' : 'V'), entered: o.tk.predictions[x.id] ?? null }] : [])),
        answers: (def.answers ?? []).map((a) => ({ id: a.id, name: def.bench.names[a.id] ? t(def.bench.names[a.id]!) : '', unit: a.unit, entered: o.tk.predictions[a.id] ?? null, ...(def.nullCheck ? ((side) => ({ side, formula: balanceFormula(side) }))(rSide(o.tk.board, def, (uid, pin) => liveRig(o.tk, def).conn.pinNodes[uid]?.[pin] ?? -1)) : {}) })),
        specShort: def.specShort ? t(def.specShort) : '', gauge: def.gauge ?? null, supplies: def.supplies, chit: def.chit ?? null, ambientC: def.bench.ambientC, figure: def.figure ?? null,
        payText: payText(def, REGIONS.get(s.region)), starRule: def.eb ? starsRule() : '',
        // chapter 4: the mains safety card (its words are Wren's), the live switches and the thermal camera
        mains: def.mains ? { safetyRead: o.tk.safetyRead === true, firstView: !s.progress.codexSeen.includes('mains-safety'), vrms: (def.supplies.find((x) => x.kind === 'mains') as { vrms: number } | undefined)?.vrms ?? 0, hz: (def.supplies.find((x) => x.kind === 'mains') as { f: number } | undefined)?.f ?? 0,
          ribbon: t('safety.ribbon'), title: t('safety.card.title'), lines: [t('safety.card.1'), t('safety.card.2'), t('safety.card.3'), t('safety.card.4')], button: t('safety.card.button'), keepOut: t('safety.keepout'), isolation: t('safety.isolation') } : null,
        selectors: (def.selectors ?? []).map((sd) => ({ id: sd.id, label: t(sd.labelKey), options: sd.options.map((x) => t(x.labelKey)), index: o.tk.sel?.[sd.id] ?? sd.initial })),
        camera: def.chapter === 4,
      };
    },
    /** The board with part names, rotated pin pads and ratings, probes and meter. */
    board: (s) => {
      const o = defOf(s); if (!o) return null;
      const b = o.tk.board;
      return {
        w: b.w, h: b.h, connectors: b.connectors, wires: b.wires, probes: b.probes, meter: b.meter,
        parts: b.parts.map((p) => { const d = getDef(p.partId)!; const pads = pinPads(p, d); return { ...p, name: t(d.nameKey), kind: d.kind, pins: d.pins.map((n, i) => ({ name: n, pad: pads[i]! })), ratings: (d.variants.find((v) => v.id === p.variant) ?? d.variants[0]!).ratings, smoked: o.tk.live.smoked.includes(p.uid) }; }),
        undoDepth: o.tk.undo.length, redoDepth: o.tk.redo.length,
      };
    },
    /** The compiled netlist for debugging and agents (nodes, elements, topology findings, board errors). */
    netlist: (s) => {
      const o = defOf(s); if (!o) return null;
      const rig = liveRig(o.tk, o.def), nl = rig.netlist;
      return { nodes: nl.nodeNames, elements: nl.elements.map((e) => ({ id: e.id, kind: e.kind, owner: e.owner, nodes: e.nodes.map((n) => nl.nodeNames[n]), p: e.p })), issues: (rig.circuit?.issues ?? []).map((i) => ({ code: i.code, severity: i.severity, key: i.key, text: text(i) })), errors: rig.errors.map((e) => ({ ...e, text: text(e) })), dim: rig.circuit?.dim ?? 0 };
    },
    /** Voltage of every electrical node with its pads and a 0..1 colour scalar (span of the board's voltages). */
    nodes: (s, pre?: unknown) => {
      const o = defOf(s); if (!o) return null;
      const sol = given(pre) ?? solution(o.tk, o.def);
      const nodes = (sol ? sol.rig.conn : liveRig(o.tk, o.def).conn).nodes.map((n) => {
        const name = (sol ? sol.rig.netlist : liveRig(o.tk, o.def).netlist).nodeNames[n.id]!;
        const v = sol ? (n.id === 0 ? 0 : nodeVoltage(sol.x, sol.ckt.nodeIndex[name]!)) : 0;
        return { id: n.id, name, v, pads: n.pads, connectors: n.connectors };
      });
      const vs = nodes.map((n) => n.v), vmin = Math.min(0, ...vs), vmax = Math.max(0, ...vs), span = vmax - vmin;
      return { valid: !!sol, vmin, vmax, nodes: nodes.map((n) => ({ ...n, norm: span > 0 ? (n.v - vmin) / span : 0 })) };
    },
    /** Current per wire (signed along path[0] to the last pad, A) and per part pin (into the part), for the moving dots. */
    currents: (s, pre?: unknown) => {
      const o = defOf(s); if (!o) return null;
      const sol = given(pre) ?? solution(o.tk, o.def);
      if (!sol) return { valid: false, wires: o.tk.board.wires.map((w) => ({ wid: w.wid, i: 0, mag: 0 })), parts: [] };
      const conn = sol.rig.conn, inj = new Map<string, number>();
      const parts = o.tk.board.parts.map((p) => {
        const d = getDef(p.partId)!, pads = pinPads(p, d), nodes = conn.pinNodes[p.uid] ?? [];
        const into = partPinCurrents(sol, p.uid);
        const pins = d.pins.map((name, i) => {
          const nodeIdx = nodes[i]!, share = nodes.filter((n) => n === nodeIdx).length;
          const cur = (into[nodeIdx] ?? 0) / share;
          inj.set(padKey(pads[i]!), (inj.get(padKey(pads[i]!)) ?? 0) - cur);
          return { name, pad: pads[i]!, i: cur };
        });
        return { uid: p.uid, pins };
      });
      // wire currents: a spanning tree of each connected wire network carries the net injection of its subtree
      const wires = o.tk.board.wires, adj = new Map<string, { wid: string; other: string; sign: number }[]>();
      for (const w of wires) {
        const a = padKey(w.path[0]!), z = padKey(w.path[w.path.length - 1]!);
        (adj.get(a) ?? adj.set(a, []).get(a)!).push({ wid: w.wid, other: z, sign: 1 });
        (adj.get(z) ?? adj.set(z, []).get(z)!).push({ wid: w.wid, other: a, sign: -1 });
      }
      const flow = new Map<string, number>(), seen = new Set<string>();
      const roots = [...adj.keys()].sort();
      for (const r of roots) {
        if (seen.has(r)) continue;
        const order: string[] = [r], par = new Map<string, { from: string; wid: string; sign: number }>(); seen.add(r);
        for (let h = 0; h < order.length; h++) for (const e of adj.get(order[h]!)!) if (!seen.has(e.other)) { seen.add(e.other); par.set(e.other, { from: order[h]!, wid: e.wid, sign: e.sign }); order.push(e.other); }
        const sub = new Map<string, number>(order.map((k) => [k, inj.get(k) ?? 0]));
        for (let k = order.length - 1; k > 0; k--) {
          const v = order[k]!, p = par.get(v)!;
          const toParent = sub.get(v)!;            // current leaving the subtree of v towards its parent along this wire
          // wire orientation: sign = +1 when the wire runs path[0] = parent .. path[last] = child (parent -> child)
          flow.set(p.wid, (flow.get(p.wid) ?? 0) + (p.sign === 1 ? -toParent : toParent));
          sub.set(p.from, sub.get(p.from)! + toParent);
        }
      }
      return { valid: true, wires: wires.map((w) => { const i = flow.get(w.wid) ?? 0; return { wid: w.wid, i, mag: Math.abs(i) }; }), parts };
    },
    /** Part temperatures, thermal state and smoked parts. */
    thermal: (s, pre?: unknown) => {
      const o = defOf(s); if (!o) return null;
      const sol = given(pre) ?? solution(o.tk, o.def), rig = sol?.rig ?? liveRig(o.tk, o.def);
      const pw = sol ? elementPowers(sol.ckt, sol.x, sol.state) : {};
      return {
        ambient: o.def.bench.ambientC, smoked: o.tk.live.smoked.slice(),
        parts: rig.rated.map((p) => { const T = o.tk.live.temps[p.id] ?? o.def.bench.ambientC; return { uid: p.id, temp: T, power: pw[p.id] ?? 0, state: o.tk.live.smoked.includes(p.id) ? 'smoke' : thermalState(p, Math.max(0, pw[p.id] ?? 0), T), smoked: o.tk.live.smoked.includes(p.id) }; }),
      };
    },
    /** Rating ratios per part from the saved solution: power / rating and every rating violated right now. */
    ratings: (s, pre?: unknown) => {
      const o = defOf(s); if (!o) return null;
      const sol = given(pre) ?? solution(o.tk, o.def); if (!sol) return { valid: false, parts: [] };
      const names = ratingProbes(sol.rig, sol.rig.rated), series: Record<string, number[]> = {};
      for (const n of names) series[n] = [makeProbe(sol.ckt, n)(sol.x, sol.state)];
      const rr = checkRatings(sol.rig, sol.rig.rated, { t: [o.tk.live.t], series }, { ta: o.def.bench.ambientC });
      return {
        valid: true,
        parts: sol.rig.rated.map((p) => {
          const P = Math.max(0, rr.power[p.id]?.avg ?? 0), pr = p.ratings.P ?? p.ratings.Pd ?? p.ratings.PD ?? p.ratings.Ptot;
          const finds = rr.findings.filter((f) => f.part === p.id);
          const ratio = pr ? P / pr : finds.reduce((m, f) => Math.max(m, f.limit > 0 ? f.value / f.limit : 0), 0);
          return { uid: p.id, power: P, rated: pr ?? null, ratio, violations: finds.map((f) => ({ what: f.what, value: f.value, limit: f.limit, key: f.key, text: text({ key: f.key, vars: nameVars(o.tk.board, f.vars) }) })) };
        }),
      };
    },
    /** One scope channel: the trigger-aligned window of the capture ring (`window` points, default one screen of 256, at most 512). */
    scope: (s, ch?: unknown, window?: unknown) => {
      const o = defOf(s); if (!o) return null;
      const c = ch === 2 ? 2 : 1, sc = o.tk.live.scope, set = o.tk.instruments.scope;
      const data = c === 1 ? sc.ch1 : sc.ch2, n = Math.max(8, Math.min(SCOPE_POINTS_CAP, typeof window === 'number' && Number.isFinite(window) ? Math.floor(window) : SCOPE_SCREEN_POINTS));
      const attached = o.tk.board.probes.some((p) => p.ch === c);
      const trig = set.trigger, tdata = trig.source === 2 ? sc.ch2 : sc.ch1;
      let start = Math.max(0, data.length - n), triggered = false;
      const limit = Math.max(0, tdata.length - n);
      if (o.def.trace) { start = 0; triggered = true; }   // a single sweep always starts at power-on
      else for (let i = 1; i <= limit; i++) {
        const a = tdata[i - 1]!, b = tdata[i]!;
        if (trig.edge === 'rise' ? a < trig.level && b >= trig.level : a > trig.level && b <= trig.level) { start = i; triggered = true; break; }
      }
      const end = Math.min(data.length, start + n);
      return {
        ch: c, attached, triggered, t0: sc.t0 + start * sc.dt, dt: sc.dt, v: data.slice(start, end), voltsPerDiv: set.voltsPerDiv[c - 1], timePerDiv: set.timePerDiv, trigger: trig,
        unit: 'V', badSamples: o.tk.lastBench?.badSamples ?? {}, ...scopeTarget(s, o.tk, o.def, solution(o.tk, o.def)),
      };
    },
    /** The DMM reading from the saved solution (or a zero-source resistance measurement in ohm mode). */
    meter: (s) => {
      const o = defOf(s); if (!o) return null;
      const m = o.tk.board.meter;
      if (m.mode === 'off') return { mode: 'off', pads: [], value: null, unit: '', text: '', valid: false };
      const unit = m.mode === 'dca' ? 'A' : m.mode === 'ohm' ? 'Ω' : 'V';
      let floating = false;   // a lead sits on an island with no tie to the GND pad: the reading is real but only relative (the bench measures from GND)
      const done = (value: number | null, key = ''): unknown => ({ mode: m.mode, pads: m.pads, value, unit, valid: value !== null, floating, text: value === null ? (key ? t(key) : '') : si(value, unit) });
      if (m.mode === 'acv') return done(null, 'meter.acvNotYet');
      if (m.mode === 'ohm') return done(measureOhms(o.tk, o.def));
      const sol = solution(o.tk, o.def); if (!sol || !sol.rig.dmm) return done(null);
      const na = sol.rig.padNode(m.pads[0]!), nb = m.pads[1] ? sol.rig.padNode(m.pads[1]) : '0';
      if (m.mode !== 'dca' && (na === null || nb === null)) return done(null);
      if (na !== null && nb !== null) { const isl = new Set<string>(); for (const i of sol.ckt.issues) if (i.code === 'island') for (const n of i.nodes) isl.add(n); floating = isl.has(na) || isl.has(nb); }
      return done(m.mode === 'dca' ? makeProbe(sol.ckt, 'i(dmm)')(sol.x, sol.state) : makeProbe(sol.ckt, `v(${na},${nb})`)(sol.x, sol.state));
    },
    liveStatus: (s) => {
      const o = defOf(s); if (!o) return null;
      const l = o.tk.live;
      return {
        powered: l.powered, frame: l.frame, t: l.t, status: l.status, running: l.powered && l.x.length > 0, smoked: l.smoked.slice(),
        issues: l.issues.map((i) => ({ key: i.key, vars: i.vars, text: text(i) })), simSpeed: sig(o.def.live.frameSim * 30, 3), supply: o.tk.instruments.supply, gen: o.tk.instruments.gen,
      };
    },
    benchResult: (s) => {
      const o = defOf(s); if (!o || !o.tk.lastBench) return null;
      const b = o.tk.lastBench, pack = REGIONS.get(s.region);
      return {
        pass: b.pass, stars: b.stars, metrics: b.metrics, costText: formatMinor(b.metrics.cost, pack), smoked: b.smoked, badSamples: b.badSamples,
        pay: b.pay ?? 0, payText: b.pay ? formatMinor(b.pay, pack) : '', measured: b.measured ?? {}, thanks: b.pass ? thanksText(o.def, b.measured) : '',
        /** An exam stamped FIXED at fewer than 3 stars can be sat again: predict again, bench again (the `retryExam` action). */
        retry: b.pass && o.def.eb === true && b.stars < 3,
        predictions: b.predictions.map((p) => ({ ...p, name: o.def.bench.names[p.id] ? t(o.def.bench.names[p.id]!) : p.id, gradeText: t(PREDICT_GRADE[p.grade] ?? 'bench.predict.miss'), gap: p.truth === 0 ? 0 : sig(((p.entered - p.truth) / Math.abs(p.truth)) * 100, 3) })),
        debrief: o.def.figure && b.predictions.length > 0 ? buildDebrief(o.def.figure, b.predictions.map((p) => ({
          id: p.id, name: o.def.bench.names[p.id] ? t(o.def.bench.names[p.id]!) : p.id, unit: ((sp) => (sp?.kind === 'predict' && sp.unit ? sp.unit : p.id === 'pie2' || (sp?.kind === 'predict' && sp.of.probe.trim().toLowerCase().startsWith('i(')) ? 'A' : 'V'))(o.def.bench.specs.find((x) => x.id === p.id)),
          entered: p.entered, truth: sig(p.truth, 5), gapPct: p.truth === 0 ? 0 : sig(((p.entered - p.truth) / Math.abs(p.truth)) * 100, 3), grade: p.grade, gradeText: t(PREDICT_GRADE[p.grade] ?? 'bench.predict.miss'),
        })), b.stars, b.pass, b.measured) : null,
        specs: b.specs.map((x) => ({ ...x, name: t(x.key) })),
        failures: b.failures.map((f) => ({ key: f.key, vars: f.vars, text: explainedText(f, o.tk, o.def, Math.max(0, (s.progress.tickets[o.tk.id]?.attempts ?? 1) - 1) + s.progress.failureLog.filter((x) => x.ticket === o.tk.id).length - b.smoked.length) })).filter((f, i, all) => all.findIndex((g) => g.text === f.text) === i),
      };
    },
    /** An explainer from the failure log (the player's own numbers, DESIGN §7.3); `id` is the failure id. */
    explain: (s, id?: unknown) => {
      const f = s.progress.failureLog.find((x) => x.id === id);
      if (!f) return null;
      const o = defOf(s), ctxTk = o && o.tk.id === f.ticket ? o : null;
      const raw = { key: f.kind, vars: f.vars }, up = explainFailure(raw, explainCtx(ctxTk?.tk ?? null, ctxTk?.def, s.progress.failureLog.filter((x) => x.ticket === f.ticket && x.id < f.id).length));
      return { id: f.id, ticket: f.ticket, tick: f.tick, key: up.key, vars: up.vars, text: text(up) };
    },
    failureLog: (s) => s.progress.failureLog.map((f) => { const o = defOf(s); return { id: f.id, ticket: f.ticket, tick: f.tick, kind: f.kind, text: say(f.kind, o && o.tk.id === f.ticket ? nameVars(o.tk.board, f.vars) : f.vars) }; }),
    /** The catalogue as the tray shows it: bin parts (default while a ticket is open) or all, with allowed values, variants and prices. */
    parts: (s, binOnly?: unknown) => {
      const o = defOf(s), only = binOnly === undefined ? !!o : binOnly === true, pack = REGIONS.get(s.region);
      return PARTS.filter((d) => !(only && o && s.mode !== 'sandbox' && !o.def.bin.some((b) => b.partId === d.id))).map((d) => {
        const entry = o && s.mode !== 'sandbox' ? o.def.bin.find((b) => b.partId === d.id) ?? null : null;
        return {
          id: d.id, kind: d.kind, name: t(d.nameKey), footprint: d.footprint, pins: d.pins, scope: d.scope, verified: d.verified, inBin: !o || s.mode === 'sandbox' || !!entry,
          values: allowedValues(d, entry), unavailable: pack.data.unavailable.includes(d.id),
          variants: allowedVariants(d, entry).map((id) => { const v = d.variants.find((x) => x.id === id)!; const price = partPrice(pack, d.id, id, d.values ? d.values[0]! : null); return { id, ratings: v.ratings, price, priceText: formatMinor(price, pack) }; }),
        };
      });
    },
    /** The candidate actions the agents and personas choose from (probe-filtered by the core env). */
    legalActions: (s, full?: unknown) => candidateActions(s, defs, full === true),
    caps: () => ({ undo: UNDO_CAP, failureLog: FAILURE_LOG_CAP, scopePoints: SCOPE_POINTS_CAP }),
  };
  Object.assign(Q, makeUiQueries({ defs, Q, mine: mineSolution, regionString, explained: explainedText }));
  return Q;
}

/** Resistance between the DMM leads with every source zeroed and 1 mA pushed in: the DMM ohm range (never from the powered state). */
function measureOhms(tk: TicketState, def: LevelDef): number | null {
  const m = tk.board.meter;
  if (m.pads.length < 2) return null;
  const rig = liveRig(tk, def), ckt = rig.circuit;
  if (!ckt || rig.errors.length > 0) return null;
  const a = rig.padNode(m.pads[0]!), b = rig.padNode(m.pads[1]!); if (a === null || b === null) return null;
  const nl = rig.netlist, ia = nl.nodeNames.indexOf(a), ib = nl.nodeNames.indexOf(b);
  const els: Element[] = nl.elements.map((e) => {
    if (e.kind === 'BAT') return { ...e, p: { ...e.p, emf: 0 } };
    if (e.kind === 'BENCH' || e.kind === 'V') { const { wave: _w, ...rest } = e; return { ...rest, p: { ...e.p, v: 0 } }; }
    return e;
  });
  els.push({ id: 'ohm.i', kind: 'I', owner: '', nodes: [ib, ia], p: { i: 1e-3 } });
  const r = compileNetlist({ ...nl, elements: els });
  if (!r.ok) return null;
  const op = solveOp(r.circuit); if (!op.ok) return null;
  const k = (n: string): number => r.circuit.nodeIndex[n]!;
  return (nodeVoltage(op.x, k(a)) - nodeVoltage(op.x, k(b))) / 1e-3;
}

// ---------------------------------------------------------------- candidate actions
const SPOTS: Pad[] = [[3, 8], [9, 8], [15, 8], [3, 12], [9, 12], [15, 12], [20, 6]];
export function candidateActions(s: Readonly<NodeState>, defs: readonly LevelDef[], full: boolean): { name: string; args?: unknown[] }[] {
  const out: { name: string; args?: unknown[] }[] = [];
  if (!s.ticket) { for (const d of defs) out.push({ name: 'openTicket', args: [d.id] }); return out; }
  const tk = s.ticket, def = levelDefOf(defs, tk.id);
  out.push({ name: 'closeTicket' }, { name: 'power', args: [!tk.live.powered] }, { name: 'advance', args: [2] }, { name: 'runBench' }, { name: 'hint' });
  if (tk.undo.length) out.push({ name: 'undo' }); if (tk.redo.length) out.push({ name: 'redo' });
  for (const u of tk.live.smoked) out.push({ name: 'replaceSmoked', args: [u] });
  if (!def) return out;
  const placed = tk.board.parts.filter((p) => !p.fixed);
  for (const p of placed.slice(0, full ? 40 : 6)) {
    out.push({ name: 'deletePart', args: [p.uid] }, { name: 'rotatePart', args: [p.uid] });
    const d = getDef(p.partId);
    if (d) { const vals = allowedValues(d, def.bin.find((b) => b.partId === p.partId) ?? null); if (vals && vals.length > 1) { out.push({ name: 'setValue', args: [p.uid, vals[0]] }, { name: 'setValue', args: [p.uid, vals[vals.length - 1]] }); } }
  }
  for (const w of tk.board.wires.filter((x) => !x.fixed).slice(0, full ? 40 : 6)) out.push({ name: 'deleteWire', args: [w.wid] });
  for (const b of def.bin) {
    const d = getDef(b.partId); if (!d) continue;
    const vals = allowedValues(d, b), pick = vals ? [vals[0]!, vals[Math.floor(vals.length / 2)]!, vals[vals.length - 1]!].filter((v, i, a) => a.indexOf(v) === i) : [null];
    for (const v of pick) for (const sp of SPOTS.slice(0, full ? SPOTS.length : 4)) out.push({ name: 'placePart', args: [b.partId, v, null, sp[0], sp[1], 0, false] });
  }
  // wires between the interesting pads (pins and connectors), L-shaped
  const pads: Pad[] = [...tk.board.connectors.map((c) => c.pad)];
  for (const p of tk.board.parts) { const d = getDef(p.partId); if (d) pads.push(...pinPads(p, d)); }
  const uniq = pads.filter((p, i) => pads.findIndex((q) => q[0] === p[0] && q[1] === p[1]) === i).sort((a, b) => a[1] - b[1] || a[0] - b[0]);
  let n = 0;
  for (let i = 0; i < uniq.length && n < (full ? 60 : 16); i++) for (let j = i + 1; j < uniq.length && n < (full ? 60 : 16); j++) {
    const a = uniq[i]!, z = uniq[j]!;
    if (a[0] === z[0] || a[1] === z[1]) out.push({ name: 'addWire', args: [[a, z]] }); else out.push({ name: 'addWire', args: [[a, [z[0], a[1]], z]] });
    n++;
  }
  if (tk.board.connectors.length > 0) { out.push({ name: 'attachProbe', args: [1, tk.board.connectors[0]!.pad] }); out.push({ name: 'setMeter', args: ['dcv', [tk.board.connectors[0]!.pad]] }); }
  return out;
}
