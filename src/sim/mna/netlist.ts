// Netlist: (1) a SPICE-like card parser for oracle tests and agents, (2) board → netlist expansion with a per-PartKind registry.
//
// CARDS (case-insensitive, `*` comment line, `;` trailing comment, `+` continuation, `.end` stops):
//   R1 a b 4k        resistor            V1 in 0 12 | V1 in 0 DC 12 [AC 1]   voltage source (a = +)
//   I1 a b 0.5       current source a→b through the source (so `I1 0 n 5m` pushes 5 mA INTO n)
//   E1 a b c d 2     VCVS (v(a)−v(b) = 2·(v(c)−v(d)))     G1 a b c d 1e-3   VCCS (current a→b through the element)
//   T1 p1 p2 s1 s2 10 [rp=.. rs=.. lm=..]   ideal transformer, turns ratio Np/Ns, dots at p1 / s1 (devices/xfmr.ts)
//   C1 a 0 1u        capacitor      L1 a b 1m  inductor      D1 a k model    diode       .model name type (k=v …)
//   Node `0` / `gnd` is ground. Values take engineering suffixes: f p n u µ m k meg g t (SPICE: m = milli, meg = 1e6). Trailing unit
//   letters are ignored (`10kohm`). Cards give kinds R V I E G C L D; BAT / BENCH / AM come from boards or are built directly.
//
// BOARD EXPANSION: `boardToNetlist(board, getDef)` runs `buildConnectivity`, then each part's PartKind expander (EXPANDERS).
//   To support a new kind (diode, BJT, ...): add `EXPANDERS.D = ...` below (one entry). Element ids are the part uid ('p3'), with
//   '.suffix' when a part makes several elements ('p3.aw'); `owner` is always the part uid so power / ratings attribute back.
//   Assumed catalogue conventions (documented here, not in types.ts): R → part.value (Ω) else def.model.R; MISC with model.emf
//   (+ model.r) is a battery (pins ['+','-']); MISC with model.bench is a bench supply (set voltage part.value, def.model.ilim);
//   METER: variant 'A' or model.burden → ammeter (burden def.model.burden ?? 0.1 Ω) else voltmeter / scope probe 10 MΩ (model.rin);
//   POT pins [A, W, B]: R(A–W) = α·R, R(W–B) = (1−α)·R with α = part.pos ?? 0.5; HEATER/SPEAKER/MOTOR/FUSE/NTC: resistor model.R.
import type { PartDef, PartKind } from '../../data/parts/types';
import type { Board, PlacedPart } from '../board/types';
import { buildConnectivity, type BoardError, type Connectivity } from '../board/connectivity';
import type { Element, Netlist, Params } from './types';
import { MACRO_TYPES, comparatorParams, fuseParams, opampParams, regulatorParams, relayParams, timerParams } from './devices/macros';
import { ntcResistance } from './devices/ntc';

// ---------------------------------------------------------------- values
const SUFFIX: [string, number][] = [['meg', 6], ['mil', 0], ['f', -15], ['p', -12], ['n', -9], ['u', -6], ['µ', -6], ['m', -3], ['k', 3], ['g', 9], ['t', 12]];

/** Parse "4.7k", "1e-3", "10meg", "2u2"-style is NOT supported. Throws on garbage. Exact: builds "<mantissa>e<exp>" for parseFloat. */
export function parseValue(tok: string): number {
  const m = /^([+-]?(?:\d+\.?\d*|\.\d+))(?:e([+-]?\d+))?([a-zµ]*)$/i.exec(tok.trim());
  if (!m) throw new NetlistError(`bad number '${tok}'`);
  let exp = m[2] ? parseInt(m[2], 10) : 0;
  const suf = m[3].toLowerCase();
  if (suf) {
    const hit = SUFFIX.find(([s]) => suf.startsWith(s));
    if (hit && hit[0] !== 'mil') exp += hit[1];
    else if (hit) return parseFloat(`${m[1]}e${exp}`) * 25.4e-6;
  }
  return parseFloat(`${m[1]}e${exp}`);
}

