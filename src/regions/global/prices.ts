// `global` pack part prices: integer US cents at qty 100, keyed `${partId}:${variantId}` (valued families: `${partId}:${variantId}`
// is the price of any value in the family). Filled by the part catalogue task (M1-D1). Until browser data entry (M3-D2) every
// price is a game value (`priceSource: 'game-estimate-2026'`, DESIGN §4.0); relative orderings are tested.
export const PRICE_SOURCE_GLOBAL = 'game-estimate-2026';
export const PRICES_GLOBAL_CENTS: Record<string, number> = {};
