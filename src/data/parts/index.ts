// The part catalogue (DESIGN §4). Physics only; prices and availability are region-pack data.
import type { PartDef } from './types';
import { RESISTORS } from './resistors';
import { CAPACITORS } from './capacitors';
import { INDUCTORS } from './inductors';
import { DIODES } from './diodes';
import { TRANSISTORS } from './transistors';
import { ICS } from './ics';
import { MISC } from './misc';
import { SOURCES } from './sources';

export { RES_CF_CAMPAIGN_RANGE } from './resistors';
export { INSTRUMENTS, type InstrumentDef } from './instruments';
export type { PartDef, Variant, Thermal, Source, PartKind, FootprintId } from './types';

export const PARTS: PartDef[] = [...RESISTORS, ...CAPACITORS, ...INDUCTORS, ...DIODES, ...TRANSISTORS, ...ICS, ...MISC, ...SOURCES];

const BY_ID: Record<string, PartDef> = {};
for (const p of PARTS) BY_ID[p.id] = p;

/** Edit distance (Levenshtein), for the "did you mean" list. */
function distance(a: string, b: string): number {
  let prev: number[] = [];
  for (let j = 0; j <= b.length; j++) prev.push(j);
  for (let i = 1; i <= a.length; i++) {
    const cur = [i];
    for (let j = 1; j <= b.length; j++) cur.push(Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1)));
    prev = cur;
  }
  return prev[b.length];
}

/** Part ids that look like `id`: substring matches first, then the closest by edit distance (at most 5). */
export function nearMatches(id: string): string[] {
  const q = id.toLowerCase();
  const scored = PARTS.map((p) => {
    const pid = p.id.toLowerCase();
    const sub = q.length >= 2 && (pid.includes(q) || q.includes(pid)) ? 0 : 1;
    return { id: p.id, sub, d: distance(q, pid) };
  });
  scored.sort((x, y) => x.sub - y.sub || x.d - y.d || (x.id < y.id ? -1 : 1));
  return scored.filter((s) => s.sub === 0 || s.d <= Math.max(3, Math.floor(q.length / 2))).slice(0, 5).map((s) => s.id);
}

export function findPart(id: string): PartDef | undefined {
  return Object.prototype.hasOwnProperty.call(BY_ID, id) ? BY_ID[id] : undefined;
}

/** The part with this id. Unknown ids throw an error that lists the near matches (a typo in a level bin should teach, not just fail). */
export function partById(id: string): PartDef {
  const p = findPart(id);
  if (p) return p;
  const near = nearMatches(id);
  throw new Error(`Unknown part id "${id}". ${near.length ? `Did you mean: ${near.join(', ')}?` : 'No similar ids.'} (${PARTS.length} parts in the catalogue.)`);
}

/** A must-ship ticket needs this part but the data could not be verified here, so it is Sandbox-only until it is. The campaign cannot ship that ticket yet. */
export interface CampaignBlocker { partId: string; tickets: string[]; reason: string }
export const CAMPAIGN_BLOCKERS: CampaignBlocker[] = [
  { partId: 'cap-el', tickets: ['3-1', '3-2', '4-1', '8-1'], reason: 'Panasonic EEU-FR rows are verified for 220-4700 uF at 10/16/25/35 V where the series lists them (valueData, incl. 4-1 680 and 1000 uF at 25 V). NOT in the series and so unverified/Sandbox-only: 330 uF at 10 V, 330 uF at 16 V, 4700 uF at 25 V, 4700 uF at 35 V, 3300 uF at 35 V; 4-1 must not offer them in a campaign bin. Tickets 3-1/3-2/8-1 still need their values (below 220 uF, 6.3/50 V) read.' },
  { partId: 'xfmr-12', tickets: ['4-1'], reason: 'GAME-DEFINED level fixture (6 VA / 1.5 ohm / 10 H), no datasheet by design (DESIGN marks it [R]): ticket 4-1 must carry it as a fixed board part, not a shop bin item. Needs no data work; open items are the region-driven turns ratio and the 9 V tap / 12-0-12 versions (need a 5-pin footprint).' },
  { partId: 'cap-cer', tickets: ['3-2', '6-6', '7-2', '8-5'], reason: 'Murata/TDK C0G/X7R tables not read.' },
  { partId: 'cap-x2', tickets: ['7-1'], reason: 'Generic X2 film capacitor, IEC 60384-14 not read.' },
  { partId: 'cap-var', tickets: ['7-3'], reason: 'Generic AM tuning gang, no datasheet.' },
  { partId: 'ind-pwr', tickets: ['8-3'], reason: 'Wurth WE-PD table not read; DCR values are estimates.' },
  { partId: 'ind-coil', tickets: ['7-3'], reason: 'Game-defined coils (ESR 25 / 4 ohm).' },
  { partId: '2n2222a', tickets: ['5-1'], reason: 'onsemi P2N2222A/D answers 403; the model values (Is 1e-14, Bf 200, Br 3, Vaf 100) have no cited source.' },
  { partId: 'bc547b', tickets: ['5-1', '5-4'], reason: 'onsemi BC546 answers 403; the model is a recall fit (DESIGN [R fit]).' },
  { partId: 'bat-pp3-tired', tickets: ['1-2'], reason: 'Game-defined scenario (8.4 V / 6 ohm); 1-2 should carry it in its conditions, not in the catalogue.' },
  { partId: 'heater', tickets: ['1-3'], reason: 'Game-defined 50 ohm fixture; 1-3 should carry it in its board setup.' },
  { partId: 'slidewire', tickets: ['2-2', '2-4'], reason: 'Game-defined fixture (100 cm, 10 ohm).' },
  { partId: 'galvanometer', tickets: ['2-2', '2-4'], reason: 'Game-defined fixture (100 ohm ammeter).' },
  { partId: 'relay-12v', tickets: ['3-3'], reason: 'Generic relay, no datasheet.' },
  { partId: 'fan-dc', tickets: ['5-1'], reason: 'Generic DC fan; R and L are estimates.' },
  { partId: 'ntc-10k', tickets: ['6-5'], reason: 'Generic NTC, no datasheet.' },
];
