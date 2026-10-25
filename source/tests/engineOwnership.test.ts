import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readdirSync, readFileSync } from 'node:fs';

// Each standalone HTML application owns one context. Screen factories receive it.
test('only standalone application entry points can create a Babylon engine', () => {
  const root = new URL('../src/', import.meta.url);
  const constructors = readdirSync(root, { recursive: true, encoding: 'utf8' })
    .filter(file => file.endsWith('.ts'))
    .flatMap(file => [...readFileSync(new URL(file.replaceAll('\\', '/'), root), 'utf8')
      .matchAll(/new\s+Engine\s*\(/g)].map(() => file));
  assert.deepEqual(constructors.sort(), ['bodyDesigner.ts', 'main.ts']);
  for (const [html, entry] of [['index.html', 'main.ts'], ['robot-body.html', 'bodyDesigner.ts']]) {
    const source = readFileSync(new URL(`../${html}`, import.meta.url), 'utf8');
    assert.ok(source.includes(`src="/src/${entry}"`), `${entry} must be a separate HTML application's entry point`);
  }
});
