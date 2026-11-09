// TEST-ONLY region pack: North America (120 V, 60 Hz). Never offered to players (status 'draft'); it exists so that the mains/frequency
// seam is exercised in every `pnpm test`. Names and currency reuse `global`'s on purpose (the leak test allows tokens a pack shares).
import { defineRegion } from '@core/regions';
import { LAWS } from '../../sim/laws';
import { validateNodeData, type NodeRegionData } from '../data';
import { PRICES_GLOBAL_CENTS } from '../global/prices';
import { GLOBAL } from '../global';

export const NA = defineRegion<NodeRegionData>({
  id: 'na', name: 'North America (test only)', status: 'draft', rulesetVersion: 1,
  currency: GLOBAL.currency, numbers: GLOBAL.numbers,
  standards: { mains: 'ANSI C84.1 range A', eseries: 'IEC 60063', suppression: 'IEC 60384-14 X2' },
  data: {
    vtAt300K: LAWS.vtAt300K,
    mains: { volts: 120, hz: 60, tolerance: 0.1 },
    prices: { ...PRICES_GLOBAL_CENTS }, priceSource: 'global game estimates',
    unavailable: [], examBridge: { set: 'global' }, syllabus: {},
  },
  strings: { ...GLOBAL.strings },
}, validateNodeData);
