import test from 'node:test';
import assert from 'node:assert/strict';
import { esc, swatch, icon } from '../js/ui/dom.js';

test('esc maskiert HTML-Sonderzeichen', () => {
  assert.equal(esc('<b>&"\'</b>'), '&lt;b&gt;&amp;&quot;&#39;&lt;/b&gt;');
});

test('swatch übernimmt eine gültige #RRGGBB/#RGB-Farbe', () => {
  assert.equal(swatch('#ff8800'), '<span class="swatch" style="background:#ff8800"></span>');
  assert.equal(swatch('#f80'), '<span class="swatch" style="background:#f80"></span>');
});

// Task 8, Nachtrag Controller: swatch() soll das Farbmuster selbst durchsetzen statt sich auf
// jeden künftigen Aufrufer zu verlassen (docs/code-review-2026-09-21.md). Ohne diese Prüfung
// würde eine ungültige Farbe (Altdaten aus IndexedDB von vor B2, eine künftige fremde Quelle)
// unverändert ins style-Attribut wandern.
test('swatch fällt bei einer ungültigen Farbe auf Grau zurück, statt sie unverändert zu übernehmen', () => {
  assert.equal(swatch('red;position:fixed'), '<span class="swatch" style="background:#888"></span>');
  assert.equal(swatch(''), '<span class="swatch" style="background:#888"></span>');
  assert.equal(swatch(undefined), '<span class="swatch" style="background:#888"></span>');
  assert.equal(swatch(null), '<span class="swatch" style="background:#888"></span>');
});

// icon() ersetzt die Emoji-Zeichen (✎/🗑) in js/ui/library.js durch echte Inline-SVGs, die mit
// fill="currentColor" die Button-Textfarbe übernehmen (Dark/Light-Modus läuft automatisch mit,
// anders als beim Emoji mit fester, betriebssystemabhängiger Farbe). Anders als bei swatch() ist
// der Name hier keine Nutzer-/Importdaten, sondern eine feste Zeichenkette im eigenen Code —
// ein Tippfehler darin ist ein Programmierfehler und soll laut auffallen, nicht still leer bleiben.
test('icon liefert ein Inline-SVG mit currentColor für bekannte Namen', () => {
  for (const name of ['pencil-simple', 'trash']) {
    const svg = icon(name);
    assert.match(svg, /^<svg /);
    assert.match(svg, /fill="currentColor"/);
    assert.match(svg, /<\/svg>$/);
  }
  assert.notEqual(icon('pencil-simple'), icon('trash'));
});

test('icon wirft bei einem unbekannten Namen, statt still leer zu bleiben', () => {
  assert.throws(() => icon('unbekannt'));
});