export class NetlistError extends Error { constructor(msg: string, readonly line = 0) { super(line ? `line ${line}: ${msg}` : msg); this.name = 'NetlistError'; } }

// ---------------------------------------------------------------- builder
export class NetlistBuilder {
  private names: string[] = ['0'];
  private ids = new Map<string, number>([['0', 0]]);
  elements: Element[] = [];
  models: Record<string, Params> = {};
  modelTypes: Record<string, string> = {};
  /** Node id for a name ('0'/'gnd' → 0); creates on first use (ids in order of first appearance). */
  node(name: string): number {
    const k = name.toLowerCase(); if (k === '0' || k === 'gnd') return 0;
    let id = this.ids.get(k);
    if (id === undefined) { id = this.names.length; this.ids.set(k, id); this.names.push(k); }
    return id;
  }
  add(el: Element): void { this.elements.push(el); }
  build(): Netlist { return { nodeNames: this.names.slice(), elements: this.elements.slice(), models: { ...this.models }, modelTypes: { ...this.modelTypes } }; }
}

const CARD: Record<string, { kind: string; nodes: number; key?: string; model?: boolean }> = {
  R: { kind: 'R', nodes: 2, key: 'r' }, V: { kind: 'V', nodes: 2, key: 'v' }, I: { kind: 'I', nodes: 2, key: 'i' },
  E: { kind: 'E', nodes: 4, key: 'gain' }, G: { kind: 'G', nodes: 4, key: 'gm' }, C: { kind: 'C', nodes: 2, key: 'c' },
  L: { kind: 'L', nodes: 2, key: 'l' }, D: { kind: 'D', nodes: 2, model: true },
  Q: { kind: 'Q', nodes: 3, model: true }, M: { kind: 'M', nodes: 3, model: true },
  T: { kind: 'T', nodes: 4, key: 'n' },
};

/** Parse cards into a Netlist. @throws NetlistError (developer-facing; cards are authored by tests and agents, not players). */
export function parseNetlist(text: string): Netlist {
  const b = new NetlistBuilder();
  const lines: { n: number; s: string }[] = [];
  text.split(/\r?\n/).forEach((raw, i) => {
    const s = raw.replace(/;.*$/, '').trim();
    if (!s || s.startsWith('*')) return;
    if (s.startsWith('+') && lines.length) lines[lines.length - 1].s += ' ' + s.slice(1).trim(); else lines.push({ n: i + 1, s });
  });
  const seen = new Set<string>();
  for (const { n, s } of lines) {
    const tok = s.split(/\s+/);
    const head = tok[0];
    if (head.startsWith('.')) {
      const d = head.toLowerCase();
      if (d === '.end') break;
      if (d === '.model') {
        if (tok.length < 3) throw new NetlistError('.model needs a name and a type', n);
        const rest = tok.slice(2).join(' ').replace(/[()]/g, ' ').trim().split(/\s+/);
        b.modelTypes[tok[1].toLowerCase()] = rest[0].toLowerCase();
        const p: Params = {};
        for (const kv of rest.slice(1)) { const [k, v] = kv.split('='); if (v === undefined) throw new NetlistError(`.model parameter '${kv}' needs =value`, n); p[k.toLowerCase()] = parseValue(v); }
        b.models[tok[1].toLowerCase()] = p;
        continue;
      }
      if (d === '.title' || d === '.op' || d === '.options') continue;
      throw new NetlistError(`unsupported directive ${head}`, n);
    }
    if (head[0].toUpperCase() === 'U') {
      // macro card `U1 n1 … nk model`: the terminal count and kind come from the model's type (opamp, cmp, 555, reg, relay, fuse, logic), see macros.ts
      if (seen.has(head.toLowerCase())) throw new NetlistError(`duplicate element name ${head}`, n);
      seen.add(head.toLowerCase());
      if (tok.length < 3) throw new NetlistError(`${head}: expected nodes and a model`, n);
      b.add({ id: head, kind: '', owner: '', nodes: tok.slice(1, -1).map((x) => b.node(x)), p: {}, model: tok[tok.length - 1].toLowerCase() });
      continue;
    }
    const spec = CARD[head[0].toUpperCase()];
    if (!spec) throw new NetlistError(`unknown element '${head}'`, n);
    if (seen.has(head.toLowerCase())) throw new NetlistError(`duplicate element name ${head}`, n);
    seen.add(head.toLowerCase());
    if (tok.length < 1 + spec.nodes + 1) throw new NetlistError(`${head}: expected ${spec.nodes} nodes and a ${spec.model ? 'model' : 'value'}`, n);
    const nodes = tok.slice(1, 1 + spec.nodes).map((x) => b.node(x));
    const p: Params = {};
    let model: string | undefined;
    const args = tok.slice(1 + spec.nodes);
    try {
      if (spec.model) model = args[0].toLowerCase();
      else {
        let k = 0; if (args[0].toLowerCase() === 'dc') k = 1;
        p[spec.key!] = parseValue(args[k]);
        if (spec.kind === 'T') for (const kv of args.slice(k + 1)) { const [kk, vv] = kv.split('='); if (vv !== undefined) p[kk.toLowerCase()] = parseValue(vv); }
        const ai = args.findIndex((a) => a.toLowerCase() === 'ac');
        if (ai >= 0 && args[ai + 1] !== undefined) p.ac = parseValue(args[ai + 1]);
      }
    } catch (e) { throw new NetlistError(`${head}: ${(e as Error).message}`, n); }
    b.add({ id: head, kind: spec.kind, owner: '', nodes, p, ...(model ? { model } : {}) });
  }
  resolveDiodeModels(b);
  resolveTransistorModels(b);
  resolveMacroModels(b);
  return b.build();
}

