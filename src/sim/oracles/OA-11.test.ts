import { describe, expect, it } from 'vitest';
import { near, solveCards } from './util';
import { partModel, rails } from './oaUtil';
import { tl072 } from '../../data/parts/ics';
// Chapter 6-2 (Sensor Buffer): a pH probe is an EMF behind 100 kΩ. TL072 on ±12 V.
// Non-inverting 10k / 10k (gain 2): the + input of a JFET op-amp draws (v+ − v−)/Rin = (Vout/A0)/1e12 ≈ 1e-17 A, so the 100 kΩ drops ~1e-12 V.
//   Vout = 2·EMF/(1 + 2/A0) = 2·EMF·(1 − 1.0e-5): 0.399996 V at 0.2 V, 1.999980 V at 1.0 V.
//   The current the solver shows in Rs is 1.0 pA at 1 V: that is its gmin (1e-12 S from every node to ground), not the op-amp. A real TL072 draws
//   65 pA typ bias (SLOS080W §5.8), which v0.1 does not model (Codex note): 6.5 µV across 100 kΩ, still nothing.
// The inverting stage the design names as the failure (Rin 10k, Rf 20k): the source resistance adds to Rin, so the gain is −20/(100 + 10) = −0.18182
//   instead of −2, an error of 1 − 0.18182/2 = 90.9 %.
const nonInv = (emf: number) => solveCards(`V1 emf 0 ${emf}\nRs emf ip 100k\nR1 inv 0 10k\nRf out inv 10k\nU1 ip inv out vp vn m` + rails(12) + partModel(tl072));
describe('OA-11 non-inverting ×2 from a 100 kΩ source, TL072 macro, ±12 V', () => {
  it('OUT = 2.0000 × EMF (0.399996 V at 0.2 V, 1.999980 V at 1.0 V); the source carries only the solver gmin current (1 pA at 1 V)', () => {
    near(nonInv(0.2).v('out'), 0.399996, 1e-5);
    const s = nonInv(1.0);
    near(s.v('out'), 1.99998, 1e-5);
    near(Math.abs(s.i('Rs')), 1e-12, 1e-3);                     // gmin·v(ip); the macro's own 1e12 Ω adds 1e-17 A
  });
  it('the inverting 10k / 20k stage behind the same source: gain −0.1818, 91 % short of ×2', () => {
    const s = solveCards(`V1 emf 0 1\nRs emf a 100k\nR1 a inv 10k\nRf out inv 20k\nU1 0 inv out vp vn m` + rails(12) + partModel(tl072));
    near(s.v('out'), -20 / 110, 1e-4);
    near(1 - Math.abs(s.v('out')) / 2, 0.90909, 1e-4);
  });
});
