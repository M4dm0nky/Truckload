import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { dialogKopf } from '../js/ui/dom.js';

// Alle UI-Module außer denen, die keine Popups bauen (Inspektor, Bibliothek) und dom.js selbst.
const AUSGENOMMEN = ['inspector', 'library', 'dom'];
const DATEIEN = readdirSync(new URL('../js/ui/', import.meta.url))
  .filter(n => n.endsWith('.js')).map(n => n.slice(0, -3)).filter(n => !AUSGENOMMEN.includes(n)).sort();
const quelle = n => readFileSync(new URL(`../js/ui/${n}.js`, import.meta.url), 'utf8');

// Popup-Dateien: alles, was dialogKopf() ruft oder showModal() öffnet.
const POPUPS = DATEIEN.filter(n => /dialogKopf\(|showModal\(/.test(quelle(n)));

test('die Dateiliste ist nicht leer und kennt die bekannten Popups', () => {
  for (const n of ['case-editor', 'confirmDialog', 'pack-rules', 'truss-wizard']) assert.ok(POPUPS.includes(n), n);
});

for (const n of POPUPS) {
  test(`${n}: kein <h2> außerhalb von dialogKopf()`, () => {
    assert.doesNotMatch(quelle(n), /<h2[\s>]/);
    assert.match(quelle(n), /dialogKopf\(/);
  });

  test(`${n}: jedes showModal() wird von fokusNachOeffnen( gefolgt`, () => {
    const q = quelle(n);
    for (const m of q.matchAll(/showModal\(\)/g)) {
      assert.match(q.slice(m.index, m.index + 80), /^showModal\(\);\s*fokusNachOeffnen\(/, `${n}@${m.index}`);
    }
  });

  // Aufrufe mit { act } sitzen in <div>-Popups (kein Formular, kein Absenden): dort gelten die zwei Regeln nicht.
  const formAufrufe = [...quelle(n).matchAll(/dialogKopf\((?:(?!\n).)*?\)\}/g)].filter(m => !/\{ act:/.test(m[0]));
  if (formAufrufe.length) test(`${n}: Formular-Popup hat ein autofocus`, () => {
    assert.match(quelle(n), /\bautofocus\b/);
  });

  test(`${n}: vor dialogKopf() steht in der Form kein Knopf (das × ist der erste Absendeknopf)`, () => {
    const q = quelle(n);
    for (const m of q.matchAll(/dialogKopf\(/g)) {
      if (/^[^\n]*\{ act:/.test(q.slice(m.index))) continue;
      const davor = q.slice(0, m.index);
      const ab = davor.slice(Math.max(davor.lastIndexOf('<form'), 0));
      assert.doesNotMatch(ab, /<button\b/, `${n}@${m.index}`);
      assert.doesNotMatch(ab, /value="delete"/, `${n}@${m.index}`);
    }
  });
}

test('dialogKopf() ohne act: das × ist ein Absendeknopf mit value="cancel", nie delete', () => {
  const h = dialogKopf('Titel');
  assert.match(h, /<button type="submit" value="cancel"/);
  assert.doesNotMatch(h, /value="delete"/);
});

test('showPick: Kopf mit Titel, das <select> trägt aria-label mit dem Titel', () => {
  const q = quelle('confirmDialog');
  const pick = q.slice(q.indexOf('export function showPick'), q.indexOf('export function showPrompt'));
  assert.match(pick, /dialogKopf\(/);
  assert.match(pick, /<select name="v" aria-label="\$\{esc\(title\)\}"/);
});
