// Random linear-network generator for the property tests (seeded with core Rng; never Math.random). Test support, not a test.
import { Rng } from '@core/kit/rng';
import { dmath } from '@core/numerics';
import type { Element, Netlist } from './types';
import { compileNetlist } from './compile';
import { solveOp } from './op';

const logU = (r: Rng, lo: number, hi: number): number => dmath.exp(r.range(dmath.log(lo), dmath.log(hi)));

export interface FuzzOpts { rOnly?: boolean; minNodes?: number; maxNodes?: number }

/** Connected linear network on nodes 0..N-1 (0 = ground): a spanning tree of R / V / E edges plus extra R, I, G elements. */
export function randomNet(r: Rng, o: FuzzOpts = {}): Netlist {
  const N = r.int(o.minNodes ?? 3, o.maxNodes ?? 20);
  const els: Element[] = [];
  let k = 0;
  const add = (kind: string, nodes: number[], p: Element['p']) => els.push({ id: kind + ++k, kind, owner: '', nodes, p });
  const sign = () => (r.chance(0.5) ? 1 : -1);
  for (let j = 1; j < N; j++) {
    const a = j, b = r.int(0, j - 1), t = o.rOnly ? 0 : r.next();
    if (t < 0.65) add('R', [a, b], { r: logU(r, 10, 1e5) });
    else if (t < 0.85) add('V', [a, b], { v: sign() * r.range(0.5, 24) });
    else {
      let c = r.int(0, N - 1), d = r.int(0, N - 1);
      while (c === d) { c = r.int(0, N - 1); d = r.int(0, N - 1); }
      add('E', [a, b, c, d], { gain: sign() * r.range(0.1, 5) });
    }
  }
  const extra = r.int(1, N);
  for (let e = 0; e < extra; e++) {
    let a = r.int(0, N - 1), b = r.int(0, N - 1);
    while (a === b) { a = r.int(0, N - 1); b = r.int(0, N - 1); }
    const t = o.rOnly ? 0 : r.next();
    if (t < 0.6) add('R', [a, b], { r: logU(r, 10, 1e5) });
    else if (t < 0.8) add('I', [a, b], { i: sign() * logU(r, 1e-4, 1e-2) });
    else add('G', [a, b, r.int(0, N - 1), r.int(0, N - 1)], { gm: sign() * logU(r, 1e-6, 1e-4) });
  }
  return { nodeNames: ['0', ...Array.from({ length: N - 1 }, (_, i) => 'n' + (i + 1))], elements: els, models: {}, modelTypes: {} };
}

export function solveNet(nl: Netlist) {
  const c = compileNetlist(nl);
  if (!c.ok) return null;
  const op = solveOp(c.circuit);
  return op.ok ? { ckt: c.circuit, x: op.x } : null;
}
