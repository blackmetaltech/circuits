// UI-facing queries for chapter 1 (docs/API-CH1.md): bench, liveFrame, coach, dmm, wallet, chapterMap, ghost, and the shoebox / target-band
// extensions of ticketCard and scope. Everything here is a read-only function of the state; the engine owns every number, the UI draws them.
// (The dots' speed, LED bloom / mood and rating ratios are computed here, with dmath, so the front end contains no physics.)
import { dmath } from '@core/numerics';
import type { QueryFn } from '@core/kit';
import type { LevelDef, CoachAnchor } from '../data/levels/types';
import type { PartDef } from '../data/parts/types';
import type { Pad } from '../sim/board/types';
import { pinPads } from '../sim/board/footprints';
import { makeProbe } from '../sim/mna/tran';
import { si, sig } from '../sim/explain';
import type { Circuit } from '../sim/mna/types';
import type { Rig } from '../sim/rig';
import { t } from '../i18n';
import { REGIONS } from '../regions';
import { formatMinor } from '../regions/data';
import { allowedValues, allowedVariants, checkPartSpot, getDef, problem } from './board';
import { partPrice } from './metrics';
import type { NodeState, TicketState } from './state';
import { isUnlocked, levelDefOf } from './tickets';
import { liveRig, probeOn } from './ticket-run';
import { say } from './text';
import { danglingEnds, openPins, pinLabel } from './touch';
import { capFirst, nameVars, partNames } from './names';

export interface Sol { rig: Rig; ckt: Circuit; x: Float64Array; state: number[] }
export interface UiDeps {
  defs: readonly LevelDef[];
  Q: Record<string, QueryFn<NodeState>>;
  mine: (tk: TicketState, def: LevelDef) => Sol | null;
  regionString: (region: string, key: string) => string;
  /** Failure -> English with the player's own numbers (queries.ts explainedText). */
  explained?: (f: { key: string; vars: Record<string, string | number> }, tk: TicketState | null, def: LevelDef | undefined, prior?: number) => string;
}

const unitOf = (d: PartDef): string => (d.kind === 'C' || d.kind === 'CE' ? 'F' : d.kind === 'L' ? 'H' : ['R', 'POT', 'HEATER', 'SPEAKER', 'MOTOR', 'SLIDEWIRE'].includes(d.kind) ? 'Ω' : d.id.startsWith('ideal-vsource') ? 'V' : '');
const LN10 = dmath.log(10);
const log10 = (x: number): number => dmath.log(x) / LN10;
const clamp = (x: number, lo: number, hi: number): number => (x < lo ? lo : x > hi ? hi : x);
const r4 = (x: number): number => (Number.isFinite(x) ? Math.round(x * 1e4) / 1e4 : 0);

/** Dot speed in pads per second, signed by direction (DESIGN §5.2): log10(|I| / 1 uA) clamped to [0.2, 6], zero below 1 nA. */
export function dotSpeed(i: number): number {
  const a = Math.abs(i);
  if (!(a > 1e-9)) return 0;
  const v = clamp(0.2 + ((log10(a / 1e-6) + 0) / 6) * 5.8, 0.2, 6);
  return r4(i < 0 ? -v : v);
}
/** LED glow 0..1 proportional to log current between 10 uA and 30 mA (the absolute maximum). */
export function ledBloom(i: number): number { return i > 1e-5 ? r4(clamp(log10(i / 1e-5) / log10(30e-3 / 1e-5), 0, 1)) : 0; }
/** Cute-mode mood of an LED from its current: sleepy below 2 mA, happy in spec, sweating above 20 mA, cracked once it has failed. */
export function ledMood(i: number, smoked: boolean): 'sleepy' | 'happy' | 'sweating' | 'cracked' { return smoked ? 'cracked' : i < 2e-3 ? 'sleepy' : i <= 20e-3 ? 'happy' : 'sweating'; }

// ---------------------------------------------------------------- coach conditions
function wired(tk: TicketState, def: LevelDef): boolean {
  const placed = tk.board.parts.filter((p) => !p.fixed);
  if (placed.length === 0) return false;
  const conn = liveRig(tk, def).conn;
  return placed.every((p) => (conn.pinNodes[p.uid] ?? []).every((n) => { const nd = conn.nodes[n]; return !!nd && (nd.pins.length > 1 || nd.connectors.length > 0); }));
}

