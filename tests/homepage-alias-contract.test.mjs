import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const [homepage, directPrototype] = await Promise.all([
  readFile(new URL('../index.html', import.meta.url), 'utf8'),
  readFile(new URL('../third-person.html', import.meta.url), 'utf8')
]);

function collectIds(html) {
  return [...html.matchAll(/\sid="([^"]+)"/g)]
    .map(match => match[1])
    .sort();
}

function moduleEntry(html) {
  return html.match(/<script type="module" src="([^"]+)"><\/script>/)?.[1] || null;
}

test('public homepage exposes the same runtime DOM contract as the direct prototype', () => {
  assert.deepEqual(collectIds(homepage), collectIds(directPrototype));
});

test('public homepage and direct prototype load the same cache-busted game entry', () => {
  assert.equal(moduleEntry(homepage), moduleEntry(directPrototype));
  assert.equal(moduleEntry(homepage), 'third-person/main.js?v=20260822-safer-dragons-v2');
});
