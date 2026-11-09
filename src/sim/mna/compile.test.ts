import { afterEach, describe, expect, it } from 'vitest';
import { clearCompileCache, compileBoard, compileCacheSize, compileNetlist, setCompileCache } from './compile';
import { parseNetlist } from './netlist';
import { solveOp } from './op';
import { DEVICES } from './devices';
import type { Board } from '../board/types';
import type { PartDef } from '../../data/parts/types';
import type { Device } from './types';

afterEach(() => { setCompileCache(true); clearCompileCache(); });
const ok = (t: string) => { const r = compileNetlist(parseNetlist(t)); if (!r.ok) throw new Error(JSON.stringify(r.errors)); return r.circuit; };

describe('compile', () => {
  it('assigns node, branch and state indices', () => {
    const c = ok('V1 a 0 5\nR1 a b 1k\nE1 c 0 b 0 2\nR2 b 0 1k\nR3 c 0 1k');
    expect(c).toMatchObject({ n: 3, nInternal: 0, m: 2, dim: 5, linear: true });
    expect(c.unknownNames).toEqual(['v(a)', 'v(b)', 'v(c)', 'i(V1)', 'i(E1)']);
    expect(c.elements[0].branch).toEqual([3]); expect(c.elements[0].nodes).toEqual([0, -1]);
  });
  it('rejects unknown kinds, bad values, duplicate ids, wrong arity', () => {
    const r = compileNetlist(parseNetlist('C1 a 0 1u\nR1 a 0 -5'));
    expect(r.ok).toBe(false);
    expect(!r.ok && r.errors.map((e) => e.id)).toEqual(['C1', 'R1']);
  });
  it('supports internal nodes, extra branches and state through the device interface', () => {
    // test device: 2-terminal resistor split by an internal node, one extra branch row (0 V probe), 2 state slots
    const macro: Device = { kind: 'X', terminals: 2, isLinear: true, branches: () => 1, internalNodes: () => 1, stateSize: () => 2,
      stampDC(e, c) { const [a, b] = e.nodes, [m] = e.internal, k = e.branch[0]; c.g(a, m, 1e-3); c.m(m, k, 1); c.m(b, k, -1); c.m(k, m, 1); c.m(k, b, -1); },
      terminalCurrents(e, x) { const i = x[e.branch[0]]; return [i, -i]; }, topo: () => ({ dc: [[0, 1]], ideal: [], forced: [] }) };
    const nl = parseNetlist('V1 a 0 10\nR1 a 0 1');
    nl.elements[1].kind = 'X';
    const r = compileNetlist(nl, { ...DEVICES, X: macro });
    expect(r.ok).toBe(true); if (!r.ok) return;
    expect(r.circuit).toMatchObject({ n: 1, nInternal: 1, m: 2, dim: 4, stateSize: 2 });
    const op = solveOp(r.circuit);
    expect(op.ok).toBe(true); expect(op.x[0]).toBeCloseTo(10, 6);
    expect(op.x[3]).toBeCloseTo(0.01, 6);
  });
  it('memo: LRU of 8, same object on hit, identical results with the cache disabled', () => {
    const t = (k: number) => `V1 a 0 ${k}\nR1 a 0 1k`;
    const first = compileNetlist(parseNetlist(t(1)));
    expect(compileNetlist(parseNetlist(t(1)))).toBe(first);
    for (let k = 2; k <= 12; k++) compileNetlist(parseNetlist(t(k)));
    expect(compileCacheSize()).toBe(8);
    expect(compileNetlist(parseNetlist(t(1)))).not.toBe(first);   // evicted
    const strip = (r: ReturnType<typeof compileNetlist>) => JSON.stringify(r, (k, v) => (k === 'dev' ? undefined : v));
    const cached = strip(compileNetlist(parseNetlist(t(5))));
    setCompileCache(false);
    expect(compileCacheSize()).toBe(0);
    expect(strip(compileNetlist(parseNetlist(t(5))))).toBe(cached);
    expect(compileCacheSize()).toBe(0);
  });
  it('compileBoard memoises by board hash and matches the uncached result', () => {
    const d = (id: string, kind: PartDef['kind'], fp: PartDef['footprint'], model = {}): PartDef => ({ id, kind, nameKey: id, footprint: fp, pins: ['A', 'B'], variants: [], model, source: { doc: 't' }, verified: false, scope: 'sandbox' });
    const defs: Record<string, PartDef> = { r: d('r', 'R', 'axial2'), b: d('b', 'MISC', 'block2', { emf: 9, r: 1 }) };
    const board: Board = { w: 20, h: 20, connectors: [{ id: 'GND', pad: [0, 0], role: 'ground' }], wires: [{ wid: 'w1', path: [[0, 2], [0, 0]] }, { wid: 'w2', path: [[6, 2], [8, 2], [8, 0], [0, 0]] }],
      parts: [{ uid: 'p1', partId: 'b', value: null, variant: '', x: 0, y: 2, rot: 0, flip: false }, { uid: 'p2', partId: 'r', value: 100, variant: '', x: 6, y: 2, rot: 0, flip: false }] };
    const a = compileBoard(board, (id) => defs[id]);
    expect(compileBoard(structuredClone(board), (id) => defs[id])).toBe(a);
    setCompileCache(false);
    const b = compileBoard(board, (id) => defs[id]);
    expect(b).not.toBe(a);
    expect(JSON.stringify(b, (k, v) => (k === 'dev' ? undefined : v))).toBe(JSON.stringify(a, (k, v) => (k === 'dev' ? undefined : v)));
    expect(a.circuit).not.toBeNull();
  });
});
