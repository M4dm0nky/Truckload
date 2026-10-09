import test from 'node:test';
import assert from 'node:assert/strict';
import { companiesOf, groupCases, caseKind, CASE_TABS, NEUTRAL_COMPANY } from '../js/ui/caseGroups.js';

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

// NEUTRAL_COMPANY ist der Vorgabewert des Firmen-Filters im Lade-Wizard (Nutzerwunsch
// 2026-10-06: firmen-gebrandete Cases wie „-CAB“ sollen nie von selbst auftauchen, nur wenn
// der Nutzer selbst eine Firma wählt). Spiegelbildlich zum Test oben: statt nur Cases EINER
// Firma durchzulassen, lässt NEUTRAL_COMPANY nur Cases OHNE company durch – „Eigene Cases“
// und „Vorlagen“ haben nie ein company-Feld und bleiben deshalb sichtbar.
test('NEUTRAL_COMPANY lässt nur Cases ohne company durch', () => {
  const cases = [own('o1'), preset('p1'), listCase('l1', 'CAB'), listCase('l2', undefined)];
  const { own: ownGroup, presets, list } = groupCases(cases, { company: NEUTRAL_COMPANY });
  assert.deepEqual(ownGroup.map(c => c.id), ['o1']);
  assert.deepEqual(presets.map(c => c.id), ['p1']);
  assert.deepEqual(list.map(c => c.id), ['l2']);
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

// Nutzer-Feedback 2026-09-23: die Artikelauswahl (Bibliothek + Wizard) bekommt 3 Reiter statt
// einer gemischten Liste – Traversen (kind:'truss') und Sonderbau (category:'Sonderbau') bleiben
// wie gehabt wähl-/vorlagenfähig, landen aber über caseKind() im jeweils eigenen Reiter statt im
// Cases-Reiter.
test('caseKind: Traverse erkannt', () => {
  assert.equal(caseKind({ kind: 'truss', category: 'Rigging' }), 'traversen');
});
test('caseKind: Sonderbau erkannt (und hat Vorrang vor Traversen, falls beides zuträfe)', () => {
  assert.equal(caseKind({ category: 'Sonderbau' }), 'sonderbau');
  assert.equal(caseKind({ kind: 'truss', category: 'Sonderbau' }), 'traversen');
});
test('caseKind: alles andere ist ein normales Case', () => {
  assert.equal(caseKind({ category: 'Licht' }), 'cases');
  assert.equal(caseKind({}), 'cases');
});
test('CASE_TABS enthält genau die 3 Reiter cases/traversen/sonderbau', () => {
  assert.deepEqual(CASE_TABS.map(t => t.id), ['cases', 'traversen', 'sonderbau']);
});

test('leere Eingabe liefert leere Gruppen statt zu werfen', () => {
  assert.deepEqual(groupCases([]), { own: [], presets: [], list: [] });
  assert.deepEqual(companiesOf([]), []);
});

// Aufräumen 2026-09-28: ersetzte Listen-Einträge (Standard-Pack-/Kabelcases, Traversen aus der
// Liste) bleiben für alte Ladepläne erhalten, tauchen aber in keiner Auswahl mehr auf.
test('groupCases schließt legacy-Einträge auch aus der Liste aus', () => {
  const cases = [listCase('l1', 'CAB'), listCase('l2', 'CAB', { legacy: true })];
  const { list } = groupCases(cases);
  assert.deepEqual(list.map(c => c.id), ['l1']);
});

test('companiesOf nennt keine Firma, die nur noch an ausgeblendeten Einträgen hängt', () => {
  const cases = [listCase('l1', 'CAB'), listCase('l2', 'Nur-Alt', { legacy: true })];
  assert.deepEqual(companiesOf(cases), ['CAB']);
});

test('groupCases: onlyInPlan nur mit keep sichtbar, companiesOf ignoriert es', () => {
  const tmp = { id: 't', builtin: false, name: 'T', company: 'X', onlyInPlan: true, category: 'Ton' };
  assert.equal(groupCases([tmp]).own.length, 0);
  assert.equal(groupCases([tmp], { keep: new Set(['t']) }).own.length, 1);
  assert.deepEqual(companiesOf([tmp]), []);
});

test('groupCases: bearbeitete Listen-Einträge bleiben in „Cases aus deiner Liste“', () => {
  const over = { id: 'lib-a', builtin: false, source: 'liste', name: 'A', category: 'Ton' };
  const g = groupCases([over]);
  assert.equal(g.own.length, 0); assert.equal(g.list.length, 1);
});
