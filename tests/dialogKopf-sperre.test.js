import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const DATEIEN = ['case-editor', 'dolly-wizard', 'geraete-schritt', 'lkw-editor', 'load-wizard', 'pack-rules',
  'tabellen-import', 'truck-editor', 'truss-wizard'];
const quelle = n => readFileSync(new URL(`../js/ui/${n}.js`, import.meta.url), 'utf8');

for (const n of DATEIEN) {
  test(`${n}: kein <h2> außerhalb von dialogKopf()`, () => {
    assert.doesNotMatch(quelle(n), /<h2>/);
    assert.match(quelle(n), /dialogKopf\(/);
  });
}

test('showPick: Kopf mit Titel, das <select> trägt aria-label mit dem Titel', () => {
  const q = quelle('confirmDialog');
  const pick = q.slice(q.indexOf('export function showPick'), q.indexOf('export function showPrompt'));
  assert.match(pick, /dialogKopf\(/);
  assert.match(pick, /<select name="v" aria-label="\$\{esc\(title\)\}"/);
});
