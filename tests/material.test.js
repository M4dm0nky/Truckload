import test from 'node:test';
import assert from 'node:assert/strict';
import { isInStock, companyList, casesOf, onlyInPlanCases, renameCompany, deletionFor, copyToCompany, applyStockTarget } from '../js/model/material.js';

const lib = { id: 'lib-k1', builtin: true, source: 'liste', name: 'K1 -CAB', company: 'CAB', l: 1, w: 1, h: 1, weight: 0 };
const own = { id: 'u1', builtin: false, name: 'Mein Case', company: 'Test', l: 1, w: 1, h: 1, weight: 1 };
const std = { id: 'u2', builtin: false, name: 'Standard eigen', l: 1, w: 1, h: 1, weight: 1 };
const preset = { id: 'preset-x', builtin: true, name: 'Packcase', l: 1, w: 1, h: 1, weight: 1 };
const gone = { ...lib, id: 'lib-alt', legacy: true };
const tmp = { id: 'u3', builtin: false, name: 'Nur Load', onlyInPlan: true, l: 1, w: 1, h: 1, weight: 1 };
const all = [lib, own, std, preset, gone, tmp];

test('isInStock: legacy und onlyInPlan gehören nicht zum Bestand', () => {
  assert.deepEqual(all.filter(isInStock).map(c => c.id), ['lib-k1', 'u1', 'u2', 'preset-x']);
});
test('companyList: Firmen mit Anzahl, alphabetisch, leere Zusatzfirma mit 0', () => {
  assert.deepEqual(companyList(all, ['Neu']), [{ name: 'CAB', count: 1 }, { name: 'Neu', count: 0 }, { name: 'Test', count: 1 }]);
});
test('casesOf: Firma bzw. Standardliste ohne company', () => {
  assert.deepEqual(casesOf(all, 'CAB').map(c => c.id), ['lib-k1']);
  assert.deepEqual(casesOf(all, '').map(c => c.id), ['u2', 'preset-x']);
});
test('onlyInPlanCases', () => {
  assert.deepEqual(onlyInPlanCases(all).map(c => c.id), ['u3']);
});
test('renameCompany: Vorlagen werden zu Überlagerungen mit gleicher ID', () => {
  const out = renameCompany(all, 'CAB', 'CAB Berlin');
  assert.deepEqual(out.map(c => [c.id, c.builtin, c.company, c.source]), [['lib-k1', false, 'CAB Berlin', 'liste'], ['lib-alt', false, 'CAB Berlin', 'liste']]);
});
test('deletionFor: eigenes Case entfernen, Firmen-Vorlage ausblenden, Standardvorlage nie', () => {
  assert.deepEqual(deletionFor(own), { remove: 'u1' });
  assert.deepEqual(deletionFor(lib), { save: { ...lib, builtin: false, legacy: true } });
  assert.equal(deletionFor(preset), null);
});
test('copyToCompany: neue ID, eigenes Case, Firma gesetzt, Herkunftsfelder weg', () => {
  const c = copyToCompany({ ...preset, note: 'Richtwert', legacy: true }, 'Test', 'n1');
  assert.equal(c.id, 'n1'); assert.equal(c.builtin, false); assert.equal(c.company, 'Test');
  assert.equal(c.note, undefined); assert.equal(c.legacy, undefined); assert.equal(c.source, undefined);
  assert.equal(copyToCompany(preset, '', 'n2').company, undefined);
});
test('applyStockTarget: Firma, Standardliste, nur Load', () => {
  assert.equal(applyStockTarget(std, { inStock: true, company: 'Test' }).company, 'Test');
  const s = applyStockTarget(own, { inStock: true, company: '' });
  assert.equal(s.company, undefined); assert.equal(s.onlyInPlan, undefined);
  const t = applyStockTarget(own, { inStock: false, company: 'Test' });
  assert.equal(t.onlyInPlan, true); assert.equal(t.company, undefined);
});
