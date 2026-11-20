// The rig (DESIGN §3.1, §6.2, §8.6): a placed board plus everything the bench adds to it (bench supply, function generator, scope probes,
// the DMM, hidden-parameter / condition overrides, smoked parts) becomes ONE compiled circuit. Pure: the same inputs give the same circuit
// (compileNetlist memoises by netlist hash, so "compile if dirty" is the memo). sim never imports the engine: inputs are plain structural types.
//
// Conventions fixed here (assumptions, listed in the M2-1 report):
//  - node names are lower-cased connector ids (compile's probe parser lower-cases names); unnamed nodes are 'n<id>', ground is '0';
//  - scope probes and the DMM voltage range load their node with 10 Mohm (DESIGN §3.12), the DMM current range is a 0.1 ohm series branch;
//  - the bench supply is the BENCH device (ideal in CV mode until the CC task), the generator is an ideal V source behind rOut (default 50 ohm).
import type { PartDef, PartKind } from '../data/parts/types';
import { INSTRUMENTS } from '../data/parts';
import type { SupplyDef } from '../data/levels/types';
import type { Board, Pad } from './board/types';
import { boardToNetlist } from './mna/netlist';
import { compileNetlist } from './mna/compile';
import { applyFailures } from './smoke';
import { pulse, sine, type Wave } from './mna/waveforms';
import type { Circuit, Element, Netlist } from './mna/types';
import type { RatedPart } from './thermal';
import type { Connectivity } from './board/connectivity';

export interface RigIssue { key: string; vars: Record<string, string | number> }
export interface RigBoard extends Board { probes: { ch: 1 | 2; pad: Pad }[]; meter: { mode: string; pads: Pad[] } }
export interface RigOverride { target: string; key: string; value: number }
export interface RigGen { shape: 'sine' | 'square' | 'triangle' | 'pulse'; f: number; vpp: number; offset: number }

export interface RigInput {
  board: RigBoard;
  getDef: (partId: string) => PartDef | undefined;
  supplies: readonly SupplyDef[];
  supply: { v: number; ilim: number };
  gen: RigGen;
  overrides?: readonly RigOverride[];
  smoked?: readonly string[];
  ambientC?: number;
  /** Include the scope probes and the DMM (live view). The pure bench leaves them out. */
  instruments?: boolean;
  /** Node names that get a 10 Mohm probe load (the bench's spec probes). */
  probeLoads?: readonly string[];
  /** Bench-only resistors between two nodes (level `bench.testLoads`); an override whose target is the load's id sets its `r`. */
  testLoads?: readonly { id: string; a: string; b: string; r: number }[];
}

export interface Rig {
  circuit: Circuit | null;
  netlist: Netlist;
  conn: Connectivity;
  errors: RigIssue[];
  rated: RatedPart[];
  /** part uid -> PartKind (for applyFailures / explainers). */
  kinds: Record<string, PartKind>;
  /** Node name at a pad, or null when nothing terminates there. */
  padNode(pad: Pad): string | null;
  /** Replace `@partId#n[.PIN]` tokens by element ids / node names; null when a token or an element / node is missing. */
  resolve(probe: string): string | null;
  /** Element ids of every source (battery, bench supply, generator) for the supply-power metric. */
  sources: string[];
  /** Probe expressions of the two scope channels ('' = no probe) and the DMM element id ('' = none). */
  scope: [string, string];
  dmm: string;
}

const TOKEN = /@([a-z0-9-]+)#(\d+)(?:\.(\+|-|[A-Za-z0-9]+))?/g;

export const PROBE_RIN = 10e6;
export const DMM_BURDEN = 0.1;
const INST = (id: string): Record<string, number> => INSTRUMENTS.find((i) => i.id === id)!.model;

export function genWave(g: RigGen): Wave {
  const T = 1 / g.f, lo = g.offset - g.vpp / 2, hi = g.offset + g.vpp / 2;
  switch (g.shape) {
    case 'sine': return sine(g.vpp / 2, g.f, 0, g.offset);
    case 'square': return pulse(lo, hi, T / 2 - 1e-9, { rise: 1e-9, fall: 1e-9, period: T });
    case 'triangle': return pulse(lo, hi, 0, { rise: T / 2, fall: T / 2, period: T });
    default: return pulse(lo, hi, 0.1 * T - 1e-9, { rise: 1e-9, fall: 1e-9, period: T });
  }
}

