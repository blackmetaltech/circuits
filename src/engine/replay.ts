// Replay of a ticket's reference solution as player actions (the expert persona and the core Level solver use the SAME actions a human would).
import type { Action } from '@core/kit';
import type { LevelDef } from '../data/levels/types';
import { getDef } from './board';

/** A repair ticket's faulty board taken apart (wires, then parts), as a player clears the old work. Empty for a build ticket. */
export function clearFaultActions(def: LevelDef): Action[] {
  const out: Action[] = [];
  if (def.fault) {
    def.fault.wires.forEach((_, i) => out.push({ name: 'deleteWire', args: [`xw${i + 1}`] }));
    def.fault.parts.forEach((_, i) => out.push({ name: 'deletePart', args: [`x${i + 1}`] }));
  }
  return out;
}

export function refActions(def: LevelDef): Action[] {
  const out: Action[] = clearFaultActions(def);
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
