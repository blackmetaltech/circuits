// Ticket safety rules on the netlist (DESIGN §3.12 `safety`): bleeder present, part class / rating parameter.
import type { Circuit } from '../mna/types';
import type { SafetyRule } from './types';

export interface SafetyResult { ok: boolean; detail: string }

const nodeId = (c: Circuit, n: string): number => { const k = n.toLowerCase(); return k === '0' || k === 'gnd' ? 0 : c.nodeIndex[k] ?? -1; };

export function checkSafety(c: Circuit, rule: SafetyRule): SafetyResult {
  if (rule.rule === 'resistorAcross') {
    const a = nodeId(c, rule.a), b = nodeId(c, rule.b);
    const hit = c.netlist.elements.filter((e) => e.kind === 'R' && e.nodes.length === 2 && ((e.nodes[0] === a && e.nodes[1] === b) || (e.nodes[0] === b && e.nodes[1] === a)));
    if (hit.length === 0) return { ok: false, detail: `${rule.a}-${rule.b}: none` };
    const best = Math.min(...hit.map((e) => e.p.r ?? Infinity));
    return { ok: best <= rule.maxOhm, detail: `${rule.a}-${rule.b}: ${best}` };
  }
  const els = c.netlist.elements.filter((e) => e.kind === rule.kind);
  if (els.length === 0) return { ok: false, detail: `${rule.kind}: none` };
  for (const e of els) {
    const v = e.p[rule.key];
    if (v === undefined || (rule.min !== undefined && v < rule.min) || (rule.max !== undefined && v > rule.max)) return { ok: false, detail: `${e.id}.${rule.key}: ${v}` };
  }
  return { ok: true, detail: '' };
}