export function buildRig(inp: RigInput): Rig {
  const { getDef } = inp;
  // `pos` overrides (a condition sets the jockey of a fixed slide wire, or a wiper) apply to the board before it is expanded
  const posOv = (inp.overrides ?? []).filter((o) => o.key === 'pos');
  const board: RigBoard = posOv.length === 0 ? inp.board : { ...inp.board, parts: inp.board.parts.map((p) => { const o = posOv.find((x) => x.target === p.uid); return o ? { ...p, pos: o.value } : p; }) };
  const base = boardToNetlist(board, getDef, undefined, { tempC: inp.ambientC ?? 25 });
  const errors: RigIssue[] = [];
  for (const e of base.errors) {
    if (e.code === 'noGround') errors.push({ key: 'rig.noGround', vars: {} });
    else if (e.code === 'noExpander') errors.push({ key: 'rig.noExpander', vars: { part: e.uid ?? '' } });
    else if (e.code === 'badValue') errors.push({ key: 'rig.badValue', vars: { part: e.uid ?? '' } });
    else errors.push({ key: 'rig.board', vars: { code: e.code, part: e.uid ?? '' } });
  }
  const kinds: Record<string, PartKind> = {};
  const rated: RatedPart[] = [];
  for (const p of board.parts) {
    const d = getDef(p.partId); if (!d) continue;
    kinds[p.uid] = d.kind;
    const v = d.variants.find((x) => x.id === p.variant) ?? d.variants[0]!;
    rated.push({ id: p.uid, kind: d.kind, ratings: v.ratings, thermal: v.thermal });
  }
  const names = base.netlist.nodeNames.map((n) => n.toLowerCase());
  const nodeId = (n: string): number => names.indexOf(n.toLowerCase());
  const connNode = (id: string): number => { const c = base.conn.connectorNodes[id]; return c === undefined ? -1 : c; };
  let elements: Element[] = base.netlist.elements.map((e) => ({ ...e, p: { ...e.p } }));

  // overrides (hidden parameters, bench conditions), then smoked parts behave as failed parts
  for (const o of inp.overrides ?? []) if (o.key !== 'pos') for (const e of elements) if (e.owner === o.target || e.id === o.target) e.p[o.key] = o.value;
  let nl: Netlist = { nodeNames: names, elements, models: {}, modelTypes: {} };
  if (inp.smoked && inp.smoked.length > 0) nl = applyFailures(nl, inp.smoked, kinds);
  elements = nl.elements.slice();

  // bench-provided sources
  const sources: string[] = elements.filter((e) => e.kind === 'BAT' || e.kind === 'BENCH' || e.kind === 'V').map((e) => e.id);
  const add = (e: Element): void => { elements.push(e); };
  const nodeNames = names.slice();
  for (const s of inp.supplies) {
    const a = connNode(s.plus), b = connNode(s.minus);
    if (a < 0 || b < 0) continue;
    if (s.kind === 'bench') { add({ id: s.id, kind: 'BENCH', owner: s.id, nodes: [a, b], p: { v: inp.supply.v, ilim: inp.supply.ilim } }); sources.push(s.id); }
    else {
      const mid = nodeNames.length; nodeNames.push(`${s.id}#o`);
      add({ id: s.id, kind: 'V', owner: s.id, nodes: [mid, b], p: { v: inp.gen.offset }, wave: genWave(inp.gen) });
      add({ id: `${s.id}.r`, kind: 'R', owner: s.id, nodes: [mid, a], p: { r: s.rOut ?? INST('inst-fgen').rOut! } });
      sources.push(s.id);
    }
  }
  // overrides targeting a bench source (conditions such as "12 V supply") apply to the injected element too
  for (const o of inp.overrides ?? []) for (const e of elements) if (e.owner === o.target && (e.kind === 'BENCH' || e.kind === 'V')) e.p[o.key] = o.value;

  const padName = (pad: Pad): string | null => { const k = base.conn.nodeOfPad(pad); return k < 0 ? null : names[k]!; };
  const scope: [string, string] = ['', ''];
  let dmm = '';
  if (inp.instruments) {
    for (const pr of board.probes) {
      const n = padName(pr.pad); if (n === null) continue;
      const k = nodeId(n);
      if (k > 0) { add({ id: `ch${pr.ch}`, kind: 'R', owner: `ch${pr.ch}`, nodes: [k, 0], p: { r: PROBE_RIN } }); scope[pr.ch - 1] = `v(${n})`; }
      else scope[pr.ch - 1] = 'v(0)';
    }
    const m = board.meter;
    if (m.mode !== 'off' && m.mode !== 'ohm' && m.pads.length >= 1) {
      const a = padName(m.pads[0]!), b = m.pads.length > 1 ? padName(m.pads[1]!) : '0';
      const ia = a === null ? -1 : nodeId(a), ib = b === null ? -1 : nodeId(b);
      if (ia >= 0 && ib >= 0 && ia !== ib) {
        if (m.mode === 'dca') add({ id: 'dmm', kind: 'AM', owner: 'dmm', nodes: [ia, ib], p: { r: INST('inst-dmm').burdenAmps! } });
        else add({ id: 'dmm', kind: 'R', owner: 'dmm', nodes: [ia, ib], p: { r: INST('inst-dmm').rinVolts! } });
        dmm = 'dmm';
      }
    }
  }
  for (const tl of inp.testLoads ?? []) {   // bench-only test loads: a condition overrides their r
    const ov = (inp.overrides ?? []).find((o) => o.target === tl.id && o.key === 'r');
    const ia = nodeNames.indexOf(tl.a.toLowerCase()), ib = tl.b === '0' || tl.b.toLowerCase() === 'gnd' ? 0 : nodeNames.indexOf(tl.b.toLowerCase());
    if (ia >= 0 && ib >= 0 && ia !== ib) add({ id: tl.id, kind: 'R', owner: tl.id, nodes: [ia, ib], p: { r: ov ? ov.value : tl.r } });
  }
  for (const n of inp.probeLoads ?? []) { const k = nodeNames.indexOf(n.toLowerCase()); if (k > 0) add({ id: `load.${n.toLowerCase()}`, kind: 'R', owner: '', nodes: [k, 0], p: { r: PROBE_RIN } }); }

  const netlist: Netlist = { nodeNames, elements, models: {}, modelTypes: {} };
  const comp = compileNetlist(netlist);
  const circuit = comp.ok ? comp.circuit : null;
  if (!comp.ok) for (const e of comp.errors) errors.push({ key: 'rig.compile', vars: { id: e.id, detail: e.message } });

  const partsOf = (id: string): string[] => board.parts.filter((p) => p.partId === id).map((p) => p.uid);
  const resolve = (probe: string): string | null => {
    let bad = false;
    const out = probe.replace(TOKEN, (_m, pid: string, nStr: string, pin: string | undefined) => {
      const uid = partsOf(pid)[Number(nStr) - 1];
      if (uid === undefined) { bad = true; return ''; }
      if (pin === undefined) { const e = elements.find((x) => (x.owner || x.id) === uid); if (!e) { bad = true; return ''; } return e.id; }
      const d = getDef(pid); const idx = d ? d.pins.indexOf(pin) : -1; const ns = base.conn.pinNodes[uid];
      if (idx < 0 || !ns) { bad = true; return ''; }
      return names[ns[idx]!]!;
    });
    if (bad || !circuit) return bad ? null : out;
    const m = /^([vip])\(([^)]*)\)$/i.exec(out.trim());
    if (!m) return null;
    const args = m[2]!.split(',').map((s) => s.trim());
    if (m[1]!.toLowerCase() === 'v') { for (const a of args) if (a.toLowerCase() !== 'gnd' && a !== '0' && circuit.nodeIndex[a.toLowerCase()] === undefined) return null; }
    else if (circuit.elementIndex[args[0]!] === undefined) return null;
    return out;
  };
  return { circuit, netlist, conn: base.conn, errors, rated, kinds, padNode: padName, resolve, sources, scope, dmm };
}
