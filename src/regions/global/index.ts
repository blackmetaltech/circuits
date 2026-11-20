// The default region: a neutral, fictional setting, US$, international standards. Ships in v0.1.
import { defineRegion } from '@core/regions';
import { LAWS } from '../../sim/laws';
import { validateNodeData, type NodeRegionData } from '../data';
import { PRICES_GLOBAL_CENTS, PRICE_SOURCE_GLOBAL } from './prices';

export const GLOBAL = defineRegion<NodeRegionData>({
  id: 'global', name: 'Global', status: 'shipping', rulesetVersion: 1,
  currency: { code: 'USD', symbol: '$', decimals: 2, position: 'prefix' },
  numbers: { grouping: 'western', decimal: '.', group: ',' },
  standards: { mains: 'IEC 60038', eseries: 'IEC 60063', suppression: 'IEC 60384-14 X2' },
  data: {
    vtAt300K: LAWS.vtAt300K,
    mains: { volts: 230, hz: 50, tolerance: 0.1 },
    prices: PRICES_GLOBAL_CENTS, priceSource: PRICE_SOURCE_GLOBAL,
    unavailable: [], examBridge: { set: 'global' }, syllabus: {},
  },
  strings: {
    stall: 'Stall 14', lane: 'Lantern Lane', mentor: 'Wren', cat: 'Rezzy',
    'customer.kid_torch': 'Lio', 'customer.cyclist': 'Ash', 'customer.aquarium': 'Mr. Brook', 'customer.toycar': 'Bo', 'customer.weather': 'Kaya',
    'customer.exam': 'The exam desk', 'customer.irrigation': 'Sami', 'customer.wallwart': 'Mrs. Dale', 'customer.radio': 'Iris', 'customer.musician': 'Juno',
    'customer.cablecrew': 'Foreman Dunn', 'customer.sensorshop': 'Tomo',
  },
}, validateNodeData);
