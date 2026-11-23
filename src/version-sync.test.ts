// The version lives in several files (GRID shipped 1.18.0 labelled 1.17.0 because two were not bumped). Every one of them must agree with
// the newest versioned CHANGELOG heading, including the site's download button, the wiki's status line and the README banner, which the
// owner reads first ("before you release another iteration, update the websites, wiki and screenshots").
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const read = (p: string): string => readFileSync(join(__dirname, '..', p), 'utf8');
const changelogVersion = /^## \[(\d+\.\d+\.\d+)\]/m.exec(read('CHANGELOG.md'))?.[1];

describe('version sync', () => {
  it('the newest CHANGELOG heading has a version', () => {
    expect(changelogVersion).toMatch(/^\d+\.\d+\.\d+$/);
  });
  it('package.json matches the CHANGELOG', () => {
    expect(JSON.parse(read('package.json')).version).toBe(changelogVersion);
  });
  it('godot/project.godot config/version matches the CHANGELOG (the title shows it)', () => {
    expect(/^config\/version="([^"]+)"/m.exec(read('godot/project.godot'))?.[1]).toBe(changelogVersion);
  });
  it('the macOS export preset versions match the CHANGELOG', () => {
    const p = read('godot/export_presets.cfg');
    expect(/^application\/short_version="([^"]+)"/m.exec(p)?.[1]).toBe(changelogVersion);
    expect(/^application\/version="([^"]+)"/m.exec(p)?.[1]).toBe(changelogVersion);
  });
  it('the site download button names the CHANGELOG version', () => {
    expect(/id="dl-main-label">Download v(\d+\.\d+\.\d+)</.exec(read('site/index.html'))?.[1]).toBe(changelogVersion);
  });
  it('the wiki status line names the CHANGELOG version', () => {
    expect(/class="status">Version (\d+\.\d+\.\d+)/.exec(read('site/wiki/index.html'))?.[1]).toBe(changelogVersion);
  });
  it('the README banner names the CHANGELOG version', () => {
    expect(/^> \*\*v(\d+\.\d+\.\d+)/m.exec(read('README.md'))?.[1]).toBe(changelogVersion);
  });
});
