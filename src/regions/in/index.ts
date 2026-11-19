// DRAFT region pack: India (DESIGN Appendix A). Not shipping in v0.1 (status 'draft': not offered to players), kept and tested so the
// region seam stays honest. Everything Indian lives here: rupees with lakh/crore grouping, local names, local prices.
// Prices: the `global` US-cent price x 84 (INR per US$, the original design's fixed rate) in paise. Mains per the CEA regulations
// [R: citation to be verified before the pack ships].
import { defineRegion } from '@core/regions';
import { LAWS } from '../../sim/laws';
import { derivePrices, validateNodeData, type NodeRegionData } from '../data';
import { PRICES_GLOBAL_CENTS } from '../global/prices';

/** INR per US$ used to derive this pack's prices. */
export const INR_PER_USD = 84;

export const IN = defineRegion<NodeRegionData>({
  id: 'in', name: 'India (draft)', status: 'draft', rulesetVersion: 1,
  currency: { code: 'INR', symbol: '₹', decimals: 2, position: 'prefix' },
  numbers: { grouping: 'indian', decimal: '.', group: ',' },
  standards: { mains: 'CEA regulations (draft)', eseries: 'IEC 60063', suppression: 'IEC 60384-14 X2' },
  data: {
    vtAt300K: LAWS.vtAt300K,
    mains: { volts: 230, hz: 50, tolerance: 0.1 },
    prices: derivePrices(PRICES_GLOBAL_CENTS, INR_PER_USD), priceSource: `global game estimates x ${INR_PER_USD} INR per US$`,
    unavailable: [], examBridge: { set: 'in' }, syllabus: {},
  },
  strings: {
    stall: 'Stall 14', lane: 'Signal Gully', mentor: 'Meera Aunty', cat: 'Rezzy',
    'customer.kid_torch': 'Priya', 'customer.cyclist': 'Arjun', 'customer.aquarium': 'Mr. Iyer', 'customer.toycar': 'Bunty', 'customer.weather': 'Kavya',
    'customer.exam': 'The exam desk', 'customer.irrigation': 'Ravi', 'customer.wallwart': "Mrs. D'Souza", 'customer.radio': 'Abba', 'customer.musician': 'Lata',
  },
  leakMarkers: ['₹', 'lakh', 'crore', 'Diwali', 'NCERT', 'JEE', 'bazaar', 'Lamington'],
}, validateNodeData);
