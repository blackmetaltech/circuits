// The game's region registry. `global` ships; `in` (India) and `na` (120 V / 60 Hz, test-only) are drafts that exercise the seam
// (regions.test.ts runs the whole game in every registered pack and checks that no regional token leaks across packs).
//
// Add a region:
//   1. src/regions/<id>/index.ts: `export const XX = defineRegion<NodeRegionData>({...}, validateNodeData)` (copy `in/`)
//   2. register it below. Packs with status 'draft' are playable but not listed by init().
//   3. run `pnpm test`: the start, leak and ruleset tests cover the new pack automatically.
// Bump a pack's `rulesetVersion` whenever a data change can change a level score (it is part of every solution code).
import { RegionRegistry } from '@core/regions';
import { validateNodeData, type NodeRegionData } from './data';
import { GLOBAL } from './global';
import { IN } from './in';
import { NA } from './na';

export const REGIONS = new RegionRegistry<NodeRegionData>({ validateData: validateNodeData, defaultId: 'global' })
  .register(GLOBAL)
  .register(IN)
  .register(NA);