/** Diode cards `D1 a k model`: copy the `.model` numbers into el.p (device params are plain numbers). Model types `d07` / `ideal` set the
 *  textbook constant-0.7 V variant (p.ideal = 1); an unknown model name gives SPICE defaults (Is 1e-14, N 1). */
function resolveDiodeModels(b: NetlistBuilder): void {
  for (const e of b.elements) {
    if (e.kind !== 'D' || !e.model) continue;
    const ty = b.modelTypes[e.model];
    e.p = { ...(b.models[e.model] ?? {}), ...e.p };
    if (ty === 'd07' || ty === 'ideal07' || ty === 'ideal') e.p.ideal = 1;
  }
}

/** Macro cards `U1 n1 … nk model`: the model type picks the device kind; the `.model` numbers (plus the sim defaults of macros.ts) become el.p. */
function resolveMacroModels(b: NetlistBuilder): void {
  for (const e of b.elements) {
    if (e.kind !== '' || !e.model) continue;
    const ty = b.modelTypes[e.model], mt = ty ? MACRO_TYPES[ty] : undefined;
    if (!mt) throw new NetlistError(`${e.id}: model '${e.model}' is not a macro model (opamp, cmp, 555, reg, relay, fuse, logic)`);
    if (e.nodes.length !== mt.terminals) throw new NetlistError(`${e.id}: a ${ty} has ${mt.terminals} terminals, got ${e.nodes.length}`);
    e.kind = mt.kind;
    e.p = mt.params(b.models[e.model] ?? {});
  }
}

/** Transistor cards `Q1 c b e model` / `M1 d g s model`: copy the `.model` numbers into el.p. Model types npn / pnp / nmos / pmos set the
 *  polarity (p.pol ±1); `vto` is accepted as an alias of `vt`; `ideal=1` on a BJT selects the textbook constant-0.7 V model. */
function resolveTransistorModels(b: NetlistBuilder): void {
  for (const e of b.elements) {
    if ((e.kind !== 'Q' && e.kind !== 'M') || !e.model) continue;
    const ty = b.modelTypes[e.model];
    e.p = { ...(b.models[e.model] ?? {}), ...e.p };
    if (e.p.vto !== undefined && e.p.vt === undefined) e.p.vt = e.p.vto;
    delete e.p.vto;
    e.p.pol = ty === 'pnp' || ty === 'pmos' ? -1 : 1;
    if (e.kind === 'M' && e.p.vt === undefined) e.p.vt = 1;
    if (e.kind === 'M' && e.p.kp === undefined) e.p.kp = 2e-5;
  }
}

