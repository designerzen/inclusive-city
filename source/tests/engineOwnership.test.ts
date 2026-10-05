import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readdirSync, readFileSync } from 'node:fs';

// Screen factories receive the application renderer. They must never allocate another context.
test('only the application entry point can create a Babylon engine', () => {
  const root = new URL('../src/', import.meta.url);
  const constructors = readdirSync(root, { recursive: true, encoding: 'utf8' })
    .filter(file => file.endsWith('.ts'))
    .flatMap(file => [...readFileSync(new URL(file.replaceAll('\\', '/'), root), 'utf8')
      .matchAll(/new\s+Engine\s*\(/g)].map(() => file));
  assert.deepEqual(constructors, ['main.ts']);
});
