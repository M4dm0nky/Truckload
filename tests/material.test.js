import test from 'node:test';
import assert from 'node:assert/strict';
import { isInStock, companyList, casesOf, onlyInPlanCases, renameCompany, deletionFor, copyToCompany, applyStockTarget, firmNameError } from '../js/model/material.js';
import { mergeOwnWithBuiltins } from '../js/store/repo.js';
import { CASE_LIBRARY } from '../js/data/case-library.js';

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

// Final-Review CRITICAL 1: eine `lib-`-Überlagerung (bearbeitete Firmen-Vorlage oder jedes Case
// einer umbenannten Firma, builtin:false) darf beim Löschen nicht entfernt werden – sonst bringt
// mergeOwnWithBuiltins beim nächsten Start die mitgelieferte Version zurück.
test('deletionFor: lib-Überlagerung (builtin:false) wird ausgeblendet, nicht entfernt', () => {
  const overlay = { ...lib, builtin: false, name: 'K1 bearbeitet' };
  assert.deepEqual(deletionFor(overlay), { save: { ...overlay, builtin: false, legacy: true } });
});
test('Firma umbenennen, dann alles löschen: nach dem Neustart bleibt die Firma leer', () => {
  const cab = CASE_LIBRARY.filter(c => c.company === 'CAB' && !c.legacy);
  assert.ok(cab.length > 0);
  const renamed = renameCompany(CASE_LIBRARY, 'CAB', 'CAB Berlin');
  const saves = renamed.map(deletionFor);
  assert.ok(saves.every(d => d?.save), 'jede Überlagerung wird gespeichert, keine entfernt');
  const merged = mergeOwnWithBuiltins(saves.map(d => d.save), CASE_LIBRARY);
  const names = companyList(merged).map(f => f.name);
  assert.ok(!names.includes('CAB Berlin'));
  assert.ok(!names.includes('CAB'), 'die mitgelieferte Firma kommt nicht zurück');
});

test('firmNameError: reservierte Platzhalternamen __…__ werden abgelehnt', () => {
  assert.equal(firmNameError('__standard__'), 'Dieser Firmenname ist reserviert.');
  assert.equal(firmNameError('  __nur-im-plan__ '), 'Dieser Firmenname ist reserviert.');
  assert.equal(firmNameError('__a'), null);
  assert.equal(firmNameError('a__b__'), null);
});
test('firmNameError: leer, zu lang, gültig', () => {
  assert.equal(firmNameError('   '), 'Firmenname fehlt.');
  assert.equal(firmNameError(''), 'Firmenname fehlt.');
  assert.equal(firmNameError('x'.repeat(81)), 'Firmenname: höchstens 80 Zeichen.');
  assert.equal(firmNameError(` ${'x'.repeat(80)} `), null);
  assert.equal(firmNameError('CAB'), null);
});