export function evalCond(expr: string | undefined, s: NodeState, tk: TicketState, def: LevelDef, deps: UiDeps): boolean {
  if (!expr) return true;
  return expr.split('&').every((term) => term.split('|').some((raw) => {
    const neg = raw.startsWith('!'), atom = neg ? raw.slice(1) : raw;
    let v: boolean;
    if (atom === 'always') v = true;
    else if (atom.startsWith('part:')) v = tk.board.parts.some((p) => !p.fixed && p.partId === atom.slice(5));
    else if (atom === 'wired') v = wired(tk, def);
    else if (atom === 'powered') v = tk.live.powered;
    else if (atom === 'flowing') v = tk.live.powered && tk.live.x.length > 0;
    else if (atom === 'smoked') v = tk.live.smoked.length > 0;
    else if (atom === 'benched') v = tk.lastBench !== null;
    else if (atom === 'passed') v = !!tk.lastBench?.pass;
    else if (atom === 'failed') v = !!tk.lastBench && !tk.lastBench.pass;
    else if (atom === 'probing') v = tk.board.probes.length > 0 || (tk.board.meter.mode !== 'off' && tk.board.meter.pads.length === 2);
    else if (atom === 'probed') v = tk.probed === true;
    else if (atom.startsWith('joined:')) {   // the named connector has a part leg on its node (the A pad is where the junction must be, not just anywhere)
      const c = tk.board.connectors.find((x) => x.id === atom.slice(7)), conn = liveRig(tk, def).conn, n = c ? conn.nodeOfPad(c.pad) : -1;
      v = n >= 0 && (conn.nodes[n]?.pins.length ?? 0) > 0;
    }
    else if (atom === 'grounded') v = !(liveRig(tk, def).circuit?.issues ?? []).some((i) => i.code === 'island');   // nothing floats free of the GND pad
    else if (atom === 'measured') { const m = deps.Q.meter!(s) as { value: number | null } | null; v = !!m && m.value !== null; }
    else if (atom === 'predicted') v = def.bench.specs.filter((x) => x.kind === 'predict').every((x) => tk.predictions[x.id] !== undefined);
    else if (atom.startsWith('link:')) { const [a, b] = atom.slice(5).split('~'), na = refNode(a ?? '', tk, def), nb = refNode(b ?? '', tk, def); v = na >= 0 && na === nb; }   // two pins / connectors are on one node
    else if (atom.startsWith('shared:')) { const n = refNode(atom.slice(7), tk, def); v = n >= 0 && (liveRig(tk, def).conn.nodes[n]?.pins.length ?? 0) > 1; }   // another leg is on this pin's node
    else if (atom === 'shorted') v = tk.board.meter.mode === 'dca' && tk.board.meter.pads.length === 2;
    else if (atom === 'supplyset') v = def.instruments.supply !== undefined && tk.instruments.supply.v !== def.instruments.supply.v;
    else if (atom === 'answered') v = (def.answers ?? []).every((a) => tk.predictions[a.id] !== undefined);
    else if (atom === 'jockey') v = tk.board.parts.some((p) => p.pos !== undefined && p.fixed === true && getDef(p.partId)?.kind === 'SLIDEWIRE');   // the jockey has been moved at least once
    else v = false;
    return neg ? !v : v;
  }));
}

/** The node a coach reference names: `uid.pin` (a part's pin) or a connector id; -1 when it is not on the board. */
function refNode(ref: string, tk: TicketState, def: LevelDef): number {
  const conn = liveRig(tk, def).conn;
  if (ref.includes('.')) {
    const at = ref.indexOf('.'), uid = ref.slice(0, at), pin = ref.slice(at + 1), p = tk.board.parts.find((x) => x.uid === uid), d = p ? getDef(p.partId) : undefined, i = d ? d.pins.indexOf(pin) : -1;
    return i >= 0 ? (conn.pinNodes[uid]?.[i] ?? -1) : -1;
  }
  const c = tk.board.connectors.find((x) => x.id === ref);
  return c ? conn.nodeOfPad(c.pad) : -1;
}

