// The four recorded metrics of a pass (DESIGN §2.6, §11.1), all integers: cost (pack minor units), parts, power (µW), area (pads²).
import type { RegionPack } from '@core/regions';
import type { Board } from '../sim/board/types';
import { pinPads } from '../sim/board/footprints';
import { PRICES_GLOBAL_CENTS, priceCents } from '../regions/global/prices';
import type { NodeRegionData } from '../regions/data';
import { getDef } from './board';
import type { Metrics } from './state';

/** Price of one placed part in the pack's minor units. Valued electrolytics add the value surcharge of the global table scaled by the pack's price factor (in = global x 84). */
export function partPrice(pack: Pick<RegionPack<NodeRegionData>, 'data'>, partId: string, variant: string, value: number | null): number {
  const key = `${partId}:${variant}`, p = pack.data.prices[key];
  if (p === undefined) return 0;                       // ideal textbook parts and the like are free
  const g = PRICES_GLOBAL_CENTS[key];
  const factor = g !== undefined && g > 0 && p % g === 0 ? p / g : 1;
  const gl = g === undefined ? 0 : priceCents(partId, variant, value ?? undefined);
  return p + (gl - (g ?? 0)) * factor;
}

/** Cost, part count and area of the player's placed parts and wires (fixed fixtures excluded); power is filled in by the bench. */
export function boardMetrics(board: Board, pack: Pick<RegionPack<NodeRegionData>, 'data'>, powerUw = 0): Metrics {
  let cost = 0, parts = 0, x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  const cover = (x: number, y: number): void => { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; };
  for (const p of board.parts) {
    if (p.fixed) continue;
    parts++; cost += partPrice(pack, p.partId, p.variant, p.value);
    const d = getDef(p.partId); if (d) for (const q of pinPads(p, d)) cover(q[0], q[1]);
  }
  for (const w of board.wires) for (const q of w.path) cover(q[0], q[1]);
  const area = x1 >= x0 ? (x1 - x0 + 1) * (y1 - y0 + 1) : 0;
  return { cost, parts, power: Math.round(powerUw), area };
}
