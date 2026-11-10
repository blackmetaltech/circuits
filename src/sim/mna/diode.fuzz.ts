// Seeded random diode / resistor / battery boards for the diode property and convergence tests (core Rng, never Math.random).
// Test support, not a test. Every node has a resistive or battery path to the tree, diodes are extras (never tree edges), and every
// battery has an internal resistance (as real NODE sources do), so the boards are physically sane but nonlinear enough to bite.
import { Rng } from '@core/kit/rng';
import { dmath } from '@core/numerics';
import type { Element, Netlist, Params } from './types';

const logU = (r: Rng, lo: number, hi: number): number => dmath.exp(r.range(dmath.log(lo), dmath.log(hi)));

export const DIODE_FLAVOURS: Record<string, () => Params> = {
  si: () => ({ is: 2.52e-9, n: 1.752, rs: 0.568 }),                        // 1N4148
  rect: () => ({ is: 76.9e-12, n: 1.45, rs: 0.042, bv: 1000, ibv: 1e-6 }), // 1N4007
  led: () => ({ is: 1.19e-17, n: 2, rs: 9.9 }),                            // red LED refit
  schottky: () => ({ is: 1e-8, n: 1.05, rs: 0.1 }),
  zener: () => ({ is: 1e-14, n: 1, rs: 7, bv: 5.1, ibv: 5e-3 }),
  hard: () => ({ is: 1e-14, n: 1 }),                                       // no Rs: the junction sits on the node
};

export interface DiodeBoardOpts { flavours?: string[]; maxNodes?: number }

export function randomDiodeBoard(r: Rng, o: DiodeBoardOpts = {}): Netlist {
  const N = r.int(3, o.maxNodes ?? 8), flav = o.flavours ?? Object.keys(DIODE_FLAVOURS);
  const els: Element[] = []; let k = 0;
  const add = (kind: string, nodes: number[], p: Params) => els.push({ id: kind + ++k, kind, owner: '', nodes, p });
  const bat = (a: number, b: number) => add('BAT', [a, b], { emf: (r.chance(0.8) ? 1 : -1) * r.range(1.5, 24), r: logU(r, 0.1, 10) });
  let sources = 0;
  for (let j = 1; j < N; j++) {
    const b = r.int(0, j - 1);
    if (r.chance(0.25)) { bat(j, b); sources++; } else add('R', [j, b], { r: logU(r, 50, 1e5) });
  }
  if (sources === 0) { const a = r.int(1, N - 1); bat(a, 0); }
  const nd = r.int(1, 6);
  for (let d = 0; d < nd; d++) {
    let a = r.int(0, N - 1), b = r.int(0, N - 1); while (a === b) { a = r.int(0, N - 1); b = r.int(0, N - 1); }
    add('D', [a, b], DIODE_FLAVOURS[r.pick(flav)]());
  }
  const extra = r.int(0, N);
  for (let e = 0; e < extra; e++) {
    let a = r.int(0, N - 1), b = r.int(0, N - 1); while (a === b) { a = r.int(0, N - 1); b = r.int(0, N - 1); }
    add('R', [a, b], { r: logU(r, 50, 1e5) });
  }
  return { nodeNames: ['0', ...Array.from({ length: N - 1 }, (_, i) => 'n' + (i + 1))], elements: els, models: {}, modelTypes: {} };
}