function resolveAnchor(a: CoachAnchor, tk: TicketState, def: LevelDef): Record<string, unknown> {
  if (a.target === 'bin') { const d = getDef(a.partId); return { target: 'bin', partId: a.partId, name: d ? t(d.nameKey) : a.partId }; }
  if (a.target === 'connector') { const c = tk.board.connectors.find((x) => x.id === a.connector); return { target: 'connector', connector: a.connector, pad: c ? c.pad : null }; }
  if (a.target === 'part') {
    const p = tk.board.parts.find((x) => x.partId === a.partId && !x.fixed) ?? tk.board.parts.find((x) => x.partId === a.partId), d = getDef(a.partId);
    if (!p || !d) return { target: 'bin', partId: a.partId, name: d ? t(d.nameKey) : a.partId };
    const pads = pinPads(p, d), pin = a.pin === undefined ? 0 : Math.max(0, d.pins.indexOf(a.pin));
    return { target: 'part', partId: a.partId, uid: p.uid, pin: d.pins[pin], pad: pads[pin], name: t(d.nameKey) };
  }
  return { target: a.target };
}

const modeLabel = (m: string): string => (m === 'dcv' ? 'V' : m === 'dca' ? 'mA' : m === 'ohm' ? 'Ω' : m === 'acv' ? 'V~' : 'off');

/** Value of every `level` spec at the live solution (the bench's own probes, resolved on the player's board). */
function liveSpecs(sol: Sol, def: LevelDef): { id: string; value: number | null; lo: number; hi: number; inBand: boolean }[] {
  const out: { id: string; value: number | null; lo: number; hi: number; inBand: boolean }[] = [];
  for (const sp of def.bench.specs) {
    if (sp.kind !== 'level') continue;
    const r = sol.rig.resolve(sp.probe);
    let v: number | null = null;
    if (r !== null) { try { v = makeProbe(sol.ckt, r)(sol.x, sol.state); } catch { v = null; } }
    out.push({ id: sp.id, value: v, lo: sp.lo, hi: sp.hi, inBand: v !== null && Number.isFinite(v) && v >= sp.lo && v <= sp.hi });
  }
  return out;
}

const CHAPTER: Record<number, { title: string; blurb: string }> = { 1: { title: 'chapter.1.title', blurb: 'chapter.1.blurb' }, 2: { title: 'chapter.2.title', blurb: 'chapter.2.blurb' } };
const GAUGE_UNIT: Record<string, { display: string; scale: number }> = { A: { display: 'mA', scale: 1000 }, uA: { display: 'µA', scale: 1e6 }, V: { display: 'V', scale: 1 }, W: { display: 'W', scale: 1 } };

