// All player-facing text is externalised: locales are complete, and the game never asks for a missing key or variable.
import { describe, expect, it } from 'vitest';
import { checkLocales } from '@core/i18n';
import { Engine, Env } from '@core/kit';
import { GAME } from './game';
import { LOCALES, i18n } from './i18n';
import { en } from './locales/en';
import { partsEn } from './locales/parts.en';
import { simEn } from './locales/sim.en';
import { REGIONS } from './regions';

describe('locales', () => {
  it('every locale has every key of en with the same placeholders', () => {
    expect(checkLocales(LOCALES, 'en')).toEqual({ missing: [], extra: [], badPlaceholders: [] });
  });
  it('en spreads the part and simulator string tables', () => {
    for (const [k, v] of Object.entries({ ...partsEn, ...simEn })) expect(en[k], k).toBe(v);
  });
  it('en has no empty strings and no hard-coded currency symbols', () => {
    for (const [k, v] of Object.entries(en)) { expect(v.trim(), k).not.toBe(''); for (const p of REGIONS.list({ includeDrafts: true })) expect(v, k).not.toContain(p.currency.symbol); }
  });
  it('an opened ticket, bad input and a level run (every region) ask for no missing key or variable', () => {
    i18n.clearMissing();
    for (const region of REGIONS.ids()) {
      const env = new Env(GAME); env.reset({ seed: 1, level: '0-0', region });
      for (let i = 0; i < 10 && env.state.status === 'playing'; i++) env.step({ name: 'tick' });
      const e = new Engine(GAME, { region }); e.autosave = false;
      e.act('closeTicket'); e.act('openTicket', ['nope']); e.act('openTicket', []); e.act('openTicket', ['0-0']); e.act('openTicket', ['0-0']); e.q('ticketCard'); e.q('progress');
      e.init(); e.act('save', ['main']); e.saves.list(); e.act('closeTicket');
    }
    new Engine(GAME).act('newGame', [1]);
    expect(i18n.missingKeys()).toEqual([]); expect(i18n.missingVars()).toEqual([]);
  });
  it('every key in en that this module owns is used somewhere in the game source (part and sim keys belong to their modules)', async () => {
    const { readFileSync, readdirSync, statSync } = await import('node:fs'); const { fileURLToPath } = await import('node:url'); const { join } = await import('node:path');
    const root = fileURLToPath(new URL('.', import.meta.url));
    const files: string[] = [];
    const walk = (d: string) => { for (const f of readdirSync(d)) { const p = join(d, f); if (statSync(p).isDirectory()) { if (f !== 'locales' && f !== '__golden__') walk(p); } else if (/\.ts$/.test(f) && !/\.test\.ts$/.test(f)) files.push(p); } };
    walk(root);
    const src = files.map((f) => readFileSync(f, 'utf8')).join('\n');
    const foreign = new Set([...Object.keys(partsEn), ...Object.keys(simEn)]);
    const unused = Object.keys(en).filter((k) => !foreign.has(k) && !src.includes(`'${k}'`));
    expect(unused).toEqual([]);
  });
});
