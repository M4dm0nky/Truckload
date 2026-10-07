import test from 'node:test';
import assert from 'node:assert/strict';
import { dollyStackCase } from '../js/model/audioDolly.js';
import { parseDollyCount } from '../js/ui/dolly-wizard.js';
import { mkCase } from './fixtures.js';

// openDollyDialog() selbst ist ein DOM-Dialog (wie openTrussDialog()) und wird per Browser-
// Probe (tools/cdp.mjs) geprüft, nicht hier. Dieser Test sichert nur den reinen Baustein ab,
// den der Dialog beim Bestätigen aufruft.
test('dollyStackCase liefert ein für den Dialog passendes Case (Smoke-Test der Schnittstelle)', () => {
  const base = mkCase('preset-k2', 138, 40, 35, { weight: 56, name: 'L-Acoustics K2', category: 'Ton' });
  const c = dollyStackCase(base, 2);
  assert.equal(c.id, 'dolly-k2-2');
  assert.equal(c.name, 'L-Acoustics K2 2er (auf Dolly)');
});

// parseDollyCount() ist die aus openDollyDialog() herausgezogene Prüfung der Stückzahl-Eingabe
// (Befund Final-Review Minor #8, „Review Focus #2 ohne eigenen Unit-Test“ – vorher nur per
// Browser-Probe mit n=3 geprüft, nie mit einer ungültigen Eingabe). min="1"/max liegen zwar
// schon als HTML-Attribute im Formular, ein manuell bearbeitetes <input> (oder ein Browser ohne
// <input type="number">-Unterstützung) kann trotzdem einen leeren/negativen/nicht-ganzzahligen
// Wert ins DOM bringen – deshalb prüft der Dialog beim Schließen zusätzlich selbst.
test('parseDollyCount: gültige Ganzzahl innerhalb 1..max wird übernommen', () => {
  assert.equal(parseDollyCount('3', 10), 3);
  assert.equal(parseDollyCount('1', 10), 1);
  assert.equal(parseDollyCount('10', 10), 10);
});
test('parseDollyCount: 0, negativ, leer, nicht-numerisch oder über max → null', () => {
  assert.equal(parseDollyCount('0', 10), null);
  assert.equal(parseDollyCount('-1', 10), null);
  assert.equal(parseDollyCount('', 10), null);
  assert.equal(parseDollyCount('abc', 10), null);
  assert.equal(parseDollyCount('11', 10), null);
});
test('parseDollyCount: Kommazahl (keine Ganzzahl) → null', () => {
  assert.equal(parseDollyCount('2.5', 10), null);
});
