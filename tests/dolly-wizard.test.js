import test from 'node:test';
import assert from 'node:assert/strict';
import { dollyStackCase } from '../js/model/audioDolly.js';
import { parseDollyCount, buildDollyResult } from '../js/ui/dolly-wizard.js';
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

test('buildDollyResult: „nur Load“ bekommt eigene UUID und verdeckt keinen Bestands-Stack', () => {
  const base = { id: 'preset-k2', name: 'K2', category: 'Ton', l: 138, w: 40, h: 35, weight: 56 };
  const inStock = buildDollyResult(base, 2, {}, { inStock: true, company: 'CAB' }, 'uuid-1');
  const temp = buildDollyResult(base, 2, {}, { inStock: false, company: 'CAB' }, 'uuid-1');
  assert.equal(inStock.id, 'dolly-cab-k2-2');
  assert.equal(temp.id, 'uuid-1'); assert.equal(temp.onlyInPlan, true); assert.equal(temp.company, undefined);
});
test('buildDollyResult: Bestand ohne Firma behält die alte ID', () => {
  const base = { id: 'preset-k2', name: 'K2', category: 'Ton', l: 138, w: 40, h: 35, weight: 56 };
  assert.equal(buildDollyResult(base, 2, {}, { inStock: true, company: '' }, 'u').id, 'dolly-k2-2');
});

test('buildDollyResult: bei gleichem Firmen-Slug einer anderen Firma bekommt die ID ein Suffix', () => {
  const base = { id: 'preset-k2', name: 'K2', category: 'Ton', l: 138, w: 40, h: 35, weight: 56 };
  const existing = [{ id: 'dolly-cab-k2-2', company: 'CAB' }];
  assert.equal(buildDollyResult(base, 2, {}, { inStock: true, company: 'C.A.B.' }, 'u', existing).id, 'dolly-c-a-b-k2-2');
  assert.equal(buildDollyResult(base, 2, {}, { inStock: true, company: 'cab' }, 'u', existing).id, 'dolly-cab-2-k2-2');
  assert.equal(buildDollyResult(base, 2, {}, { inStock: true, company: 'CAB' }, 'u', existing).id, 'dolly-cab-k2-2');
});
