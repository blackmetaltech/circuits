// Pre-solve topology checks (DESIGN §3.10). Pure: Netlist (+ device registry for the DC-path info) → issues with i18n keys.
//   island      all terminals of every element joined: a node group that never reaches ground         (warn; gmin ties it to 0 V)
//   dcFloating  no DC path to ground once capacitors / gates are open (device `topo().dc/ideal`)       (warn; gmin decides it)
//   vloop       cycle of zero-impedance branches (ideal V sources, ideal ammeters, inductors, E out)   (block)
//   shorted     a source / ideal branch with both terminals on one node (ideal: block; real r > 0: warn)
//   cutset      a forced current whose node group has no DC path to ground: "nowhere to go"            (block)
//   unconnected a node referenced by exactly one terminal                                              (info)
// `singular` (matrix fallback) is produced by op.ts when the solve itself fails.
import type { Device, Element, Netlist, TopoIssue } from './types';
import { DEVICES } from './devices';

class UF {
  p: number[];
  constructor(n: number) { this.p = Array.from({ length: n }, (_, i) => i); }
  find(a: number): number { while (this.p[a] !== a) { this.p[a] = this.p[this.p[a]]; a = this.p[a]; } return a; }
  union(a: number, b: number): boolean { const x = this.find(a), y = this.find(b); if (x === y) return false; this.p[Math.max(x, y)] = Math.min(x, y); return true; }
}

export function checkTopology(nl: Netlist, devices: Readonly<Record<string, Device>> = DEVICES): TopoIssue[] {
  const N = nl.nodeNames.length, out: TopoIssue[] = [];
  const name = (i: number): string => nl.nodeNames[i];
  const names = (ids: number[]): string => ids.map(name).join(', ');
  const els = nl.elements.filter((e) => devices[e.kind]);
  const topo = new Map<Element, ReturnType<Device['topo']>>(els.map((e) => [e, devices[e.kind].topo(e)]));
  const used: boolean[] = new Array(N).fill(false), refs: number[] = new Array(N).fill(0);
  for (const e of els) for (const k of e.nodes) { used[k] = true; refs[k]++; }
  const sorted = (ids: Iterable<number>): number[] => [...ids].sort((a, b) => a - b);

  // 1. islands
  const all = new UF(N);
  for (const e of els) for (let i = 1; i < e.nodes.length; i++) all.union(e.nodes[0], e.nodes[i]);
  const groups = (uf: UF, pred: (i: number) => boolean): number[][] => {
    const g = new Map<number, number[]>();
    for (let i = 1; i < N; i++) if (used[i] && pred(i) && uf.find(i) !== uf.find(0)) { const r = uf.find(i); (g.get(r) ?? g.set(r, []).get(r)!).push(i); }
    return [...g.values()].sort((a, b) => a[0] - b[0]);
  };
  const inIsland = new Set<number>();
  for (const g of groups(all, () => true)) {
    g.forEach((i) => inIsland.add(i));
    const ge = els.filter((e) => e.nodes.some((k) => g.includes(k))).map((e) => e.id);
    out.push({ code: 'island', severity: 'warn', nodes: g.map(name), elements: ge, key: 'topo.island', vars: { nodes: names(g), elements: ge.join(', ') } });
  }

  // 2. DC-floating / cutset
  const dc = new UF(N);
  for (const e of els) { const t = topo.get(e)!; for (const [a, b] of [...t.dc, ...t.ideal]) dc.union(e.nodes[a], e.nodes[b]); }
  for (const g of groups(dc, (i) => !inIsland.has(i))) {
    const forced = els.filter((e) => topo.get(e)!.forced.some(([a, b]) => g.includes(e.nodes[a]) || g.includes(e.nodes[b])));
    if (forced.length) {
      const ids = forced.map((e) => e.id);
      out.push({ code: 'cutset', severity: 'block', nodes: g.map(name), elements: ids, key: 'topo.cutset', vars: { nodes: names(g), elements: ids.join(', ') } });
    } else out.push({ code: 'dcFloating', severity: 'warn', nodes: g.map(name), elements: [], key: 'topo.dcFloating', vars: { nodes: names(g) } });
  }

  // 3. zero-impedance loops and shorted sources
  const iv = new UF(N);
  const edges: { a: number; b: number; id: string }[] = [];
  for (const e of els) {
    const t = topo.get(e)!;
    for (const [pa, pb] of t.ideal) {
      const a = e.nodes[pa], b = e.nodes[pb];
      if (a === b) { out.push({ code: 'shorted', severity: 'block', nodes: [name(a)], elements: [e.id], key: 'topo.shorted', vars: { node: name(a), element: e.id } }); continue; }
      if (iv.union(a, b)) { edges.push({ a, b, id: e.id }); continue; }
      // cycle: BFS path a → b over earlier edges
      const prev = new Map<number, { from: number; id: string }>([[a, { from: -1, id: '' }]]);
      const q = [a];
      for (let h = 0; h < q.length && !prev.has(b); h++) for (const ed of edges) {
        const nx = ed.a === q[h] ? ed.b : ed.b === q[h] ? ed.a : -1;
        if (nx >= 0 && !prev.has(nx)) { prev.set(nx, { from: q[h], id: ed.id }); q.push(nx); }
      }
      const ids = [e.id], ns = [b];
      for (let c = b; prev.get(c)!.from >= 0; c = prev.get(c)!.from) { ids.push(prev.get(c)!.id); ns.push(prev.get(c)!.from); }
      const eid = ids.filter((x, i) => ids.indexOf(x) === i).sort((x, y) => els.findIndex((z) => z.id === x) - els.findIndex((z) => z.id === y));
      edges.push({ a, b, id: e.id });
      out.push({ code: 'vloop', severity: 'block', nodes: sorted(ns).map(name), elements: eid, key: 'topo.vloop', vars: { elements: eid.join(', '), nodes: names(sorted(ns)) } });
    }
    if (t.source && e.nodes[t.source[0]] === e.nodes[t.source[1]] && !t.ideal.some(([a, b]) => a === t.source![0] && b === t.source![1])) {
      const nn = e.nodes[t.source[0]];
      out.push({ code: 'shorted', severity: 'warn', nodes: [name(nn)], elements: [e.id], key: 'topo.shortedReal', vars: { node: name(nn), element: e.id } });
    }
  }

  // 4. unconnected
  for (let i = 1; i < N; i++) if (refs[i] === 1) {
    const e = els.find((z) => z.nodes.includes(i))!;
    out.push({ code: 'unconnected', severity: 'info', nodes: [name(i)], elements: [e.id], key: 'topo.unconnected', vars: { node: name(i), element: e.id } });
  }
  return out;
}
