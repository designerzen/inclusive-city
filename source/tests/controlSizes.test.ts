import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../src/', import.meta.url));
function files(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap(entry => {
    const path = join(directory, entry.name);
    return entry.isDirectory() ? files(path) : [path];
  });
}

test('control sizing rules never request targets smaller than 44 pixels', () => {
  const sourceFiles = files(root);
  const ids = new Set<string>();
  for (const file of sourceFiles.filter(file => file.endsWith('.ts'))) {
    const source = readFileSync(file, 'utf8');
    for (const [tag] of source.matchAll(/<(?:button|select|summary)\b[^>]*>/g)) {
      const id = tag.match(/\bid="([^"]+)"/)?.[1];
      if (id) ids.add(id);
    }
  }
  for (const file of sourceFiles.filter(file => file.endsWith('.css'))) {
    const css = readFileSync(file, 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');
    for (const [, selectors, declarations] of css.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
      const targetsControl = selectors.split(',').some(selector => {
        const target = selector.trim().split(/\s+|[>+~]/).at(-1) ?? '';
        // Decorative pseudo-elements are icons, not the rendered hit target.
        if (/::(?:before|after)\b/.test(target)) return false;
        return /^(button|select|summary|option)\b/.test(target)
          || (target.startsWith('#') && ids.has(target.slice(1).split(/[:.\[]/)[0]!));
      });
      if (!targetsControl) continue;
      for (const [, property, size] of declarations.matchAll(/(?:^|;)\s*((?:min-|max-)?(?:width|height|inline-size|block-size))\s*:\s*(\d+(?:\.\d+)?)(?:px\b|(?=\s*;))/g)) {
        assert.ok(Number(size) >= 44, `${file}: ${selectors.trim()} sets ${property} to ${size}px`);
      }
    }
  }
});
