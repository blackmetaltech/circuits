// Property tests on random connected linear networks (DESIGN §9.3). Seeded; ≥ 500 cases per property.
import { describe, expect, it } from 'vitest';
import { Rng } from '@core/kit/rng';
import { randomNet, solveNet } from './fuzz';
import { terminalCurrents, terminalVoltages } from './stamp';
import type { Netlist } from './types';

const CASES = 500, GMIN = 1e-12;
const maxAbs = (a: ArrayLike<number>): number => { let m = 0; for (let i = 0; i < a.length; i++) m = Math.max(m, Math.abs(a[i])); return m; };
function forEach(seed: number, n: number, opts: Parameters<typeof randomNet>[1], fn: (nl: Netlist, s: NonNullable<ReturnType<typeof solveNet>>, r: Rng) => void): void {
  const r = new Rng(seed); let skipped = 0;
  for (let c = 0; c < n; c++) { const nl = randomNet(r, opts); const s = solveNet(nl); if (!s) { skipped++; continue; } fn(nl, s, r); }
  expect(skipped, 'unsolvable random nets').toBeLessThan(n * 0.05);
}

describe('linear MNA properties', () => {
  it('KCL at every node (incl. gmin shunt)', () => forEach(1, CASES, {}, (nl, { ckt, x }) => {
    const sum = new Array(nl.nodeNames.length).fill(0); let big = 0;
    for (const e of ckt.elements) { const i = terminalCurrents(e, x); i.forEach((v, t) => { big = Math.max(big, Math.abs(v)); const nid = e.el.nodes[t]; if (nid > 0) sum[nid] += v; }); }
    for (let j = 1; j < sum.length; j++) expect(Math.abs(sum[j] + GMIN * x[j - 1])).toBeLessThanOrEqual(1e-9 + 1e-6 * big);
  }));

  it('KVL on random loops of R / V branches (branch voltages from the element equations)', () => {
    const r = new Rng(2); let loops = 0;
    for (let c = 0; c < CASES; c++) {
      const nl = randomNet(r); const s = solveNet(nl); if (!s) continue;
      type Edge = (typeof s.ckt.elements)[number];
      const edges = s.ckt.elements.filter((e) => e.el.kind === 'R' || e.el.kind === 'V');
      // branch voltage v(nodes[0]) − v(nodes[1]) from the element's own equation
      const eqV = (e: Edge) => (e.el.kind === 'V' ? e.el.p.v : terminalCurrents(e, s.x)[0] * e.el.p.r);
      // BFS tree from a random root; the loop = tree path root→a, non-tree edge a→b, tree path b→root
      const root = r.int(0, nl.nodeNames.length - 1);
      const par = new Map<number, { from: number; e: Edge } | null>([[root, null]]), q = [root];
      for (let h = 0; h < q.length; h++) for (const e of edges) {
        const [p0, p1] = e.el.nodes, to = p0 === q[h] ? p1 : p1 === q[h] ? p0 : -1;
        if (to >= 0 && !par.has(to)) { par.set(to, { from: q[h], e }); q.push(to); }
      }
      const tree = new Set<Edge>(); for (const p of par.values()) if (p) tree.add(p.e);
      const nonTree = edges.filter((e) => !tree.has(e) && par.has(e.el.nodes[0]) && par.has(e.el.nodes[1]));
      if (!nonTree.length) continue;
      const ne = r.pick(nonTree), [a, b] = ne.el.nodes;
      // potential rise v(to) − v(from) when walking an edge from `from`
      const rise = (e: Edge, from: number): number => (e.el.nodes[0] === from ? -eqV(e) : eqV(e));
      const down = (n: number) => { const l: { e: Edge; from: number }[] = []; for (let p = par.get(n); p; p = par.get(p.from)) l.push({ e: p.e, from: p.from }); return l.reverse(); };   // root → n
      const up = down(b).slice().reverse().map((w) => { const to = w.e.el.nodes[0] === w.from ? w.e.el.nodes[1] : w.e.el.nodes[0]; return rise(w.e, to); });
      const all = [...down(a).map((w) => rise(w.e, w.from)), rise(ne, a), ...up];
      const sum = all.reduce((x, y) => x + y, 0), big = Math.max(...all.map(Math.abs));
      expect(Math.abs(sum)).toBeLessThanOrEqual(1e-9 + 1e-6 * big);
      loops++;
    }
    expect(loops).toBeGreaterThan(100);
  });

  it('Tellegen: Σ v·i = 0 over all terminals (incl. gmin)', () => forEach(3, CASES, {}, (nl, { ckt, x }) => {
    let p = 0, big = 0;
    for (const e of ckt.elements) { const v = terminalVoltages(e, x), i = terminalCurrents(e, x); v.forEach((vv, t) => { p += vv * i[t]; big = Math.max(big, Math.abs(vv * i[t])); }); }
    for (let j = 0; j < ckt.n; j++) p += GMIN * x[j] * x[j];
    expect(Math.abs(p)).toBeLessThanOrEqual(1e-9 * Math.max(1, big));
  }));

  it('linearity and superposition (1e-9 relative)', () => forEach(4, CASES, {}, (nl, s, r) => {
    const scaleSrc = (n: Netlist, a: number, keep?: (i: number) => boolean): Netlist => ({ ...n, elements: n.elements.map((e, i) => (e.kind === 'V' || e.kind === 'I') ? { ...e, p: { ...e.p, [e.kind === 'V' ? 'v' : 'i']: (keep && !keep(i) ? 0 : 1) * a * e.p[e.kind === 'V' ? 'v' : 'i'] } } : e) });
    const a = r.range(-3, 3), ref = maxAbs(s.x);
    const sa = solveNet(scaleSrc(nl, a)); if (!sa) return;
    for (let i = 0; i < s.x.length; i++) expect(Math.abs(sa.x[i] - a * s.x[i])).toBeLessThanOrEqual(1e-9 * Math.max(ref * Math.abs(a), 1e-12) + 1e-18);
    const mask = nl.elements.map(() => r.chance(0.5));
    const s1 = solveNet(scaleSrc(nl, 1, (i) => mask[i])), s2 = solveNet(scaleSrc(nl, 1, (i) => !mask[i]));
    if (!s1 || !s2) return;
    for (let i = 0; i < s.x.length; i++) expect(Math.abs(s1.x[i] + s2.x[i] - s.x[i])).toBeLessThanOrEqual(1e-9 * Math.max(ref, 1e-12));
  }));

  it('reciprocity Z12 = Z21 on R-only networks', () => forEach(5, CASES, { rOnly: true }, (nl, _s, r) => {
    const N = nl.nodeNames.length; let a = r.int(1, N - 1), b = r.int(1, N - 1); if (a === b) b = a === N - 1 ? 1 : a + 1; if (a === b) return;
    const z = (inj: number, meas: number) => { const s = solveNet({ ...nl, elements: [...nl.elements, { id: 'It', kind: 'I', owner: '', nodes: [0, inj], p: { i: 1 } }] })!; return s.x[meas - 1]; };
    const z12 = z(a, b), z21 = z(b, a);
    expect(Math.abs(z12 - z21)).toBeLessThanOrEqual(1e-9 * Math.max(Math.abs(z12), Math.abs(z21), 1e-12));
  }));

  it('Thevenin consistency: Voc / Isc = R seen by a 1 A test source', () => {
    const r = new Rng(6); let checked = 0;
    for (let c = 0; c < CASES; c++) {
      const nl = randomNet(r); const N = nl.nodeNames.length;
      const a = r.int(1, N - 1), b = r.int(0, N - 1); if (a === b) continue;
      const voc = solveNet(nl); const sc = solveNet({ ...nl, elements: [...nl.elements, { id: 'Vsh', kind: 'V', owner: '', nodes: [a, b], p: { v: 0 } }] });
      const zero: Netlist = { ...nl, elements: nl.elements.map((e) => (e.kind === 'V' ? { ...e, p: { ...e.p, v: 0 } } : e.kind === 'I' ? { ...e, p: { ...e.p, i: 0 } } : e)) };
      const rt = solveNet({ ...zero, elements: [...zero.elements, { id: 'It', kind: 'I', owner: '', nodes: [b, a], p: { i: 1 } }] });
      if (!voc || !sc || !rt) continue;
      const v = (s: typeof voc, n: number) => (n === 0 ? 0 : s.x[n - 1]);
      const Voc = v(voc, a) - v(voc, b), Isc = sc.ckt.elements.find((e) => e.el.id === 'Vsh')!.dev.terminalCurrents(sc.ckt.elements.find((e) => e.el.id === 'Vsh')!, sc.x, [])[0];
      const Rth = v(rt, a) - v(rt, b);
      if (Math.abs(Isc) < 1e-7 || Rth <= 0) continue;
      expect(Math.abs(Voc / Isc - Rth)).toBeLessThanOrEqual(1e-6 * Math.abs(Rth) + 1e-6);
      checked++;
    }
    expect(checked).toBeGreaterThan(150);
  });
});