// ---------------------------------------------------------------- board expansion
export interface ExpandEnv { /** Ambient / ticket temperature, °C (NTC thermistors read it; default 25). */ tempC?: number }
export interface ExpandCtx { part: PlacedPart; def: PartDef; /** netlist node id of every pin, PartDef.pins order */ nodes: number[]; env?: ExpandEnv }
export type Expander = (x: ExpandCtx) => Element[];

const el = (x: ExpandCtx, kind: string, nodes: number[], p: Params, suffix = ''): Element =>
  ({ id: x.part.uid + (suffix ? '.' + suffix : ''), kind, owner: x.part.uid, nodes, p });
const resistance = (x: ExpandCtx): number => x.part.value ?? x.def.model.R;

const resistor: Expander = (x) => [el(x, 'R', [x.nodes[0], x.nodes[1]], { r: resistance(x) })];
/** C / CE: pins [+, -] (or 1, 2) -> C [a, b], value from the placed part (the catalogue's `c` for a fixed fixture), optional initial voltage `ic` (a pre-charged fixture). A model `rbleed` adds the
 *  textbook parallel bleeder (DESIGN §3.4: the ideal capacitors of the exam bins carry 1 Gohm so a node between two of them still has a DC path). */
const capacitor: Expander = (x) => {
  const m = modelOf(x), p: Params = { c: x.part.value ?? m.c };
  if (m.ic !== undefined) p.ic = m.ic;
  const out = [el(x, 'C', [x.nodes[0], x.nodes[1]], p)];
  if (m.rbleed !== undefined) out.push(el(x, 'R', [x.nodes[0], x.nodes[1]], { r: m.rbleed }, 'bleed'));
  return out;
};
/** LOAD: a fixed resistive fixture (model.R), or a constant-current sink (model.cc: a `CCL` element from pin '+' to pin '-', current = the placed part's value or model.i; the rig gives it its switch-on ramp, `p.ton`). */
const load: Expander = (x) => {
  const m = modelOf(x);
  if (m.cc !== undefined) return [el(x, 'CCL', [x.nodes[0], x.nodes[1]], { i: x.part.value ?? m.i, cc: 1, ton: m.ton ?? 0 })];
  return resistor(x);
};
/** MOTOR (a DC fan, chapter 5): a winding, model.R in series with model.L (one branch, no internal node); without model.L it is a plain resistor. */
const motor: Expander = (x) => (x.def.model.L !== undefined ? [el(x, 'L', [x.nodes[0], x.nodes[1]], { l: x.def.model.L, rs: x.def.model.R ?? 0 })] : resistor(x));
const inductor: Expander = (x) => [el(x, 'L', [x.nodes[0], x.nodes[1]], { l: x.part.value ?? x.def.model.l ?? x.def.model.L })];

/** Diode family (D, LED, Z, SCHOTTKY): pins [A, K]; def.model keys Is / N / Rs / BV / Ibv / Nbv (any case) → device params (lower case);
 *  model.ideal ≠ 0 selects the textbook constant-0.7 V diode (optional model.vf, model.ron). */
const diode: Expander = (x) => {
  const p: Params = {};
  for (const [k, v] of Object.entries(x.def.model)) p[k.toLowerCase()] = v;
  if (p.ideal !== undefined) p.ideal = p.ideal ? 1 : 0;
  if (p.ideal === 0) delete p.ideal;
  return [el(x, 'D', [x.nodes[0], x.nodes[1]], p)];
};

const modelOf = (x: ExpandCtx): Params => { const p: Params = {}; for (const [k, v] of Object.entries(x.def.model)) p[k.toLowerCase()] = v; return p; };
/** Pin NAME → netlist node, so the catalogue's pin order (2N2222A is E B C, 2N7000 is S G D) never matters. */
const pinNode = (x: ExpandCtx, name: string): number => x.nodes[x.def.pins.indexOf(name)];

