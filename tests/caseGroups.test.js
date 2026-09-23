import test from 'node:test';
import assert from 'node:assert/strict';
import { companiesOf, groupCases } from '../js/ui/caseGroups.js';

const own = (id, extra = {}) => ({ id, builtin: false, name: `Own ${id}`, content: '', category: 'Licht', ...extra });
const preset = (id, extra = {}) => ({ id, builtin: true, name: `Preset ${id}`, content: '', category: 'Licht', ...extra });
const listCase = (id, company, extra = {}) => ({
  id, builtin: true, source: 'liste', name: `List ${id}`, content: '', category: 'Licht', company, ...extra,
});

test('groupCases teilt in Eigene Cases / Vorlagen / Liste', () => {
  const cases = [own('o1'), preset('p1'), listCase('l1', 'CAB')];
  const { own: ownGroup, presets, list } = groupCases(cases);
  assert.deepEqual(ownGroup.map(c => c.id), ['o1']);
  assert.deepEqual(presets.map(c => c.id), ['p1']);
  assert.deepEqual(list.map(c => c.id), ['l1']);
});

test('groupCases schließt legacy-Presets aus der Vorlagen-Gruppe aus', () => {
  const cases = [preset('p1'), preset('p2', { legacy: true })];
  const { presets } = groupCases(cases);
  assert.deepEqual(presets.map(c => c.id), ['p1']);
});

test('Firmenfilter blendet Cases ohne company aus', () => {
  const cases = [own('o1'), preset('p1'), listCase('l1', 'CAB'), listCase('l2', 'BBM')];
  const { own: ownGroup, presets, list } = groupCases(cases, { company: 'CAB' });
  assert.deepEqual(ownGroup, []);
  assert.deepEqual(presets, []);
  assert.deepEqual(list.map(c => c.id), ['l1']);
});

test('Suche greift auf Name und Inhalt', () => {
  const cases = [
    listCase('l1', 'CAB', { name: 'Mac Viper x2 -CAB' }),
    listCase('l2', 'CAB', { name: 'Look Viper NT -CAB' }),
    listCase('l3', 'CAB', { name: 'Sonstiges', content: 'Viper-Ersatzteile' }),
    listCase('l4', 'CAB', { name: 'Irrelevant', content: 'nichts' }),
  ];
  const { list } = groupCases(cases, { q: 'Viper' });
  assert.deepEqual(list.map(c => c.id).sort(), ['l1', 'l2', 'l3']);
});

test('Gewerk und Firma wirken als Und-Verknüpfung', () => {
  const cases = [
    listCase('l1', 'BBM', { category: 'Licht' }),
    listCase('l2', 'BBM', { category: 'Ton' }),
    listCase('l3', 'CAB', { category: 'Licht' }),
  ];
  const { list } = groupCases(cases, { cat: 'Licht', company: 'BBM' });
  assert.deepEqual(list.map(c => c.id), ['l1']);
});

test('companiesOf liefert alphabetisch sortiert und ohne Dubletten', () => {
  const cases = [
    listCase('l1', 'Motion'), listCase('l2', 'CAB'), listCase('l3', 'CAB'),
    listCase('l4', 'AED'), own('o1'), preset('p1'),
  ];
  assert.deepEqual(companiesOf(cases), ['AED', 'CAB', 'Motion']);
});

// Task 8, Befund Daten-9: eigene Cases kamen vorher in der Reihenfolge, in der `cases` übergeben
// wurde (bei IndexedDB: UUID-Reihenfolge) – groupCases() sortiert die "own"-Gruppe jetzt
// alphabetisch, unabhängig von der Reihenfolge der Eingabe.
test('groupCases sortiert eigene Cases alphabetisch, unabhängig von der Eingabereihenfolge', () => {
  const cases = [own('z', { name: 'Zebra-Case' }), own('a', { name: 'Amp-Rack' }), own('m', { name: 'Molton-Case' })];
  const { own: ownGroup } = groupCases(cases);
  assert.deepEqual(ownGroup.map(c => c.name), ['Amp-Rack', 'Molton-Case', 'Zebra-Case']);
});

// Nutzer-Feedback 2026-09-23: Traversen-Vorlagen (Wagen wie MLT) sollen nicht mehr aus einer
// Liste wählbar sein, sondern nur noch über „+ Traverse hinzufügen“ (Truss-Wizard) in einen Load
// kommen. Selbst erzeugte Wagen (builtin:false) bleiben unter „Eigene Cases“ verwaltbar.
test('groupCases schließt Traversen-Vorlagen aus der Vorlagen-Gruppe aus, eigene Wagen bleiben sichtbar', () => {
  const trussPreset = preset('t1', { kind: 'truss', truss: { length: 300, width: 29, count: 4 } });
  const ownWagon = own('w1', { kind: 'truss', truss: { length: 400, width: 29, count: 8 } });
  const { own: ownGroup, presets } = groupCases([trussPreset, ownWagon, preset('p1')]);
  assert.deepEqual(presets.map(c => c.id), ['p1']);
  assert.deepEqual(ownGroup.map(c => c.id), ['w1']);
});

test('leere Eingabe liefert leere Gruppen statt zu werfen', () => {
  assert.deepEqual(groupCases([]), { own: [], presets: [], list: [] });
  assert.deepEqual(companiesOf([]), []);
});
