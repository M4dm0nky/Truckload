import test from 'node:test';
import assert from 'node:assert/strict';
import { referenzen, bestandFuer, mitfuehren, MITGEFUEHRT_VERSION } from '../js/model/mitgefuehrt.js';
import { mkCase, mkTruck, P } from './fixtures.js';

const plan = (extra = {}) => ({ id: 'p', name: 'P', truckId: 't', placements: [], unplaced: [], notes: '', ...extra });

test('referenzen: Cases aus placements und unplaced, Fahrzeuge aus truckId und lkws', () => {
  const p = plan({
    truckId: 't1',
    lkws: [{ id: 'l1', name: 'A', truckId: 't1', categories: [] }, { id: 'l2', name: 'B', truckId: 't2', categories: [] }],
    placements: [P('a', 'c1', 0, 0, 0)],
    unplaced: [{ id: 'b', caseId: 'c2' }, { id: 'c', caseId: 'c1' }],
  });
  const r = referenzen(p);
  assert.deepEqual([...r.caseIds].sort(), ['c1', 'c2']);
  assert.deepEqual([...r.truckIds].sort(), ['t1', 't2']);
});

test('bestandFuer: ohne mitgefuehrt dieselben Arrays, leere Mengen', () => {
  const cases = [mkCase('c1', 10, 10, 10)], trucks = [mkTruck()];
  const b = bestandFuer(cases, trucks, plan());
  assert.equal(b.cases, cases);
  assert.equal(b.trucks, trucks);
  assert.equal(b.ausProjekt.cases.size, 0);
  assert.equal(bestandFuer(cases, trucks, null).cases, cases);
});

test('bestandFuer: die Bibliothek gewinnt, die Kopie füllt nur fehlende IDs', () => {
  const lib = mkCase('c1', 10, 10, 10, { weight: 5 });
  const p = plan({
    truckId: 't9',
    unplaced: [{ id: 'u1', caseId: 'c1' }, { id: 'u2', caseId: 'c2' }],
    mitgefuehrt: { version: 1,
      cases: [mkCase('c1', 10, 10, 10, { weight: 999 }), mkCase('c2', 20, 20, 20)],
      trucks: [mkTruck({ id: 't9', name: 'Fremd' })] },
  });
  const b = bestandFuer([lib], [mkTruck()], p);
  assert.equal(b.cases.find(c => c.id === 'c1').weight, 5);
  assert.ok(b.cases.some(c => c.id === 'c2'));
  assert.deepEqual([...b.ausProjekt.cases], ['c2']);
  assert.deepEqual([...b.ausProjekt.trucks], ['t9']);
});

test('bestandFuer: Kopien ohne Verweis im Plan und Einträge ohne gültige ID werden ignoriert', () => {
  const p = plan({ unplaced: [{ id: 'u', caseId: 'c2' }],
    mitgefuehrt: { version: 1, cases: [mkCase('c2', 1, 1, 1), mkCase('fremd', 1, 1, 1), null, { name: 'ohne id' }], trucks: [] } });
  const b = bestandFuer([], [mkTruck()], p);
  assert.deepEqual(b.cases.map(c => c.id), ['c2']);
});

test('mitfuehren: nur Referenziertes, vollständig, ohne collectionId', () => {
  const cases = [mkCase('c1', 10, 10, 10, { collectionId: 'meine', builtin: false }), mkCase('nicht-im-plan', 1, 1, 1)];
  const trucks = [mkTruck({ id: 't' }), mkTruck({ id: 'andere' })];
  const out = mitfuehren(plan({ unplaced: [{ id: 'u', caseId: 'c1' }] }), cases, trucks);
  assert.equal(out.mitgefuehrt.version, MITGEFUEHRT_VERSION);
  assert.deepEqual(out.mitgefuehrt.cases.map(c => c.id), ['c1']);
  assert.equal('collectionId' in out.mitgefuehrt.cases[0], false);
  assert.equal(out.mitgefuehrt.cases[0].l, 10);
  assert.deepEqual(out.mitgefuehrt.trucks.map(t => t.id), ['t']);
});

test('mitfuehren: herausgenommenes Case fällt weg, neues kommt hinzu', () => {
  const cases = [mkCase('c1', 1, 1, 1), mkCase('c2', 1, 1, 1)];
  const alt = plan({ unplaced: [{ id: 'u2', caseId: 'c2' }],
    mitgefuehrt: { version: 1, cases: [mkCase('c1', 1, 1, 1)], trucks: [mkTruck({ id: 't' })] } });
  const out = mitfuehren(alt, cases, [mkTruck({ id: 't' })]);
  assert.deepEqual(out.mitgefuehrt.cases.map(c => c.id), ['c2']);
});

test('mitfuehren: auf dem fremden Rechner bleibt die Kopie als Quelle erhalten', () => {
  const fremd = plan({ truckId: 't9', unplaced: [{ id: 'u', caseId: 'c2' }],
    mitgefuehrt: { version: 1, cases: [mkCase('c2', 20, 20, 20)], trucks: [mkTruck({ id: 't9' })] } });
  const out = mitfuehren(fremd, [], [mkTruck({ id: 't' })]);
  assert.deepEqual(out.mitgefuehrt.cases.map(c => c.id), ['c2']);
  assert.deepEqual(out.mitgefuehrt.trucks.map(t => t.id), ['t9']);
});

test('mitfuehren: unveränderter Inhalt liefert dieselbe Referenz', () => {
  const cases = [mkCase('c1', 1, 1, 1)], trucks = [mkTruck({ id: 't' })];
  const einmal = mitfuehren(plan({ unplaced: [{ id: 'u', caseId: 'c1' }] }), cases, trucks);
  assert.equal(mitfuehren(einmal, cases, trucks), einmal);
});

test('mitfuehren: Altplan ohne mitgefuehrt (Schema vor 0.17.1) bekommt die Kopie', () => {
  const alt = { id: 'p', name: 'Alt', truckId: 't', placements: [P('a', 'c1', 0, 0, 0)], unplaced: [] };
  const out = mitfuehren(alt, [mkCase('c1', 1, 1, 1)], [mkTruck({ id: 't' })]);
  assert.deepEqual(out.mitgefuehrt.cases.map(c => c.id), ['c1']);
  assert.equal(out.placements, alt.placements);
});