/** NPN / PNP: pins C B E → Q [C, B, E]; model Is / Bf / Br / Vaf (lower-cased). PNP sets pol −1. */
const bjt = (pol: number): Expander => (x) => {
  const m = modelOf(x), p: Params = { pol };
  for (const k of ['is', 'bf', 'br', 'vaf', 'ideal', 'vf', 'ron', 'vcesat', 'ronc']) if (m[k] !== undefined) p[k] = m[k];   // (ideal = 1: the textbook transistor, constant Vbe 0.7 V and a fixed beta)
  return [el(x, 'Q', [pinNode(x, 'C'), pinNode(x, 'B'), pinNode(x, 'E')], p)];
};
/** DARLINGTON: pins B C E → DAR [C, B, E]. Model: composite hFEmin, Rb, Re. Per-stage bf solves bf·(bf + 1) = hFE (two cascaded stages), per-stage Is 1e-12 A
 *  is an ESTIMATE (power-transistor class; the datasheet gives no junction data). */
const darlington: Expander = (x) => {
  const m = modelOf(x), hfe = m.hfemin ?? 1000, bf = (Math.sqrt(1 + 4 * hfe) - 1) / 2;
  return [el(x, 'DAR', [pinNode(x, 'C'), pinNode(x, 'B'), pinNode(x, 'E')], { is: m.is ?? 1e-12, bf, br: 1, rb: m.rb ?? 8000, re: m.re ?? 120 })];
};
/** NMOS: pins D G S (any order) → M [D, G, S]; model Vt / Kp / lambda (+ optional body diode Dis / Dn). */
const mosfet: Expander = (x) => {
  const m = modelOf(x), p: Params = { vt: m.vt, kp: m.kp, lambda: m.lambda ?? 0, pol: m.pmos ? -1 : 1 };
  if (m.dis !== undefined) p.dis = m.dis;
  if (m.dn !== undefined) p.dn = m.dn;
  return [el(x, 'M', [pinNode(x, 'D'), pinNode(x, 'G'), pinNode(x, 'S')], p)];
};

/** XFMR: pins P1 P2 S1 S2 → T [p1, p2, s1, s2] (dots at P1 / S1). Turns ratio n = model.primaryNominal / model.secRms (the catalogue's nominal pair;
 *  region-pack mains scaling is a caller concern: override with part.value = n). model.Rw → secondary winding resistance rs (ASSUMPTION: the
 *  1.5 Ω of DESIGN §2.8 is the 12 V side), model.Lm → magnetising inductance on the primary. No centre-tap variants exist in the catalogue. */
const transformer: Expander = (x) => {
  const m = modelOf(x), n = x.part.value ?? m.primarynominal / m.secrms, p: Params = { n };
  if (m.rw !== undefined) p.rs = m.rw;
  if (m.lm !== undefined) p.lm = m.lm;
  const out = [el(x, 'T', [pinNode(x, 'P1'), pinNode(x, 'P2'), pinNode(x, 'S1'), pinNode(x, 'S2')], p)];
  // model.Rins: the insulation between the windings and the core / earth (a real transformer's secondary is not infinitely floating): S2 to ground, which pins the secondary's common mode (a numerical reference, ohm)
  if (m.rins !== undefined) out.push(el(x, 'R', [pinNode(x, 'S2'), 0], { r: m.rins }, 'ins'));
  return out;
};

const variantOf = (x: ExpandCtx): PartDef['variants'][number] | undefined => x.def.variants.find((v) => v.id === x.part.variant) ?? x.def.variants[0];

/** OPAMP: single (pins IN+ IN- OUT V+ V-) or dual (IN1+ … OUT2) packages → one OA per channel; model keys (any case) → opampParams defaults (macros.ts).
 *  A dual package's Iq is split between its channels. Unused channels are left with floating inputs (topology warns). */
