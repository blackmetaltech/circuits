// How a placed part is named to the player: "the LED", "LED 2", "the 100 Ω ¼ W resistor", "the battery", "source E1". Never a uid ("p1"):
// every message the engine writes (board edits, burns, bench failures) goes through here. Pure functions of the board.
import type { Board, PlacedPart } from '../sim/board/types';
import { sig, si } from '../sim/explain';
import { t } from '../i18n';
import { findPart } from '../data/parts';
import { say } from './text';

/** ¼ W, ½ W, ⅙ W, 1 W, 5 W. */
export function wattText(p: number): string {
  if (Math.abs(p - 1 / 6) < 0.005) return '⅙ W';
  if (Math.abs(p - 0.25) < 0.001) return '¼ W';
  if (Math.abs(p - 0.5) < 0.001) return '½ W';
  return `${sig(p, 3)} W`;
}

const cap = (s: string): string => (s === '' ? s : s[0]!.toUpperCase() + s.slice(1));
export const capFirst = cap;

/** The description of one part without any disambiguation: "the LED", "the 470 Ω ¼ W resistor". */
function plainName(p: PlacedPart): string {
  const d = findPart(p.partId);
  if (!d) return p.uid;
  if (d.kind === 'LED') return say('name.led');
  if (p.partId === 'ideal-vsource') return say('name.source');
  if (p.partId.startsWith('bat-pp3')) return say('name.battery');
  if (d.kind === 'HEATER') return say('name.heater');
  if (d.kind === 'R' && p.value !== null) {
    const v = d.variants.find((x) => x.id === p.variant) ?? d.variants[0];
    const watts = p.variant !== 'ideal' && v?.ratings.P ? ` ${wattText(v.ratings.P)}` : '';
    return say('name.resistor', { value: si(p.value, 'Ω') + watts });
  }
  return `the ${t(d.nameKey).toLowerCase()}`;
}

/** uid -> the player's name for it. Parts with the same description get an ordinal (LED 1, LED 2; the first / second 100 Ω resistor). */
export function partNames(board: Pick<Board, 'parts'>): Record<string, string> {
  const out: Record<string, string> = {}, byName = new Map<string, PlacedPart[]>();
  let nSrc = 0;
  for (const p of board.parts) {
    if (p.partId === 'ideal-vsource') { nSrc += 1; out[p.uid] = say('name.source.n', { n: nSrc }); continue; }
    const key = plainName(p); byName.set(key, [...(byName.get(key) ?? []), p]);
  }
  for (const [key, list] of byName) {
    if (list.length === 1) { out[list[0]!.uid] = key; continue; }
    list.forEach((p, i) => {
      const d = findPart(p.partId);
      out[p.uid] = d?.kind === 'LED' ? say('name.led.n', { n: i + 1 }) : say('name.again', { name: key, n: i + 1 });
    });
  }
  return out;
}

export const partName = (board: Pick<Board, 'parts'>, uid: string): string => partNames(board)[uid] ?? uid;

/** Failure vars with `part` turned from a uid into the player's name (and the sentence-start form `Part`). */
export function nameVars(board: Pick<Board, 'parts'>, vars: Record<string, string | number>): Record<string, string | number> {
  const uid = vars.part;
  if (typeof uid !== 'string') return vars;
  const name = partName(board, uid);
  return { ...vars, part: name, Part: cap(name) };
}