/** The scope's target band and lock for the open ticket (null when the ticket has no gauge). */
export function scopeTarget(s: NodeState, tk: TicketState, def: LevelDef, sol: Sol | null): Record<string, unknown> {
  const specs = sol ? liveSpecs(sol, def) : [];
  const g = def.gauge, sp = g ? specs.find((x) => x.id === g.spec) : undefined, spec = g ? def.bench.specs.find((x) => x.id === g.spec) : undefined;
  const live = tk.live.powered && !!sol && tk.live.status !== 'noconv' && tk.live.smoked.length === 0;
  const lockSpecs: Record<string, boolean> = {};
  for (const x of specs) lockSpecs[x.id] = x.inBand;
  const lock = live && specs.length > 0 && specs.every((x) => x.inBand);
  if (!g || !spec || spec.kind !== 'level') return { target: null, gauge: null, lock, lockSpecs };
  const u = GAUGE_UNIT[g.unit]!, c = g.clip ? tk.board.connectors.find((x) => x.id === g.clip) : undefined;
  const lo = g.flip ? -spec.hi : spec.lo, hi = g.flip ? -spec.lo : spec.hi;
  const lo2 = Math.min(lo, hi), hi2 = Math.max(lo, hi);
  const shown = (v: number): number => r4((g.abs ? Math.abs(v) : g.flip ? -v : v) * u.scale);
  const value = sp && sp.value !== null && live ? shown(sp.value) : null;
  // a null detector says which side of balance it is on: the signed reading and which way to slide the jockey (found by moving the jockey a tenth of a millimetre on a copy of the board)
  let signed: number | null = null, slide: 'left' | 'right' | 'on' | null = null;
  if (g.abs && sp && sp.value !== null && live) {
    signed = r4(sp.value * u.scale);
    const half = Math.abs(hi2 - lo2) * u.scale / 2 || Infinity;
    if (Math.abs(signed) <= half) slide = 'on';
    else {
      const wire = tk.board.parts.find((p) => p.fixed && getDef(p.partId)?.kind === 'SLIDEWIRE'), probe = spec.kind === 'level' ? spec.probe : '';
      if (wire && probe) {
        const base = wire.pos ?? 0.5, alt = base + 0.0001 <= 1 ? base + 0.0001 : base - 0.0001;
        const i0 = probeOn(tk.board, def, tk)(probe), i1 = probeOn({ ...tk.board, parts: tk.board.parts.map((p) => (p === wire ? { ...p, pos: alt } : p)) }, def, tk)(probe);
        if (i0 !== null && i1 !== null && i1 !== i0) slide = (-i0 / ((i1 - i0) / (alt - base))) * 1 > 0 ? 'right' : 'left';
      }
    }
  }
  const band = g.abs ? { lo: 0, hi: r4(Math.max(Math.abs(lo2), Math.abs(hi2)) * u.scale) } : { lo: r4(Math.max(0, lo2) * u.scale), hi: r4(Math.min(hi2, 1e6) * u.scale) };
  return {
    target: {
      spec: g.spec, name: def.bench.names[g.spec] ? t(def.bench.names[g.spec]!) : '', quantity: g.unit, unit: u.display, scale: u.scale, lo: band.lo, hi: band.hi,
      mode: g.clip ? 'probe' : 'gauge', clip: c ? { connector: c.id, pad: c.pad } : null,
      // on the connector's pad OR on any other pad of the same node (a clip on R3's top leg is on A as much as a clip on the brass pad)
      clipped: !!c && (() => { const conn = liveRig(tk, def).conn, want = conn.nodeOfPad(c.pad); return tk.board.probes.some((p) => p.ch === 1 && ((p.pad[0] === c.pad[0] && p.pad[1] === c.pad[1]) || (want >= 0 && conn.nodeOfPad(p.pad) === want))); })(),
    },
    gauge: { value, signed, slide, signedText: signed === null ? '' : `${signed > 0 ? '+' : signed < 0 ? '-' : ''}${sig(Math.abs(signed), 4)} ${u.display}`, slideText: slide === null ? '' : say(slide === 'right' ? 'gauge.slide.right' : slide === 'left' ? 'gauge.slide.left' : 'gauge.slide.on'), unit: u.display, text: value === null ? '' : `${value} ${u.display}`, inBand: value !== null && value >= band.lo && value <= band.hi, v: value === null ? [] : Array.from({ length: 256 }, () => value) },
    lock, lockSpecs,
  };
}

