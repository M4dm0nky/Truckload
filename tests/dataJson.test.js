import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { PRESET_CASES } from '../js/data/preset-cases.js';
import { CASE_LIBRARY } from '../js/data/case-library.js';

const file = name => JSON.parse(readFileSync(new URL(`../data/${name}.json`, import.meta.url), 'utf8'));

test('standard.json: Format, ID, 57 Vorlagen mit preset-ID, alle mitgeliefert', () => {
  const f = file('standard');
  assert.equal(f.format, 'truckload-collection');
  assert.equal(f.id, 'standard');
  assert.equal(f.cases.length, 57);
  assert.ok(f.cases.every(c => c.builtin === true && c.id.startsWith('preset-')));
  assert.equal(new Set(f.cases.map(c => c.id)).size, 57);
});

test('meine.json: 137 Listen-Cases mit lib-ID, alle mitgeliefert', () => {
  const f = file('meine');
  assert.equal(f.id, 'meine');
  assert.equal(f.cases.length, 137);
  assert.ok(f.cases.every(c => c.builtin === true && c.id.startsWith('lib-')));
  assert.equal(new Set(f.cases.map(c => c.id)).size, 137);
});

test('Die Module PRESET_CASES und CASE_LIBRARY liefern genau den Inhalt der Dateien', () => {
  assert.deepEqual(PRESET_CASES, file('standard').cases);
  assert.deepEqual(CASE_LIBRARY, file('meine').cases);
});
