// Bode masks (DESIGN §3.12 `mask`): every grid point (plus every mask edge frequency) inside its region. Uses the AC analysis (§3.6).
import { bode, logFreqs, makeAc } from '../mna/ac';
import type { Circuit } from '../mna/types';
import type { BenchFailure, MaskRegion } from './types';

export interface MaskResult { ok: boolean; worst: number; failures: BenchFailure[] }

export function checkMask(ckt: Circuit, id: string, out: string, inp: string, regions: MaskRegion[], perDecade = 20, cond = ''): MaskResult {
  const failures: BenchFailure[] = [];
  if (regions.length === 0) return { ok: true, worst: Infinity, failures };
  let fMin = Infinity, fMax = 0;
  const edges: number[] = [];
  for (const r of regions) { fMin = Math.min(fMin, r.f1); fMax = Math.max(fMax, r.f2); edges.push(r.f1, r.f2); if (r.relativeTo) edges.push(r.relativeTo); }
  const grid = fMax > fMin ? logFreqs(fMin, fMax, perDecade) : [fMin];
  const freqs = grid.concat(edges).sort((a, b) => a - b).filter((f, i, a) => i === 0 || f !== a[i - 1]);
  const ac = makeAc(ckt);
  if (!ac.ok) return { ok: false, worst: -Infinity, failures: [{ key: ac.failure!.key, vars: { ...ac.failure!.vars, id, cond } }] };
  const bd = bode(ac, out, inp, freqs);
  const at = (f: number): number => bd.f.indexOf(f);
  let worst = Infinity;
  for (const r of regions) {
    const phase = r.quantity === 'phase';
    const ref = !phase && r.relativeTo ? bd.magDb[at(r.relativeTo)] ?? 0 : 0;
    let bad: { f: number; v: number } | null = null, rWorst = Infinity;
    for (let k = 0; k < bd.f.length; k++) {
      const f = bd.f[k];
      if (f < r.f1 || f > r.f2) continue;
      const v = (phase ? bd.phaseDeg[k] : bd.magDb[k]) - ref, margin = Math.min(v - r.lo, r.hi - v);
      if (!(margin >= 0) && (bad === null || margin < rWorst)) { bad = { f, v }; }
      if (margin < rWorst || Number.isNaN(margin)) rWorst = Number.isNaN(margin) ? -Infinity : margin;
    }
    if (rWorst < worst) worst = rWorst;
    if (bad) failures.push({ key: 'bench.mask.fail', vars: { id, f: bad.f, value: bad.v, lo: r.lo, hi: r.hi, quantity: phase ? 'phase' : 'mag', f1: r.f1, f2: r.f2, cond } });
  }
  return { ok: failures.length === 0, worst, failures };
}