export function makeUiQueries(deps: UiDeps): Record<string, QueryFn<NodeState>> {
  const { defs, Q, mine, regionString } = deps;
  const defOf = (s: NodeState): { tk: TicketState; def: LevelDef } | null => { if (!s.ticket) return null; const def = levelDefOf(defs, s.ticket.id); return def ? { tk: s.ticket, def } : null; };
  const pack = (s: NodeState) => REGIONS.get(s.region);
  const text = (f: { key: string; vars: Record<string, string | number> }): string => say(f.key, f.vars);

  const U: Record<string, QueryFn<NodeState>> = {
    /** Everything the bench view draws that is not a per-frame number: board, parts with pin pads, wires, instruments. */
    bench: (s) => {
      const o = defOf(s); if (!o) return null;
      const { tk, def } = o, b = tk.board, rig = liveRig(tk, def), ins = tk.instruments;
      return {
        ticket: def.id, w: b.w, h: b.h, connectors: b.connectors.map((c) => ({ id: c.id, pad: c.pad, role: c.role })),
        parts: b.parts.map((p) => {
          const d = getDef(p.partId)!, pads = pinPads(p, d), v = d.variants.find((x) => x.id === p.variant) ?? d.variants[0]!;
          return {
            uid: p.uid, partId: p.partId, name: t(d.nameKey), kind: d.kind, x: p.x, y: p.y, rot: p.rot, flip: p.flip, fixed: p.fixed === true, value: p.value, valueText: p.value === null ? '' : si(p.value, unitOf(d)),
            variant: p.variant, pos: p.pos ?? null, ratings: v.ratings, smoked: tk.live.smoked.includes(p.uid), pins: d.pins.map((name, i) => ({ name, label: pinLabel(p.partId, name), pad: pads[i]! })),
          };
        }),
        wires: b.wires.map((w) => ({ wid: w.wid, path: w.path, fixed: w.fixed === true })),
        // engraved on the board: the bridge's terminals (the slide wire's A, J, B and the junction C where the plug meets the cable) and the clear slots the parts go in
        marks: b.parts.flatMap((p) => {
          const d = getDef(p.partId)!, pads = pinPads(p, d);
          return d.kind === 'SLIDEWIRE' ? d.pins.map((name, i) => ({ pad: pads[i]!, text: name })) : p.partId === 'cable-loop' && def.id === '2-2' ? [{ pad: pads[0]!, text: 'C' }] : [];
        }),
        slots: (def.slots ?? []).map((sl) => ({ id: sl.id, partId: sl.partId, a: sl.a, b: sl.b, text: t(sl.textKey), filled: b.parts.some((p) => !p.fixed && p.partId === sl.partId) })),
        instruments: {
          powered: tk.live.powered, paused: tk.live.paused === true,
          supply: def.supplies.some((x) => x.kind === 'bench') ? { on: ins.supply.on, v: ins.supply.v, ilim: ins.supply.ilim } : null,
          gen: def.supplies.some((x) => x.kind === 'gen') ? { on: ins.gen.on, shape: ins.gen.shape, f: ins.gen.f, vpp: ins.gen.vpp, offset: ins.gen.offset } : null,
          scope: def.instruments.scope || s.mode === 'sandbox' ? { timePerDiv: ins.scope.timePerDiv, voltsPerDiv: ins.scope.voltsPerDiv, trigger: ins.scope.trigger, probes: b.probes.map((p) => ({ ch: p.ch, pad: p.pad })) } : null,
          dmm: { mode: b.meter.mode, label: modeLabel(b.meter.mode), red: b.meter.red ?? b.meter.pads[0] ?? null, black: b.meter.black ?? b.meter.pads[1] ?? null },
        },
        status: tk.live.status, issues: tk.live.issues.map((i) => ({ key: i.key, text: text(i) })), boardErrors: rig.errors.map((e) => ({ key: e.key, text: text(e) })),
        dangling: danglingEnds(b).map((e) => ({ wid: e.wid, pad: e.pad, text: say('wire.dangling', { pad: `${e.pad[0]},${e.pad[1]}` }) })),
        openPins: openPins(b).map((e) => ({ uid: e.uid, pin: e.pin, pad: e.pad })),
        undoDepth: tk.undo.length, redoDepth: tk.redo.length, benched: tk.lastBench ? { pass: tk.lastBench.pass, stars: tk.lastBench.stars } : null,
      };
    },

    /** One call per frame: node voltages with tint scalars, per-part temperature / power / rating ratio / pin currents / LED bloom, per-wire current and dot speed, failure events. */
    liveFrame: (s) => {
      const o = defOf(s); if (!o) return null;
      const { tk } = o, sol = mine(tk, o.def);
      const nodes = Q.nodes!(s, sol) as { valid: boolean; vmin: number; vmax: number; nodes: unknown[] }, cur = Q.currents!(s, sol) as { valid: boolean; wires: { wid: string; i: number }[]; parts: { uid: string; pins: { name: string; pad: Pad; i: number }[] }[] };
      const th = Q.thermal!(s, sol) as { ambient: number; parts: { uid: string; temp: number; power: number; state: string }[] };
      const rt = Q.ratings!(s, sol) as { valid: boolean; parts: { uid: string; ratio: number; rated: number | null; violations: { what: string; value: number; limit: number; text: string }[] }[] };
      const log = s.progress.failureLog;
      const parts = tk.board.parts.map((p) => {
        const d = getDef(p.partId)!, c = cur.parts.find((x) => x.uid === p.uid), h = th.parts.find((x) => x.uid === p.uid), r = rt.parts.find((x) => x.uid === p.uid);
        const smoked = tk.live.smoked.includes(p.uid), iPin = c ? Math.abs(c.pins[0]?.i ?? 0) : 0;
        const o2: Record<string, unknown> = {
          uid: p.uid, temp: h?.temp ?? th.ambient, power: sig(h?.power ?? 0, 5), state: smoked ? 'smoke' : (h?.state ?? 'normal'), smoked,
          ratio: r ? r4(r.ratio) : 0, rated: r?.rated ?? null, violations: r?.violations ?? [],
          pins: (c?.pins ?? []).map((q) => ({ name: q.name, pad: q.pad, i: sig(q.i, 5), speed: dotSpeed(q.i) })),
        };
        if (d.kind === 'METER' && d.model.fs !== undefined) {   // the galvanometer: the needle is the signed current in units of full scale (+ pin in), clamped a little past the stops
          const iSig = c?.pins[0]?.i ?? 0, fs = d.model.fs;
          Object.assign(o2, { galvo: { i: sig(iSig, 5), uA: r4(iSig * 1e6), needle: r4(clamp(iSig / fs, -1.15, 1.15)), fs } });
        }
        if (d.kind === 'LED') Object.assign(o2, { led: { i: sig(iPin, 5), mA: r4(iPin * 1000), bloom: smoked ? 0 : ledBloom(iPin), mood: ledMood(iPin, smoked) } });
        return o2;
      });
      const events = tk.live.smoked.map((uid) => {
        const f = [...log].reverse().find((x) => x.ticket === tk.id && x.vars.part === uid), pd = tk.board.parts.find((p) => p.uid === uid), d = pd ? getDef(pd.partId) : undefined;
        const kind = !d ? 'smoke' : ['LED', 'D', 'Z', 'SCHOTTKY', 'NPN', 'PNP', 'DARLINGTON', 'NMOS'].includes(d.kind) ? 'crack' : d.kind === 'CE' ? 'vent' : 'smoke';
        return { part: uid, kind, failureId: f?.id ?? null, key: f?.kind ?? 'smoke.thermal', text: tk.live.notes?.[uid] ?? (f ? (deps.explained ? deps.explained({ key: f.kind, vars: f.vars }, tk, o.def, log.filter((x) => x.ticket === tk.id && x.id < f.id).length + (s.progress.tickets[tk.id]?.attempts ?? 0)) : say(f.kind, nameVars(tk.board, f.vars))) : '') };
      });
      return {
        valid: !!sol, powered: tk.live.powered, paused: tk.live.paused === true, frame: tk.live.frame, t: tk.live.t, status: tk.live.status,
        issues: tk.live.issues.map((i) => ({ key: i.key, text: text(i) })),
        vmin: sig(nodes.vmin, 5), vmax: sig(nodes.vmax, 5), nodes: (nodes.nodes as { v: number; norm: number }[]).map((n) => ({ ...n, v: sig(n.v, 5), norm: r4(n.norm) })), ambient: th.ambient,
        parts, wires: cur.wires.map((w) => ({ wid: w.wid, i: sig(w.i, 5), speed: dotSpeed(w.i) })), events,
      };
    },

    /** Wren's coach: every step with its text, the active one, and its anchor resolved to an object / pad on the board. */
    coach: (s) => {
      const o = defOf(s); if (!o) return null;
      const { tk, def } = o, steps = def.coach ?? [];
      const vars = { customer: regionString(s.region, `customer.${def.customer}`), mentor: regionString(s.region, 'mentor') };
      const rows = steps.map((st) => ({ id: st.id, text: t(st.key, vars), done: evalCond(st.done, s, tk, def, deps), shown: evalCond(st.when, s, tk, def, deps), anchor: resolveAnchor(st.anchor, tk, def), active: false, optional: st.optional === true }));
      // an optional measuring step never holds the coach back: the next required step is active, and the optional one rides along as "Optional: ..."
      const act = rows.find((r) => r.shown && !r.done && !r.optional) ?? rows.find((r) => r.shown && !r.done);
      const opts = rows.filter((r) => r.optional && r.shown && !r.done && r !== act && (act ? rows.indexOf(r) < rows.indexOf(act) : true));
      if (act) { act.active = true; if (opts.length > 0 && !act.optional) act.text = `${act.text} ${t('coach.optional', { text: opts[0]!.text })}`; }
      // numbered like the notebook reads: only the main line counts (a smoke branch or an optional meter step never takes a number, so the numbers never skip or move)
      const mainLine = steps.map((st) => st.optional !== true && !(st.when ?? '').split(/[&|]/).includes('smoked'));
      const stepTotal = mainLine.filter(Boolean).length, stepNo = act ? mainLine.slice(0, rows.indexOf(act)).filter(Boolean).length + 1 : stepTotal;
      const base = { ticket: def.id, steps: rows as Record<string, unknown>[], active: act ? act.id : null, text: act ? act.text : '', anchor: act ? act.anchor : null, done: rows.filter((r) => r.done && r.shown).length, total: rows.length, stepNo, stepTotal };
      // a part has burned: say so, whatever step the ticket is on (never carry on to "clip the meter")
      const ownBurnStep = act !== undefined && (steps.find((st) => st.id === act.id)?.when ?? '').split(/[&|]/).includes('smoked');
      if (tk.live.smoked.length > 0 && !tk.lastBench?.pass && !ownBurnStep) {
        const names = partNames(tk.board), burnt = tk.live.smoked.map((u) => names[u] ?? t('name.part.some')).join(' and ');
        const pd = tk.board.parts.find((p) => p.uid === tk.live.smoked[0]), d = pd ? getDef(pd.partId) : undefined;
        const text = t('coach.burned', { part: burnt, Part: capFirst(burnt) });
        const anchor = pd && d ? { target: 'part', partId: pd.partId, uid: pd.uid, pin: d.pins[0], pad: pinPads(pd, d)[0], name: t(d.nameKey) } : { target: 'bench' };
        if (act) act.active = false;
        return { ...base, steps: [{ id: 'burned', text, done: false, shown: true, anchor, active: true, optional: false }, ...rows], active: 'burned', text, anchor };
      }
      return base;
    },

    /** The DMM: dial position, lead pads, the reading in SI and as the display shows it. */
    dmm: (s) => {
      const o = defOf(s); if (!o) return null;
      const m = Q.meter!(s) as { mode: string; pads: Pad[]; value: number | null; unit: string; valid: boolean; floating?: boolean; text: string };
      const b = o.tk.board.meter, mA = m.mode === 'dca' && m.value !== null;
      const wrongWay = m.value !== null && m.value < 0;
      let note = '';
      if (m.mode !== 'off' && m.pads.length < 2) note = t('meter.leads');
      else if (m.pads.length === 2 && m.mode !== 'off' && !m.valid && o.tk.live.powered) note = m.mode === 'ohm' ? '' : t('meter.sameNode');
      else if (m.floating && m.valid && m.mode === 'dcv') note = t('meter.floating');
      return {
        mode: m.mode, label: modeLabel(m.mode), red: b.red ?? b.pads[0] ?? null, black: b.black ?? b.pads[1] ?? null, valid: m.valid, value: m.value === null ? null : sig(m.value, 6), unit: m.unit,
        display: { value: m.value === null ? null : r4(mA ? m.value! * 1000 : m.value), unit: mA ? 'mA' : m.unit, text: m.text }, negative: wrongWay, note,
      };
    },

    wallet: (s) => {
      const pk = pack(s), lp = s.ticket?.lastBench?.pay ?? 0;
      return { minor: s.progress.wallet, text: formatMinor(s.progress.wallet, pk), code: pk.currency.code, symbol: pk.currency.symbol, decimals: pk.currency.decimals, lastPay: lp, lastPayText: lp > 0 ? formatMinor(lp, pk) : '' };
    },

    /** Chapter 1 as Wren's notebook page: the tickets as pinned chits with state, stars, fee and page position. */
    chapterMap: (s, chapter?: unknown) => {
      const ch = typeof chapter === 'number' ? chapter : 1, pk = pack(s);
      const list = defs.filter((d) => d.chapter === ch);
      const tickets = list.map((d) => {
        const p = s.progress.tickets[d.id], unlocked = isUnlocked(d, (a) => !!s.progress.tickets[a]?.passed), passed = !!p?.passed;
        return {
          id: d.id, title: t(d.titleKey), customerId: d.customer, customer: regionString(s.region, `customer.${d.customer}`), eb: d.eb === true, teaches: d.teaches, scope: d.scope,
          unlocked, passed, stars: p?.stars ?? 0, attempts: p?.attempts ?? 0, state: !unlocked ? 'locked' : !passed ? 'open' : (p?.stars ?? 0) >= 2 ? 'done' : 'passed',
          fee: d.pay?.fee ?? 0, feeText: d.pay ? formatMinor(d.pay.fee, pk) : '', perStar: d.pay?.perStar ?? 0, payText: d.pay ? t('pay.explain', { fee: formatMinor(d.pay.fee, pk), perStar: formatMinor(d.pay.perStar, pk) }) : '', starsMax: d.eb ? 3 : 2, spec: d.specShort ? t(d.specShort) : ((x) => (x && d.bench.names[x.id] ? t(d.bench.names[x.id]!) : ''))(d.bench.specs.find((x) => x.kind === 'level')), after: d.after ?? [], chit: d.chit ?? { x: 0.5, y: 0.5 },
          best: p?.best ? { ...p.best, costText: formatMinor(p.best.cost, pk) } : null,
        };
      });
      return {
        chapter: ch, title: t(CHAPTER[ch]?.title ?? 'chapter.1.title'), blurb: t(CHAPTER[ch]?.blurb ?? 'chapter.1.blurb', { mentor: regionString(s.region, 'mentor'), stall: regionString(s.region, 'stall'), lane: regionString(s.region, 'lane') }),
        tickets, starsEarned: tickets.reduce((a, x) => a + x.stars, 0), starsTotal: list.reduce((a, d) => a + (d.eb ? 3 : 2), 0),
        complete: tickets.length > 0 && tickets.every((x) => x.passed), open: s.ticket?.id ?? null,
      };
    },

    /** Ghost of a part before release: its pin pads under the given placement and whether it fits. */
    ghost: (s, partId?: unknown, x?: unknown, y?: unknown, rot?: unknown, flip?: unknown) => {
      const o = defOf(s); if (!o) return null;
      const d = typeof partId === 'string' ? getDef(partId) : undefined;
      if (!d) return { ok: false, partId: String(partId), pins: [], problem: say('err.part.unknown', { id: String(partId), near: '-' }) };
      const xi = typeof x === 'number' ? Math.round(x) : 0, yi = typeof y === 'number' ? Math.round(y) : 0, ri = (typeof rot === 'number' ? ((Math.round(rot) % 4) + 4) % 4 : 0) as 0 | 1 | 2 | 3;
      const geo = { x: xi, y: yi, rot: ri, flip: flip === true }, pads = pinPads(geo, d), bad = checkPartSpot(o.tk.board, d, geo) ?? null;
      const p = bad ?? problem('');
      return { ok: bad === null, partId: d.id, pins: d.pins.map((name, i) => ({ name, pad: pads[i]! })), problem: bad ? say(p.key, p.vars) : null };
    },

    /** The shoebox: the ticket's parts as a box of parts with prices (also in `ticketCard.shoebox`). */
    shoebox: (s) => { const o = defOf(s); return o ? shoebox(s, o.tk, o.def) : null; },
  };
  return U;
}

/** The shoebox: the ticket bin as parts with allowed values, variants (ratings) and prices. */
export function shoebox(s: NodeState, tk: TicketState, def: LevelDef): unknown[] {
  const pk = REGIONS.get(s.region);
  return def.bin.map((b) => {
    const d = getDef(b.partId)!, values = allowedValues(d, b), vs = allowedVariants(d, b), placed = tk.board.parts.filter((p) => !p.fixed && p.partId === b.partId).length;
    return {
      partId: b.partId, name: t(d.nameKey), kind: d.kind, footprint: d.footprint, pins: d.pins, values, unit: unitOf(d), max: b.max ?? null, placed,
      variants: vs.map((id) => { const v = d.variants.find((x) => x.id === id)!, price = partPrice(pk, d.id, id, values ? values[0]! : null); return { id, ratings: v.ratings, price, priceText: price > 0 ? formatMinor(price, pk) : '' }; }),
    };
  });
}
