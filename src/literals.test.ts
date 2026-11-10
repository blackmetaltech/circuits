// No hard-coded player-facing prose in the engine and simulator (PROGRAM.md decision: all strings externalised).
// Heuristic: a string literal that reads as English prose (two words of 3+ letters separated by a space) is an offender, unless the line
// is a developer diagnostic (throws / constructs an Error, console output, or says `literal-ok`). Unit symbols, ids and i18n keys never match.
import { describe, expect, it } from 'vitest';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join, relative } from 'node:path';

const root = fileURLToPath(new URL('.', import.meta.url));
const SCOPES = ['sim', 'engine'];
const PROSE = /[A-Za-z]{3,} [A-Za-z]{3,}/;
// Known debt (reported, not hidden): device `validate()` and compile messages are developer-facing English that can reach the player through
// solve.badValue {detail}; src/sim/mna is frozen for this task. Convert them to { key, vars } and delete these entries.
const KNOWN_DEBT = [/^sim[\\/]mna[\\/]devices[\\/]/, /^sim[\\/]mna[\\/]compile\.ts$/, /^sim[\\/]mna[\\/]tran\.ts$/];
// Test helpers living beside the code (assertion messages, netlist snippets), not shipped text.
const TEST_HELPERS = /^sim[\\/]oracles[\\/]/;
const DEV = /\bError\(|\bconsole\.|literal-ok|\bassert|\bthrow\b/;

function files(dir: string, acc: string[] = []): string[] {
  for (const f of readdirSync(dir).sort()) {
    const p = join(dir, f);
    if (statSync(p).isDirectory()) { if (f !== '__golden__' && f !== 'node_modules') files(p, acc); }
    else if (f.endsWith('.ts') && !/\.(test|prop\.test|fuzz)\.ts$/.test(f) && !/\.fuzz\.ts$/.test(f)) acc.push(p);
  }
  return acc;
}
/** String literal bodies on a line, ignoring comments. */
export function literals(line: string): string[] {
  const code = line.replace(/\/\/.*$/, '');
  return [...code.matchAll(/'((?:[^'\\]|\\.)*)'|"((?:[^"\\]|\\.)*)"|`((?:[^`\\]|\\.)*)`/g)].map((m) => m[1] ?? m[2] ?? m[3] ?? '');
}

describe('literal-string lint', () => {
  it('detects prose and ignores keys, units and diagnostics', () => {
    expect(literals("const a = 'hello there'; // not 'this one'")).toEqual(['hello there']);
    expect(literals('x("a.b.c", \'Ω\')').some((s) => PROSE.test(s))).toBe(false);
    expect(PROSE.test('The LED took')).toBe(true);
  });
  it('src/sim/** and src/engine/** carry no hard-coded prose', () => {
    const offenders: string[] = [];
    for (const s of SCOPES) for (const f of files(join(root, s))) {
      const rel = relative(root, f);
      if (TEST_HELPERS.test(rel) || KNOWN_DEBT.some((d) => d.test(rel))) continue;
      let inBlock = false;
      readFileSync(f, 'utf8').split('\n').forEach((line, i) => {
        const t = line.trim();
        if (inBlock) { if (t.includes('*/')) inBlock = false; return; }
        if (t.startsWith('/*')) { if (!t.includes('*/')) inBlock = true; return; }
        if (t.startsWith('//') || t.startsWith('*') || DEV.test(line)) return;
        if (literals(line).some((l) => PROSE.test(l))) offenders.push(`${relative(root, f)}:${i + 1}: ${t}`);
      });
    }
    expect(offenders).toEqual([]);
  });
});
