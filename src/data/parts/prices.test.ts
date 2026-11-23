import { describe, expect, it } from 'vitest';
import { PARTS, partById } from './index';
import { PRICES_GLOBAL_CENTS, PRICE_SOURCE_GLOBAL, priceCents } from '../../regions/global/prices';

const p = (id: string, variant: string, value?: number) => priceCents(id, variant, value);

describe('global prices (game estimates, integer US cents at qty 100)', () => {
  it('labels every price a game estimate', () => {
    expect(PRICE_SOURCE_GLOBAL).toBe('game-estimate-2026');
  });

  it('prices every campaign part x variant as an integer >= 1 (ideal textbook parts are free)', () => {
    for (const part of PARTS.filter((x) => x.scope === 'campaign' && !x.source.definition)) {
      for (const v of part.variants) {
        const key = `${part.id}:${v.id}`;
        const c = part.values ? p(part.id, v.id, part.values[0]) : PRICES_GLOBAL_CENTS[key];
        expect(Number.isInteger(c), key).toBe(true);
        expect(c, key).toBeGreaterThanOrEqual(1);
      }
    }
  });

  it('prices every part x variant (sandbox included) so the Sandbox bin never shows a free part', () => {
    for (const part of PARTS.filter((x) => !x.source.definition)) {
      for (const v of part.variants) {
        const c = part.values ? p(part.id, v.id, part.values[0]) : PRICES_GLOBAL_CENTS[`${part.id}:${v.id}`];
        expect(Number.isInteger(c) && c >= 1, `${part.id}:${v.id}`).toBe(true);
      }
    }
  });

  it('has no price for an unknown part:variant', () => {
    const known = new Set(PARTS.flatMap((x) => x.variants.map((v) => `${x.id}:${v.id}`)));
    for (const k of Object.keys(PRICES_GLOBAL_CENTS)) if (!k.startsWith('service:')) expect(known.has(k), k).toBe(true);
  });

  it('prices exactly the services the engine charges (the courier for a burnt part, the waiting customer\'s tip and its step)', () => {
    expect(Object.keys(PRICES_GLOBAL_CENTS).filter((k) => k.startsWith('service:'))).toEqual(['service:rush', 'service:tip', 'service:tipStep']);
  });

  it('orders resistors by power: 1/6 W < 1/4 W < 1/2 W < 1 W < 2 W < 5 W wirewound', () => {
    const w = ['0.167W', '0.25W', '0.5W', '1W', '2W'].map((v) => p('res-cf', v));
    for (let i = 1; i < w.length; i++) expect(w[i]).toBeGreaterThan(w[i - 1]);
    expect(p('res-ww5', '5W')).toBeGreaterThan(p('res-cf', '1W'));
    expect(p('res-mf', '0.25W')).toBeGreaterThanOrEqual(p('res-cf', '0.25W'));
  });

  it('orders electrolytics by capacitance at the same voltage (2200 > 1000 > 680 uF) and by voltage at the same C', () => {
    for (const v of partById('cap-el').variants.map((x) => x.id)) {
      expect(p('cap-el', v, 2200e-6)).toBeGreaterThan(p('cap-el', v, 1000e-6));
      expect(p('cap-el', v, 1000e-6)).toBeGreaterThan(p('cap-el', v, 680e-6));
      expect(p('cap-el', v, 4700e-6)).toBeGreaterThan(p('cap-el', v, 2200e-6));
    }
    const volts = ['6.3V', '10V', '16V', '25V', '35V', '50V'];
    for (const c of [100e-6, 1000e-6, 2200e-6]) {
      for (let i = 1; i < volts.length; i++) expect(p('cap-el', volts[i], c)).toBeGreaterThan(p('cap-el', volts[i - 1], c));
    }
  });

  it('orders semiconductors: IRLZ44N > 2N7000, IRF540N > 2N7000, TIP120 > 2N3904, 1N5819 > 1N4148', () => {
    expect(p('irlz44n', 'TO220')).toBeGreaterThan(p('2n7000', 'TO92'));
    expect(p('irf540n', 'TO220')).toBeGreaterThan(p('2n7000', 'TO92'));
    expect(p('tip120', 'TO220')).toBeGreaterThan(p('2n3904', 'TO92'));
    expect(p('1n5819', 'DO41')).toBeGreaterThan(p('1n4148', 'DO35'));
  });

  it('orders the ch7 coils: litz costs more than the cheap coil', () => {
    expect(p('ind-coil', 'litz')).toBeGreaterThan(p('ind-coil', 'cheap'));
  });

  it('matches the DESIGN §4.2/4.3 ~USD column (cents) where given', () => {
    const want: [string, string, number][] = [
      ['1n4148', 'DO35', 2], ['1n4007', 'DO41', 2], ['1n5819', 'DO41', 4], ['1n4733a', 'DO41', 4], ['1n4742a', 'DO41', 4], ['1n4728a', 'DO41', 4],
      ['bzx55c5v1', 'DO35', 3], ['led-red-5mm', '5mm', 3], ['2n3904', 'TO92', 3], ['2n3906', 'TO92', 3], ['2n2222a', 'TO92', 4], ['bc547b', 'TO92', 3],
      ['tip120', 'TO220', 25], ['2n7000', 'TO92', 5], ['irlz44n', 'TO220', 50], ['irf540n', 'TO220', 45],
      ['lm741', 'DIP8', 15], ['lm358', 'DIP8', 8], ['tl072', 'DIP8', 15], ['ne5532', 'DIP8', 25], ['mcp6002', 'DIP8', 20], ['lm393', 'DIP8', 8],
      ['ne555', 'DIP8', 10], ['lm7805', 'TO220', 15], ['lm317', 'TO220', 25],
    ];
    for (const [id, v, c] of want) expect(PRICES_GLOBAL_CENTS[`${id}:${v}`], `${id}:${v}`).toBe(c);
  });
});
