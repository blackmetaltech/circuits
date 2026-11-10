// Seeded random BJT / MOSFET / resistor / battery boards for the transistor property and convergence tests (core Rng, never Math.random).
// Test support, not a test. Same construction as diode.fuzz.ts: a resistor/battery spanning tree keeps every node (gates included) tied
// to the network, transistors and extra resistors are added on top, every battery has an internal resistance.
import { Rng } from '@core/kit/rng';
import { dmath } from '@core/numerics';
import type { Element, Netlist, Params } from './types';

const logU = (r: Rng, lo: number, hi: number): number => dmath.exp(r.range(dmath.log(lo), dmath.log(hi)));

export const TRANSISTOR_FLAVOURS: Record<string, () => { kind: string; p: Params }> = {
  npn: () => ({ kind: 'Q', p: { is: 6.734e-15, bf: 200, br: 0.7371, vaf: 74.03, pol: 1 } }),   // 2N3904
  npn2: () => ({ kind: 'Q', p: { is: 1e-14, bf: 100, br: 3, pol: 1 } }),
  pnp: () => ({ kind: 'Q', p: { is: 1.41e-15, bf: 180, br: 4.98, vaf: 18.7, pol: -1 } }),     // 2N3906
  dar: () => ({ kind: 'DAR', p: { is: 1e-12, bf: 31, rb: 8000, re: 120 } }),                    // TIP120
  nmos: () => ({ kind: 'M', p: { vt: 2.1, kp: 0.0527, lambda: 0.02, pol: 1 } }),               // 2N7000
  nmosL: () => ({ kind: 'M', p: { vt: 1.5, kp: 11.4, lambda: 0.01, pol: 1 } }),                // IRLZ44N
  pmos: () => ({ kind: 'M', p: { vt: 2, kp: 0.05, lambda: 0.02, pol: -1 } }),
};

export function randomTransistorBoard(r: Rng, flavours: string[] = Object.keys(TRANSISTOR_FLAVOURS)): Netlist {
  const N = r.int(3, 8), els: Element[] = []; let k = 0;
  const add = (kind: string, nodes: number[], p: Params) => els.push({ id: kind + ++k, kind, owner: '', nodes, p });
  const bat = (a: number, b: number) => add('BAT', [a, b], { emf: (r.chance(0.8) ? 1 : -1) * r.range(1.5, 15), r: logU(r, 0.1, 10) });
  let sources = 0;
  for (let j = 1; j < N; j++) {
    const b = r.int(0, j - 1);
    if (r.chance(0.3)) { bat(j, b); sources++; } else add('R', [j, b], { r: logU(r, 100, 1e5) });
  }
  if (sources === 0) bat(r.int(1, N - 1), 0);
  const nq = r.int(1, 4);
  for (let q = 0; q < nq; q++) {
    const t = new Set<number>(); while (t.size < 3) t.add(r.int(0, N - 1));
    const [a, b, c] = [...t], f = TRANSISTOR_FLAVOURS[r.pick(flavours)]();
    add(f.kind, [a, b, c], f.p);
  }
  const extra = r.int(0, N);
  for (let e = 0; e < extra; e++) {
    let a = r.int(0, N - 1), b = r.int(0, N - 1); while (a === b) { a = r.int(0, N - 1); b = r.int(0, N - 1); }
    add('R', [a, b], { r: logU(r, 100, 1e5) });
  }
  return { nodeNames: ['0', ...Array.from({ length: N - 1 }, (_, i) => 'n' + (i + 1))], elements: els, models: {}, modelTypes: {} };
}
