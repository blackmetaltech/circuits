// Compile (DESIGN §3.1 step 4, §8.3): assign MNA indices, count unknowns, classify linear vs nonlinear, run the topology checks.
//
// MEMO: `compileNetlist` / `compileBoard` are pure; results are memoised in a tiny LRU (8 entries) keyed by a hash of the INPUT
// (netlist JSON; board JSON + the fields of the used part defs that matter). This is the ONLY module-level cache allowed
// (DESIGN §8.3). Cached Circuits are immutable and hold no scratch buffers; `setCompileCache(false)` disables it and a test
// asserts identical results either way. A custom device registry bypasses the memo.
import { hashOf } from '@core/kit/hash';
import type { PartDef, PartKind } from '../../data/parts/types';
import type { Board } from '../board/types';
import type { Connectivity } from '../board/connectivity';
import { boardToNetlist, EXPANDERS, type Expander, type ExpandEnv, type ExpandError } from './netlist';
import { DEVICES } from './devices';
import { checkTopology } from './topology';
import type { CElem, Circuit, Device, Netlist } from './types';

export interface CompileError { id: string; message: string }
export type CompileResult = { ok: true; circuit: Circuit } | { ok: false; errors: CompileError[] };

function compileUncached(nl: Netlist, devices: Readonly<Record<string, Device>>): CompileResult {
  const errors: CompileError[] = [];
  const nNodes = nl.nodeNames.length - 1;
  const ids = new Set<string>();
  for (const el of nl.elements) {
    if (ids.has(el.id)) errors.push({ id: el.id, message: `duplicate element id ${el.id}` });
    ids.add(el.id);
    const dev = devices[el.kind];
    if (!dev) { errors.push({ id: el.id, message: `no device registered for kind '${el.kind}'` }); continue; }
    if (el.nodes.length !== dev.terminals) errors.push({ id: el.id, message: `${el.id}: kind ${el.kind} has ${dev.terminals} terminals, got ${el.nodes.length}` });
    for (const k of el.nodes) if (!Number.isInteger(k) || k < 0 || k > nNodes) errors.push({ id: el.id, message: `${el.id}: node id ${k} out of range` });
    const bad = dev.validate?.(el); if (bad) errors.push({ id: el.id, message: bad });
  }
  if (errors.length) return { ok: false, errors };

  const names: string[] = [];
  for (let j = 1; j <= nNodes; j++) names.push(`v(${nl.nodeNames[j]})`);
  let nInt = 0, m = 0, so = 0;
  const pre = nl.elements.map((el) => {
    const dev = devices[el.kind];
    const ni = dev.internalNodes(el), nb = dev.branches(el), ns = dev.stateSize?.(el) ?? 0;
    const r = { el, dev, ni, nb, ns, i0: nInt, b0: m, so };
    nInt += ni; m += nb; so += ns;
    return r;
  });
  for (const p of pre) for (let k = 0; k < p.ni; k++) names.push(`v(${p.el.id}#${k + 1})`);
  for (const p of pre) for (let k = 0; k < p.nb; k++) names.push(`i(${p.el.id}${p.nb > 1 ? '#' + (k + 1) : ''})`);
  const n = nNodes, dim = n + nInt + m;
  const elements: CElem[] = pre.map((p) => ({
    el: p.el, dev: p.dev, nodes: p.el.nodes.map((k) => k - 1),
    internal: Array.from({ length: p.ni }, (_, k) => n + p.i0 + k),
    branch: Array.from({ length: p.nb }, (_, k) => n + nInt + p.b0 + k),
    so: p.so, ns: p.ns,
  }));
  const nodeIndex: Record<string, number> = {};
  nl.nodeNames.forEach((nm, i) => { nodeIndex[nm] = i; });
  const elementIndex: Record<string, number> = {};
  elements.forEach((e, i) => { elementIndex[e.el.id] = i; });
  return { ok: true, circuit: { netlist: nl, n, nInternal: nInt, m, dim, elements, stateSize: so, linear: elements.every((e) => e.dev.isLinear), unknownNames: names, nodeIndex, elementIndex, issues: checkTopology(nl, devices) } };
}

// ---- the one allowed module-level cache: a pure LRU memo (8 entries)
const LRU_SIZE = 8;
let cacheOn = true;
const lru: { key: string; value: unknown }[] = [];
function memo<T>(key: string, make: () => T): T {
  if (!cacheOn) return make();
  const i = lru.findIndex((e) => e.key === key);
  if (i >= 0) { const [e] = lru.splice(i, 1); lru.push(e); return e.value as T; }
  const value = make();
  lru.push({ key, value }); if (lru.length > LRU_SIZE) lru.shift();
  return value;
}
export function setCompileCache(enabled: boolean): void { cacheOn = enabled; if (!enabled) lru.length = 0; }
export function clearCompileCache(): void { lru.length = 0; }
export const compileCacheSize = (): number => lru.length;

/** Compile a netlist (memoised when `devices` is the default registry). */
export function compileNetlist(nl: Netlist, devices: Readonly<Record<string, Device>> = DEVICES): CompileResult {
  if (devices !== DEVICES) return compileUncached(nl, devices);
  return memo('N:' + hashOf(nl), () => compileUncached(nl, devices));
}

export interface CompiledBoard { circuit: Circuit | null; netlist: Netlist; conn: Connectivity; expandErrors: ExpandError[]; compileErrors: CompileError[] }

/** Board → netlist → circuit, memoised by the board hash (+ the relevant fields of the part defs used: `getDef` must be pure). */
export function compileBoard(board: Board, getDef: (partId: string) => PartDef | undefined, expanders: Readonly<Partial<Record<PartKind, Expander>>> = EXPANDERS, env: ExpandEnv = {}): CompiledBoard {
  const make = (): CompiledBoard => {
    const { netlist, conn, errors } = boardToNetlist(board, getDef, expanders, env);
    const r = compileNetlist(netlist);
    return { circuit: r.ok ? r.circuit : null, netlist, conn, expandErrors: errors, compileErrors: r.ok ? [] : r.errors };
  };
  if (expanders !== EXPANDERS) return make();
  const used = [...new Set(board.parts.map((p) => p.partId))].sort().map((id) => { const d = getDef(id); return d ? { id, kind: d.kind, fp: d.footprint, pins: d.pins, model: d.model, variants: d.variants } : { id }; });
  return memo('B:' + hashOf({ board, used, env }), make);
}
