import test from 'node:test';
import assert from 'node:assert/strict';
import { weightEditable } from '../js/ui/inspector.js';
import { mkCase } from './fixtures.js';

test('weightEditable: eigene Cases ja (auch Altdaten ohne builtin-Feld)', () => {
  assert.equal(weightEditable(mkCase('own-1', 100, 50, 50, { builtin: false })), true);
  assert.equal(weightEditable(mkCase('own-2', 100, 50, 50)), true); // Altdatensatz ohne `builtin`
});

test('weightEditable: Firmen-Vorlage (lib-) ja, Standardvorlage (preset-) nein', () => {
  assert.equal(weightEditable(mkCase('lib-x', 100, 50, 50, { builtin: true, source: 'liste' })), true);
  assert.equal(weightEditable(mkCase('lib-x', 100, 50, 50, { builtin: false, source: 'liste' })), true); // Überlagerung
  assert.equal(weightEditable(mkCase('preset-x', 100, 50, 50, { builtin: true })), false);
});

test('weightEditable: Traversenwagen nie (Gewicht abgeleitet), kein Case nein', () => {
  assert.equal(weightEditable(mkCase('own-t', 100, 50, 50, { builtin: false, kind: 'truss' })), false);
  assert.equal(weightEditable(undefined), false);
});
