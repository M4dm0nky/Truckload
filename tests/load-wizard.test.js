import test from 'node:test';
import assert from 'node:assert/strict';
import { reduceWizardItem, defaultWizardLayers, setLayerForAll, setTippedForAll, bulkState, autoPackAfterStacked, countWithoutLayer, capToRoom, searchInOptionsHtml, stockDefaultFor, refreshWizardCases } from '../js/ui/wizard-items.js';
import { caseKind, NEUTRAL_COMPANY } from '../js/ui/caseGroups.js';
import { mkCase } from './fixtures.js';
import { withBuiltins } from '../js/model/collections.js';

// Seit V 0.13.2 eigener Reiter „Lautsprecher“ (Nutzerwunsch 2026-10-09), vorher im „cases“-Tab.
test('dollyPrompt-Cases stehen im Reiter „Lautsprecher“', () => {
  const c = mkCase('preset-k2', 138, 40, 35, { category: 'Ton', dollyPrompt: true });
  assert.equal(caseKind(c), 'lautsprecher');
});

// capToRoom() ist die aus addDollyStack() herausgezogene 500er-Grenzen-Kappung (Befund
// Final-Review Minor #8, „Review Focus #5 ohne eigenen Unit-Test“) – dieselbe Regel, die
// addTruss() schon inline anwendet, hier für die Dolly-Dialog-Addition als eigene, testbare
// Funktion.
test('capToRoom: passt n auf den verbleibenden Platz, wenn n größer als der Rest ist', () => {
  assert.equal(capToRoom(5, 498, 500), 2);
});
test('capToRoom: n unverändert, wenn genug Platz ist', () => {
  assert.equal(capToRoom(5, 100, 500), 5);
});
test('capToRoom: 0, wenn das Limit bereits erreicht ist', () => {
  assert.equal(capToRoom(5, 500, 500), 0);
});

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

test('reduceWizardItem: Gruppe getrimmt und gekürzt übernommen, leer entfällt', () => {
  const c = mkCase('a', 60, 60, 60);
  const base = { layers: [1, 2, 3, 4], tipped: false };
  assert.equal(reduceWizardItem({ ...base, group: '  Motoren ' }, c).group, 'Motoren');
  assert.equal(reduceWizardItem({ ...base, group: 'x'.repeat(50) }, c).group.length, 40);
  assert.ok(!('group' in reduceWizardItem({ ...base, group: '  ' }, c)));
  assert.ok(!('group' in reduceWizardItem(base, c)), 'altes Wizard-Stück ohne Feld');
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

test('searchInOptionsHtml: Standardkatalog, Kompletter Bestand, dann jede Sammlung als Baum', () => {
  const cols = withBuiltins([{ id: 't', name: 'TSE' }, { id: 'r', name: 'Robe', parentId: 't' }]);
  const html = searchInOptionsHtml(cols, NEUTRAL_COMPANY);
  assert.match(html, /value="__neutral__" selected>Standardkatalog/);
  assert.match(html, /value="">Kompletter Bestand/);
  assert.match(html, /value="t">nur TSE/);
  assert.match(html, /value="r">nur – Robe/);
});
test('stockDefaultFor: Name der gewählten eigenen Sammlung, sonst leer', () => {
  const cols = withBuiltins([{ id: 't', name: 'TSE' }]);
  assert.equal(stockDefaultFor('t', cols), 'TSE');
  assert.equal(stockDefaultFor('meine', cols), '');
  assert.equal(stockDefaultFor(NEUTRAL_COMPANY, cols), '');
  assert.equal(stockDefaultFor('', cols), '');
});

test('refreshWizardCases: nach der Materialverwaltung frische Liste, Stückzahl gelöschter Cases fällt weg', () => {
  const counts = new Map([['a', 2], ['b', 1]]);
  const fresh = [{ id: 'a', name: 'A geändert' }, { id: 'c', name: 'C neu' }];
  const out = refreshWizardCases(counts, fresh);
  assert.equal(out, fresh);
  assert.deepEqual([...counts], [['a', 2]]);
});

test('autoPackAfterStacked: „gestapelt“ schaltet ein, außer der Nutzer hat das Häkchen selbst geändert', () => {
  assert.equal(autoPackAfterStacked(false, false), true);  // Standard ohne Eingriff: ein
  assert.equal(autoPackAfterStacked(true, false), true);
  assert.equal(autoPackAfterStacked(false, true), false);  // vom Nutzer abgewählt: bleibt aus
  assert.equal(autoPackAfterStacked(true, true), true);    // vom Nutzer angewählt: bleibt an
});

test('companyFilterAfterChange (#28): verschwundene Sammlung → Standardkatalog mit Hinweis; sonst unverändert ohne Hinweis', async () => {
  const { companyFilterAfterChange } = await import('../js/ui/wizard-items.js');
  const { NEUTRAL_COMPANY } = await import('../js/ui/caseGroups.js');
  const cols = [{ id: 'standard' }, { id: 'meine' }, { id: 'abc' }];
  assert.deepEqual(companyFilterAfterChange('gone', cols), { value: NEUTRAL_COMPANY, hinweis: 'Sammlung nicht mehr vorhanden – Filter zurückgesetzt.' });
  assert.deepEqual(companyFilterAfterChange('abc', cols), { value: 'abc', hinweis: '' });
  assert.deepEqual(companyFilterAfterChange('', cols), { value: '', hinweis: '' });
  assert.deepEqual(companyFilterAfterChange(NEUTRAL_COMPANY, cols), { value: NEUTRAL_COMPANY, hinweis: '' });
});
