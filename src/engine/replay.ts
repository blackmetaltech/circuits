// Replay of a ticket's reference solution as player actions (the expert persona and the core Level solver use the SAME actions a human would).
import type { Action } from '@core/kit';
import type { LevelDef } from '../data/levels/types';
import { getDef } from './board';

export function refActions(def: LevelDef): Action[] {
  const out: Action[] = [];
  def.ref.parts.forEach((p, i) => {
    const uid = `p${i + 1}`;
    out.push({ name: 'placePart', args: [p.partId, p.value, p.variant, p.x, p.y, p.rot, p.flip] });
    const d = getDef(p.partId);
    if (p.pos !== undefined && d?.kind === 'POT') out.push({ name: 'setPot', args: [uid, p.pos] });
    if (p.pos !== undefined && d?.kind === 'SLIDEWIRE') out.push({ name: 'setJockey', args: [uid, p.pos * (d.model.lengthM ?? 1) * 1000] });
  });
  for (const path of def.ref.wires) out.push({ name: 'addWire', args: [path] });
  for (const [uid, mm] of Object.entries(def.ref.jockeys ?? {})) out.push({ name: 'setJockey', args: [uid, mm] });
  if (def.ref.supply) out.push({ name: 'setSupply', args: [def.ref.supply.v, def.ref.supply.ilim] });
  for (const [id, v] of Object.entries(def.ref.predictions ?? {})) out.push({ name: 'predict', args: [id, v] });
  if (def.mains) out.push({ name: 'readSafety', args: [] });
  out.push({ name: 'power', args: [true] }, { name: 'advance', args: [4] }, { name: 'runBench' });
  return out;
}
