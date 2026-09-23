import test from 'node:test';
import assert from 'node:assert/strict';
import { buildWagonCaseType } from '../js/ui/truss-wizard.js';
import { trussDims, wagonWeight } from '../js/model/truss.js';
import { checkCase } from '../js/store/io.js';

// buildWagonCaseType() ist der pure Baustein hinter dem „Truss hinzufügen“-Dialog (Task 3,
// klassischer Zweig): baut denselben Case-Typ, den T() in js/data/preset-cases.js für die festen
// Vorlagen baut, nur mit builtin:false – rein funktional, keine DOM-/Store-Berührung.

test('buildWagonCaseType: Maße und Gewicht stimmen mit trussDims()/wagonWeight() überein', () => {
  const c = buildWagonCaseType('id-1', '34er', 400, 29, 8);
  const dims = trussDims({ length: 400, width: 29, count: 8 });
  assert.equal(c.l, dims.l);
  assert.equal(c.w, dims.w);
  assert.equal(c.h, dims.h);
  assert.equal(c.weight, wagonWeight(400, 29, 8));
});

test('buildWagonCaseType: ist kein Preset (builtin:false), im Gegensatz zu den mitgelieferten Vorlagen', () => {
  const c = buildWagonCaseType('id-2', '40er', 300, 40, 4);
  assert.equal(c.builtin, false);
  assert.equal(c.id, 'id-2');
});

test('buildWagonCaseType: nie tippbar, Traversenwagen-Schema (kind/truss)', () => {
  const c = buildWagonCaseType('id-3', '34er', 200, 29, 4);
  assert.equal(c.tippable, false);
  assert.equal(c.kind, 'truss');
  assert.deepEqual(c.truss, { length: 200, width: 29, count: 4 });
});

test('buildWagonCaseType: Name nennt Profil, Länge in Metern und Stückzahl', () => {
  const c = buildWagonCaseType('id-4', '34er', 400, 29, 8);
  assert.equal(c.name, 'Traversenwagen 34er 4 m (8 Stück)');
});

test('buildWagonCaseType: Ergebnis besteht checkCase() (gültiger, speicherbarer Case)', () => {
  const c = buildWagonCaseType('id-5', '34er', 400, 29, 8);
  assert.doesNotThrow(() => checkCase(c));
});

test('buildWagonCaseType: Stückzahl an der checkCase()-Obergrenze (12) ist noch gültig', () => {
  const c = buildWagonCaseType('id-6', '34er', 300, 29, 12);
  assert.doesNotThrow(() => checkCase(c));
  assert.ok(c.truss.count <= 12);
});
