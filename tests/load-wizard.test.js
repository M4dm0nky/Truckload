import test from 'node:test';
import assert from 'node:assert/strict';
import { reduceWizardItem } from '../js/ui/load-wizard.js';
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
