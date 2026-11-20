// `global` pack part prices: integer US cents at qty 100, keyed `${partId}:${variantId}` (valued families: `${partId}:${variantId}`
// is the price of any value in the family, except electrolytics which also depend on the value, see `priceCents`). Filled by the part
// catalogue task (M1-D1). Until browser data entry (M3-D2) every price is a GAME ESTIMATE (`priceSource: 'game-estimate-2026'`,
// DESIGN §4.0), shown in the Codex as "approximate distributor price, qty 100"; only the relative orderings are tested (prices.test.ts).
// Where DESIGN §4.2/4.3 gives a ~USD column it is used (x100 cents); the rest is invented for the game and labelled so here.
// The only two real listings the review obtained (1N4007 ~ $0.05, LM7805 ~ $0.58-1.55 @100) are not used: the game values are
// deliberately smaller so a 20-part ticket stays inside a small wallet.

export const PRICE_SOURCE_GLOBAL = 'game-estimate-2026';

export const PRICES_GLOBAL_CENTS: Record<string, number> = {
  // Resistors (per rating; DESIGN §4.1 "priced per rating"). 1 W (7) is dearer than two 1/2 W (2 x 3 = 6), so ticket 1-3's Ref B (2 x 47 ohm 1/2 W) is the cheaper design (DESIGN §2.8). Game values, ordered 1/6 < 1/4 < 1/2 < 1 < 2 < 5 W wirewound.
  'res-cf:0.167W': 1, 'res-cf:0.25W': 2, 'res-cf:0.5W': 3, 'res-cf:1W': 7, 'res-cf:2W': 10,
  'res-ww5:5W': 40, 'res-mf:0.25W': 3, 'pot-trim:0.5W': 30, 'pot-panel:0.25W': 15,
  // Capacitors. cap-el: the voltage base only; the value surcharge is added by priceCents.
  'cap-cer:50V': 3, 'cap-x2:275VAC': 15, 'cap-var:365pF': 150,
  'cap-el:6.3V': 3, 'cap-el:10V': 4, 'cap-el:16V': 5, 'cap-el:25V': 7, 'cap-el:35V': 9, 'cap-el:50V': 12,
  // Inductors and the transformer (game values; litz costs more than the cheap coil, DESIGN §4.0).
  'ind-ax:0.1A': 12, 'ind-ax:0.3A': 20, 'ind-pwr:0.5A': 30, 'ind-pwr:1.0A': 45, 'ind-pwr:1.5A': 60,
  'ind-coil:cheap': 25, 'ind-coil:litz': 60, 'xfmr-12:6VA': 250,
  // Diodes (DESIGN §4.2 ~USD x100)
  '1n4148:DO35': 2, '1n4007:DO41': 2, '1n5819:DO41': 4, '1n4733a:DO41': 4, '1n4742a:DO41': 4, '1n4728a:DO41': 4, 'bzx55c5v1:DO35': 3,
  'led-red-5mm:5mm': 3, 'led-yellow-5mm:5mm': 3, 'led-green-5mm:5mm': 3, 'led-blue-5mm:5mm': 3, 'led-white-5mm:5mm': 3,
  // Transistors
  '2n3904:TO92': 3, '2n3906:TO92': 3, '2n2222a:TO92': 4, 'bc547b:TO92': 3, 'tip120:TO220': 25,
  '2n7000:TO92': 5, 'irlz44n:TO220': 50, 'irf540n:TO220': 45,
  // ICs (DESIGN §4.3 ~USD x100)
  'lm741:DIP8': 15, 'lm358:DIP8': 8, 'tl072:DIP8': 15, 'ne5532:DIP8': 25, 'mcp6002:DIP8': 20, 'lm393:DIP8': 8, 'ne555:DIP8': 10,
  'lm7805:TO220': 15, 'lm317:TO220': 25,
  // Misc (game values; no DESIGN price)
  'relay-12v:5A': 120, 'fuse:0.4A': 8, 'fuse:1A': 8, 'ntc-10k:B3950': 12, 'heater:12V': 100, 'speaker-8:8ohm': 80, 'piezo:buzzer': 60,
  'fan-dc:12V': 200, 'slidewire:100cm': 300, 'galvanometer:100ohm': 500,
  // Chapter 2 fixtures and bench items (game values): the customer's fixed parts are priced only so the Sandbox never shows a free part; res-box plugs and the trimmer are bin items.
  'adc-in:10k': 100, 'cable-loop:loop': 100, 'cell-2v:2V': 150, 'cell-test:1.5V': 100, 'blackbox:sealed': 500, 'slidewire-m:100cm': 300, 'res-box:plug': 12, 'trimmer:0.5W': 25,
  // Batteries (game values)
  'bat-pp3:fresh': 100, 'bat-pp3-tired:tired': 100, 'bat-aa:fresh': 40, 'bat-cr2032:fresh': 30,
  // Textbook ideal parts (bat ideal-*, res-exact) are free: no entry.
};

/**
 * Price in integer US cents of one part. Valued families are priced per family + variant, EXCEPT aluminium electrolytics
 * (`cap-el`), whose price also grows with capacitance: base(variant voltage) + floor(0.35 * sqrt(C in uF)). For E6 values this is
 * strictly increasing (680 uF: +9, 1000: +11, 2200: +16, 4700: +24) and the voltage base is strictly increasing, so higher C and higher
 * voltage always cost more. Game estimate, like the rest of the table.
 */
export function priceCents(partId: string, variantId: string, value?: number): number {
  const base = PRICES_GLOBAL_CENTS[`${partId}:${variantId}`];
  if (base === undefined) throw new Error(`No price for ${partId}:${variantId}`);
  if (partId === 'cap-el' && value !== undefined) return base + Math.floor(0.35 * Math.sqrt(value * 1e6));
  return base;
}
