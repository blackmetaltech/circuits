// Owner rule (bible 09, 2026-11-23): never sell with "real X" ("real circuits", "real parts", "real physics", "reality check").
// Say what the player does, and keep the specific true statement without the word. This fails on the word "real" (and
// "really", "reality", "realistic", "realism") in every player-facing text: the locale strings, the in-game Godot string
// literals, the README, the CHANGELOG (it becomes the release notes) and the site and wiki. Code comments and the internal
// design docs are not player-facing and are not scanned.
import { describe, expect, it } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { en } from './locales/en';
import { ch3En } from './locales/ch3.en';
import { ch4En } from './locales/ch4.en';
import { ch5En } from './locales/ch5.en';
import { partsEn } from './locales/parts.en';
import { simEn } from './locales/sim.en';

const BANNED = /\breal(ly|ity|istic|ism)?\b/i;
const ROOT = join(__dirname, '..');

function walk(dir: string, ext: string, skip: RegExp | null = null): string[] {
  const out: string[] = [];
  for (const n of readdirSync(dir)) {
    const p = join(dir, n);
    if (skip && skip.test(p)) continue;
    if (statSync(p).isDirectory()) out.push(...walk(p, ext, skip));
    else if (p.endsWith(ext)) out.push(p);
  }
  return out;
}

/** The double-quoted string literals of one GDScript line, with any # comment outside a string dropped. */
function gdStrings(line: string): string[] {
  const out: string[] = [];
  let cur: string | null = null;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (cur === null) {
      if (c === '#') break;
      if (c === '"') cur = '';
    } else if (c === '\\') { cur += line[i + 1] ?? ''; i++; }
    else if (c === '"') { out.push(cur); cur = null; }
    else cur += c;
  }
  return out;
}

/** Each hit as "where: the text around it". */
function hits(where: string, text: string): string[] {
  const m = BANNED.exec(text);
  return m ? [`${where}: ...${text.slice(Math.max(0, m.index - 40), m.index + 40)}...`] : [];
}

describe('player-facing text never sells with "real X" (bible 09)', () => {
  it('locale strings', () => {
    const found: string[] = [];
    for (const [name, table] of Object.entries({ en, ch3En, ch4En, ch5En, partsEn, simEn }))
      for (const [k, v] of Object.entries(table)) found.push(...hits(`${name}.${k}`, v));
    expect(found).toEqual([]);
  });

  it('in-game Godot string literals', () => {
    const found: string[] = [];
    for (const f of walk(join(ROOT, 'godot'), '.gd', /[\\/](tests|dev|addons|build|\.godot)([\\/]|$)/))
      readFileSync(f, 'utf8').split('\n').forEach((l, i) => {
        for (const s of gdStrings(l)) found.push(...hits(`${f.slice(ROOT.length + 1)}:${i + 1}`, s));
      });
    expect(found).toEqual([]);
  });

  it('README, CHANGELOG, site and wiki', () => {
    const files = [join(ROOT, 'README.md'), join(ROOT, 'CHANGELOG.md'), ...walk(join(ROOT, 'site'), '.html')];
    const found: string[] = [];
    for (const f of files)
      readFileSync(f, 'utf8').split('\n').forEach((l, i) => found.push(...hits(`${f.slice(ROOT.length + 1)}:${i + 1}`, l)));
    expect(found).toEqual([]);
  });

  it('the public docs the README links (DESIGN, STATUS, LOOK2), outside backticked identifiers', () => {
    const found: string[] = [];
    for (const f of ['docs/DESIGN.md', 'docs/STATUS.md', 'docs/LOOK2.md'])
      readFileSync(join(ROOT, f), 'utf8').split('\n').forEach((l, i) => found.push(...hits(`${f}:${i + 1}`, l.replace(/`[^`]*`/g, ''))));
    expect(found).toEqual([]);
  });

  it('catches the phrases it is for', () => {
    for (const s of ['a repair bench where real circuits are the rules', 'Reality check: a junction', 'really sees', 'realistic parts'])
      expect(BANNED.test(s)).toBe(true);
    for (const s of ['realloc', 'surreal', 'the measured voltage']) expect(BANNED.test(s)).toBe(false);
    expect(gdStrings('var a := "shown" # a real comment')).toEqual(['shown']);
  });
});