const opamp: Expander = (x) => {
  const p = opampParams(modelOf(x)), single = x.def.pins.includes('OUT');
  const ch = single ? [['IN+', 'IN-', 'OUT']] : [['IN1+', 'IN1-', 'OUT1'], ['IN2+', 'IN2-', 'OUT2']];
  return ch.map((c, i) => el(x, 'OA', [pinNode(x, c[0]), pinNode(x, c[1]), pinNode(x, c[2]), pinNode(x, 'V+'), pinNode(x, 'V-')], { ...p, iq: p.iq / ch.length }, single ? '' : String(i + 1)));
};
/** CMP (LM393 dual): pins IN1+ IN1- OUT1 GND IN2+ IN2- OUT2 VCC → one CMP per channel (supply V+ = VCC, V− = GND). */
const comparator: Expander = (x) => {
  const p = comparatorParams(modelOf(x)), ch = [['IN1+', 'IN1-', 'OUT1'], ['IN2+', 'IN2-', 'OUT2']];
  return ch.map((c, i) => el(x, 'CMP', [pinNode(x, c[0]), pinNode(x, c[1]), pinNode(x, c[2]), pinNode(x, 'VCC'), pinNode(x, 'GND')], { ...p, iq: p.iq / 2 }, String(i + 1)));
};
/** 555: pins GND TRIG OUT RESET CTRL THR DIS VCC → TMR in that order. */
const timer555: Expander = (x) => [el(x, 'TMR', ['GND', 'TRIG', 'OUT', 'RESET', 'CTRL', 'THR', 'DIS', 'VCC'].map((n) => pinNode(x, n)), timerParams(modelOf(x)))];
/** REG: terminals [IN, REF, OUT], REF = GND (7805) or ADJ (LM317). Catalogue model: Vreg | Vref, Vdo, Isc | Ilim, IminLoad (→ injected into OUT), Iadj, tShutdown, tHyst; variant
 *  thermal: thetaJA, tauS. The 7805's 5 mA Iq to GND is the DESIGN §3.7 value (absent from the catalogue model) and applies when the model has Vreg. */
const regulator: Expander = (x) => {
  const m = modelOf(x), th = variantOf(x)?.thermal;
  const raw: Record<string, number | undefined> = { ...m, vref: m.vref, iqgnd: m.vreg !== undefined ? 5e-3 : undefined, iqout: m.iminload, thetaja: th?.thetaJA, tau: th?.tauS };
  const ref = x.def.pins.includes('GND') ? 'GND' : 'ADJ';
  return [el(x, 'REG', [pinNode(x, 'IN'), pinNode(x, ref), pinNode(x, 'OUT')], regulatorParams(raw))];
};
/** RELAY: pins C1 C2 COM NO NC; model Rcoil Lcoil Ipull Idrop RonContact RoffContact. */
const relay: Expander = (x) => [el(x, 'RLY', ['C1', 'C2', 'COM', 'NO', 'NC'].map((n) => pinNode(x, n)), relayParams(modelOf(x)))];
/** FUSE: Irated from the variant ratings, I²t window from the model (windowS); R_cold is a sim default (macros.ts). */
const fuse: Expander = (x) => [el(x, 'FUSE', [x.nodes[0], x.nodes[1]], fuseParams({ ...modelOf(x), irated: variantOf(x)?.ratings.Irated }))];
/** NTC: R(T) at the environment temperature (default 25 °C) from model R25, B, T0. */
const ntc: Expander = (x) => { const m = modelOf(x); return [el(x, 'R', [x.nodes[0], x.nodes[1]], { r: ntcResistance(m.r25, m.b, x.env?.tempC ?? 25, m.t0 ?? 298.15) })]; };
/** SLIDEWIRE: pins A J B, jockey at part.pos ∈ [0, 1] of the length from A (default 0.5): R(A–J) = Rtotal·pos, R(J–B) = Rtotal·(1 − pos), each floored at 1 µΩ so a jockey at an end stays solvable. */
const slidewire: Expander = (x) => {
  const m = modelOf(x), R = m.rtotal, a = Math.min(1, Math.max(0, x.part.pos ?? 0.5)), floor = m.rmin ?? 1e-6;   // model.rmin: the metre wire never goes below 1 mohm (0.1 mm of wire), which keeps the solve well conditioned
  return [el(x, 'R', [x.nodes[0], x.nodes[1]], { r: Math.max(R * a, floor) }, 'aj'), el(x, 'R', [x.nodes[1], x.nodes[2]], { r: Math.max(R * (1 - a), floor) }, 'jb')];
};

