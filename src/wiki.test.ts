import { describe, expect, it } from 'vitest';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { wikiPages } from './wiki';

const DIR = join(__dirname, '..', 'site', 'wiki');

describe('player wiki', () => {
  it('site/wiki matches the game text (WIKI_WRITE=1 to regenerate)', () => {
    const pages = wikiPages();
    for (const [name, html] of Object.entries(pages)) {
      const f = join(DIR, name);
      if (process.env.WIKI_WRITE) writeFileSync(f, html);
      expect(existsSync(f), `${name} missing`).toBe(true);
      expect(readFileSync(f, 'utf8'), `${name} is stale`).toBe(html);
    }
  });
  it('every image a page shows is in site/wiki (0.6: a still for each job and each testbed device)', () => {
    for (const [name, html] of Object.entries(wikiPages())) {
      for (const m of html.matchAll(/<img src="([^"]+)"/g)) expect(existsSync(join(DIR, m[1]!)), `${name}: ${m[1]} missing`).toBe(true);
    }
  });
  it('has no unfilled placeholders and no local paths', () => {
    for (const [name, html] of Object.entries(wikiPages())) {
      expect(html, name).not.toMatch(/\{[a-zA-Z]+\}/);
      expect(html, name).not.toMatch(/\/home\/|\/tmp\//);
    }
  });
});
