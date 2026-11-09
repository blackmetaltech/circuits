// Netlist: (1) a SPICE-like card parser for oracle tests and agents, (2) board → netlist expansion with a per-PartKind registry.
//
// CARDS (case-insensitive, `*` comment line, `;` trailing comment, `+` continuation, `.end` stops):
//   R1 a b 4k        resistor            V1 in 0 12 | V1 in 0 DC 12 [AC 1]   voltage source (a = +)
//   I1 a b 0.5       current source a→b through the source (so `I1 0 n 5m` pushes 5 mA INTO n)
//   E1 a b c d 2     VCVS (v(a)−v(b) = 2·(v(c)−v(d)))     G1 a b c d 1e-3   VCCS (current a→b through the element)
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
        const ai = args.findIndex((a) => a.toLowerCase() === 'ac');
        if (ai >= 0 && args[ai + 1] !== undefined) p.ac = parseValue(args[ai + 1]);
      }
    } catch (e) { throw new NetlistError(`${head}: ${(e as Error).message}`, n); }
    b.add({ id: head, kind: spec.kind, owner: '', nodes, p, ...(model ? { model } : {}) });
  }
  return b.build();
}

// ---------------------------------------------------------------- board expansion
export interface ExpandCtx { part: PlacedPart; def: PartDef; /** netlist node id of every pin, PartDef.pins order */ nodes: number[] }
export type Expander = (x: ExpandCtx) => Element[];

const el = (x: ExpandCtx, kind: string, nodes: number[], p: Params, suffix = ''): Element =>
  ({ id: x.part.uid + (suffix ? '.' + suffix : ''), kind, owner: x.part.uid, nodes, p });
const resistance = (x: ExpandCtx): number => x.part.value ?? x.def.model.R;

const resistor: Expander = (x) => [el(x, 'R', [x.nodes[0], x.nodes[1]], { r: resistance(x) })];

/** Per-PartKind expanders. EXTENSION POINT: add D / LED / Z / NPN / ... here. */
export const EXPANDERS: Readonly<Partial<Record<PartKind, Expander>>> = Object.freeze({
  R: resistor, HEATER: resistor, SPEAKER: resistor, MOTOR: resistor, FUSE: resistor, NTC: resistor,
  POT: (x) => {
    const R = resistance(x), a = x.part.pos ?? 0.5;
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
export function boardToNetlist(board: Board, getDef: (partId: string) => PartDef | undefined, expanders: Readonly<Partial<Record<PartKind, Expander>>> = EXPANDERS): BoardNetlist {
  const conn = buildConnectivity(board, getDef);
  const errors: ExpandError[] = conn.errors.map((e) => ({ code: e.code, uid: e.uid }));
  if (!conn.hasGround) errors.push({ code: 'noGround' });
  const elements: Element[] = [];
  for (const part of board.parts) {
    const def = getDef(part.partId), nodes = conn.pinNodes[part.uid];
    if (!def || !nodes) continue;
    const ex = expanders[def.kind];
    if (!ex) { errors.push({ code: 'noExpander', uid: part.uid }); continue; }
    for (const e of ex({ part, def, nodes })) {
      if (Object.values(e.p).some((v) => typeof v !== 'number' || Number.isNaN(v))) { errors.push({ code: 'badValue', uid: part.uid }); continue; }
      elements.push(e);
    }
  }
  const nodeNames = conn.nodes.map((n) => n.name);
  return { netlist: { nodeNames, elements, models: {}, modelTypes: {} }, conn, errors };
}