/** Per-PartKind expanders. EXTENSION POINT: add D / LED / Z / NPN / ... here. */
export const EXPANDERS: Readonly<Partial<Record<PartKind, Expander>>> = Object.freeze({
  NPN: bjt(1), PNP: bjt(-1), DARLINGTON: darlington, NMOS: mosfet,
  OPAMP: opamp, CMP: comparator, '555': timer555, REG: regulator, RELAY: relay, FUSE: fuse, NTC: ntc, SLIDEWIRE: slidewire,
  XFMR: transformer, D: diode, LED: diode, Z: diode, SCHOTTKY: diode,
  C: capacitor, CE: capacitor, L: inductor, R: resistor, HEATER: resistor, LOAD: load, SPEAKER: resistor, MOTOR: motor,
  POT: (x) => {
    // wiper α ∈ [alphaMin, alphaMax] when the part model gives them (0.5 % end resistance: a 0 Ω exploit stops here, DESIGN §3.7)
    const R = resistance(x), m = modelOf(x), a = Math.min(m.alphamax ?? 1, Math.max(m.alphamin ?? 0, x.part.pos ?? 0.5));
    return [el(x, 'R', [x.nodes[0], x.nodes[1]], { r: R * a }, 'aw'), el(x, 'R', [x.nodes[1], x.nodes[2]], { r: R * (1 - a) }, 'wb')];
  },
  METER: (x) => {
    const amm = x.part.variant === 'A' || x.def.model.burden !== undefined;
    return amm ? [el(x, 'AM', [x.nodes[0], x.nodes[1]], { r: x.def.model.burden ?? 0.1 })] : [el(x, 'R', [x.nodes[0], x.nodes[1]], { r: x.def.model.rin ?? 10e6 })];
  },
  MISC: (x) => {
    const m = x.def.model;
    if (m.emf !== undefined) return [el(x, 'BAT', [x.nodes[0], x.nodes[1]], { emf: x.part.value ?? m.emf, r: m.r ?? 0 })];
    if (m.bench !== undefined) return [el(x, 'BENCH', [x.nodes[0], x.nodes[1]], { v: x.part.value ?? 0, ilim: m.ilim ?? 1 })];
    return [];
  },
});

export interface ExpandError { code: BoardError['code'] | 'noExpander' | 'noGround' | 'badValue'; uid?: string }
export interface BoardNetlist { netlist: Netlist; conn: Connectivity; errors: ExpandError[] }

/** Board → Netlist (+ the connectivity it came from). Parts without an expander are reported and skipped. */
export function boardToNetlist(board: Board, getDef: (partId: string) => PartDef | undefined, expanders: Readonly<Partial<Record<PartKind, Expander>>> = EXPANDERS, env: ExpandEnv = {}): BoardNetlist {
  const conn = buildConnectivity(board, getDef);
  const errors: ExpandError[] = conn.errors.map((e) => ({ code: e.code, uid: e.uid }));
  if (!conn.hasGround) errors.push({ code: 'noGround' });
  const elements: Element[] = [];
  for (const part of board.parts) {
    const def = getDef(part.partId), nodes = conn.pinNodes[part.uid];
    if (!def || !nodes) continue;
    const ex = expanders[def.kind];
    if (!ex) { errors.push({ code: 'noExpander', uid: part.uid }); continue; }
    for (const e of ex({ part, def, nodes, env })) {
      if (Object.values(e.p).some((v) => typeof v !== 'number' || Number.isNaN(v))) { errors.push({ code: 'badValue', uid: part.uid }); continue; }
      elements.push(e);
    }
  }
  const nodeNames = conn.nodes.map((n) => n.name);
  return { netlist: { nodeNames, elements, models: {}, modelTypes: {} }, conn, errors };
}
