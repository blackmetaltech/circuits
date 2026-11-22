// LOOK2: every 3D texture must be imported with mipmaps (and VRAM compression), or it aliases when minified: grain and sparkle.
import { describe, expect, it } from 'vitest';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = join(__dirname, '..', 'godot', 'look2', 'assets');
const imports = (dir: string): string[] => readdirSync(dir, { withFileTypes: true }).flatMap((d) => d.isDirectory() ? imports(join(dir, d.name)) : d.name.endsWith('.import') ? [join(dir, d.name)] : []);

describe('LOOK2 3D texture imports', () => {
  const tex = imports(ROOT).filter((f) => /importer="texture"/.test(readFileSync(f, 'utf8')));
  it('finds the textures', () => { expect(tex.length).toBeGreaterThanOrEqual(7); });
  it.each(tex.map((f) => [f.slice(ROOT.length + 1)]))('%s has mipmaps on and VRAM compression', (rel) => {
    const s = readFileSync(join(ROOT, rel!), 'utf8');
    expect(s).toMatch(/^mipmaps\/generate=true$/m);
    expect(s).toMatch(/^compress\/mode=2$/m);
    if (/_nor_/.test(rel!)) expect(s).toMatch(/^compress\/normal_map=1$/m);
  });
  it('project defaults keep new textures mipmapped', () => {
    expect(readFileSync(join(__dirname, '..', 'godot', 'project.godot'), 'utf8')).toMatch(/\[importer_defaults\][\s\S]*"mipmaps\/generate": true/);
  });
});
