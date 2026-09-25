import test from 'node:test';
import assert from 'node:assert/strict';
import { reduceWizardItem, defaultWizardLayers, setLayerForAll, setTippedForAll, bulkState, countWithoutLayer } from '../js/ui/load-wizard.js';
import { mkCase } from './fixtures.js';

// Lage/Tippen je Stück, Fix-Runde 2 (Befund „Wizard speichert Vorgaben als Stück-Einschränkung“):
// reduceWizardItem() entscheidet, was vom Wizard-Ergebnis tatsächlich als bewusste Ausnahme eines
// Stücks gespeichert wird — nicht, was die Checkboxen anzeigen (das bleibt unverändert layersOf(c)/
// canTip(c) als Vorbelegung).

test('layers gleich layersOf(c) (Menge) → layers wird nicht gespeichert', () => {
  const c = mkCase('a', 120, 60, 60, { layers: [1, 2, 3, 4] });
  const it = { layers: [4, 3, 2, 1], tipped: false }; // andere Reihenfolge, gleiche Menge
  const res = reduceWizardItem(it, c);
  assert.ok(!('layers' in res));
});

test('eingeschränkte layers → layers wird gespeichert', () => {
  const c = mkCase('a', 120, 60, 60, { layers: [1, 2, 3, 4] });
  const it = { layers: [1, 2], tipped: false };
  const res = reduceWizardItem(it, c);
  assert.deepEqual(res.layers, [1, 2]);
});

test('Case-Typ selbst schon eingeschränkt (layersOf(c) = [1,2]) und Stück übernimmt alles → layers wird nicht gespeichert', () => {
  const c = mkCase('a', 120, 60, 60, { layers: [1, 2] });
  const it = { layers: [1, 2], tipped: false };
  const res = reduceWizardItem(it, c);
  assert.ok(!('layers' in res));
});

test('nicht tippbarer Case-Typ → tipped wird nicht gespeichert', () => {
  const c = mkCase('a', 120, 60, 60, { tippable: false, layers: [1, 2, 3, 4] });
  const it = { layers: [1, 2, 3, 4], tipped: false };
  const res = reduceWizardItem(it, c);
  assert.ok(!('tipped' in res));
});

test('tippbarer Case-Typ, tipped:true → tipped wird gespeichert', () => {
  const c = mkCase('a', 120, 60, 60, { tippable: true, layers: [1, 2, 3, 4] });
  const it = { layers: [1, 2, 3, 4], tipped: true };
  const res = reduceWizardItem(it, c);
  assert.equal(res.tipped, true);
});

test('tippbarer Case-Typ, tipped:false (Nutzer hat den Standardwert bewusst abgewählt) → tipped wird gespeichert', () => {
  const c = mkCase('a', 120, 60, 60, { tippable: true, layers: [1, 2, 3, 4] });
  const it = { layers: [1, 2, 3, 4], tipped: false };
  const res = reduceWizardItem(it, c);
  assert.equal(res.tipped, false);
});

// Globale Kopfzeile im Wizard-Schritt „Beschriftung“: Vorbelegung Lage 1+2 und getippt, dazu
// Häkchen, die Lage n bzw. „getippt“ für alle Stücke auf einmal setzen.

test('Vorbelegung: Lage 1 und 2, wenn der Case-Typ sie erlaubt', () => {
  assert.deepEqual(defaultWizardLayers(mkCase('a', 120, 60, 60, { layers: [1, 2, 3, 4] })), [1, 2]);
  assert.deepEqual(defaultWizardLayers(mkCase('a', 120, 60, 60, { layers: [2, 3] })), [2]);
});

test('Vorbelegung: Lage 3/4 nie vorab, auch wenn der Case-Typ weder Lage 1 noch 2 erlaubt', () => {
  assert.deepEqual(defaultWizardLayers(mkCase('a', 120, 60, 60, { layers: [3, 4] })), []);
});

const entry = (layers, typeLayers = [1, 2, 3, 4], tippable = true, tipped = false) =>
  ({ it: { layers, tipped }, c: mkCase('a', 120, 60, 60, { layers: typeLayers, tippable }) });

test('setLayerForAll an: Lage nur dort ergänzt, wo der Case-Typ sie erlaubt', () => {
  const es = [entry([1, 2]), entry([1], [1, 2, 3])];
  setLayerForAll(es, 4, true);
  assert.deepEqual(es[0].it.layers, [1, 2, 4]);
  assert.deepEqual(es[1].it.layers, [1]);
});

test('setLayerForAll aus: letzte Lage bleibt stehen, Anzahl der betroffenen Stücke zurück', () => {
  const es = [entry([1, 2]), entry([1]), entry([1])];
  const kept = setLayerForAll(es, 1, false);
  assert.deepEqual(es[0].it.layers, [2]);
  assert.deepEqual(es[1].it.layers, [1]);
  assert.equal(kept, 2);
});

test('setTippedForAll: nur tippbare Case-Typen', () => {
  const es = [entry([1], [1, 2, 3, 4], true, false), entry([1], [1, 2, 3, 4], false, false)];
  setTippedForAll(es, true);
  assert.equal(es[0].it.tipped, true);
  assert.equal(es[1].it.tipped, false);
});

test('bulkState: on / off / mixed / none', () => {
  assert.equal(bulkState([entry([1, 2]), entry([1])], 1), 'on');
  assert.equal(bulkState([entry([1, 2]), entry([1])], 3), 'off');
  assert.equal(bulkState([entry([1, 2]), entry([1])], 2), 'mixed');
  assert.equal(bulkState([entry([1], [1, 2])], 4), 'none');
  assert.equal(bulkState([entry([1], [1, 2, 3, 4], true, true), entry([1], [1, 2, 3, 4], false)], 'tipped'), 'on');
  assert.equal(bulkState([entry([1], [1, 2, 3, 4], false)], 'tipped'), 'none');
});

test('countWithoutLayer zählt Stücke ohne angehakte Lage', () => {
  assert.equal(countWithoutLayer([entry([]), entry([3]), entry([])]), 2);
  assert.equal(countWithoutLayer([entry([1])]), 0);
});
