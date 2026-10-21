import test from 'node:test';
import assert from 'node:assert/strict';
import {
  STANDARD_ID, MEINE_ID, withBuiltins, collectionIdOf, composeRecords, collectionRows, descendantIds,
  depthOf, collectionNameError, parentError, resolveTarget, moveCase, recordsAfterChanges,
  userCollectionNames, planCollectionImport, exportableCases, adoptInto,
} from '../js/model/collections.js';

const stampFn = r => ({ ...r, updatedAt: 'T' });
const tse = { id: 't', name: 'TSE' };
const robe = { id: 'r', name: 'Robe', parentId: 't' };
const metas = withBuiltins([robe, tse]);

test('withBuiltins: Standard und Meine vorn, eigene alphabetisch, Name und readOnly der festen sind fest', () => {
  const m = withBuiltins([{ id: 'meine', name: 'Falsch' }, { id: 'z', name: 'Zeta' }, { id: 'a', name: 'Alpha' }]);
  assert.deepEqual(m.map(x => x.id), ['standard', 'meine', 'a', 'z']);
  assert.equal(m[0].readOnly, true);
  assert.equal(m[1].name, 'Meine Sammlung');
});

test('collectionIdOf: eigene ID, sonst Standard für preset-, sonst Meine', () => {
  assert.equal(collectionIdOf({ id: 'x', collectionId: 't' }), 't');
  assert.equal(collectionIdOf({ id: 'preset-a', builtin: true }), STANDARD_ID);
  assert.equal(collectionIdOf({ id: 'lib-a', builtin: true }), MEINE_ID);
  assert.equal(collectionIdOf({ id: 'u1' }), MEINE_ID);
});

test('composeRecords: Cases bekommen collectionId, Standard-Datensatz wird ignoriert, Meine fehlt nie', () => {
  const { collections, cases } = composeRecords([
    { id: 't', name: 'TSE', cases: [{ id: 'c1' }] },
    { id: 'standard', name: 'x', cases: [{ id: 'bad' }] },
  ]);
  assert.deepEqual(collections.map(c => c.id), ['standard', 'meine', 't']);
  assert.deepEqual(cases, [{ id: 'c1', collectionId: 't' }]);
});

test('collectionRows: Baum mit Tiefe, Kinder unter dem Elternteil, Schleife geht nicht verloren', () => {
  const rows = collectionRows(metas);
  assert.deepEqual(rows.map(r => [r.collection.id, r.depth]), [['standard', 0], ['meine', 0], ['t', 0], ['r', 1]]);
  const loop = [{ id: 'a', name: 'A', parentId: 'b' }, { id: 'b', name: 'B', parentId: 'a' }];
  assert.equal(collectionRows(loop).length, 2);
});

test('descendantIds und depthOf', () => {
  assert.deepEqual([...descendantIds(metas, 't')].sort(), ['r', 't']);
  assert.equal(depthOf(metas, 't'), 1);
  assert.equal(depthOf(metas, 'r'), 2);
});

test('collectionNameError: leer, zu lang, reserviert, doppelt (ohne Groß-/Kleinschreibung), Ausnahme-ID', () => {
  assert.match(collectionNameError('  ', metas), /fehlt/);
  assert.match(collectionNameError('x'.repeat(81), metas), /höchstens/);
  assert.match(collectionNameError('__x__', metas), /reserviert/);
  assert.match(collectionNameError('tse', metas), /gibt es schon/);
  assert.equal(collectionNameError('tse', metas, 't'), null);
  assert.equal(collectionNameError('Neu', metas), null);
});

test('parentError: Standard nie Oberebene, kein Zyklus, höchstens 4 Ebenen', () => {
  assert.match(parentError(metas, null, 'standard'), /nicht möglich/);
  assert.match(parentError(metas, 't', 'r'), /in sich selbst/);
  const deep = withBuiltins([
    { id: '1', name: '1' }, { id: '2', name: '2', parentId: '1' },
    { id: '3', name: '3', parentId: '2' }, { id: '4', name: '4', parentId: '3' },
  ]);
  assert.match(parentError(deep, null, '4'), /Ebenen/);
  assert.equal(parentError(deep, null, '3'), null);
  assert.equal(parentError(metas, 'r', null), null);
});

test('resolveTarget: ausdrückliche ID, vorhandenes Case, Name der Firma, sonst Meine', () => {
  let n = 0;
  const newId = () => `n${++n}`;
  assert.deepEqual(resolveTarget({ id: 'a', collectionId: 't' }, null, metas, newId), { id: 't' });
  assert.deepEqual(resolveTarget({ id: 'a' }, { id: 'a', collectionId: 'r' }, metas, newId), { id: 'r' });
  assert.deepEqual(resolveTarget({ id: 'a', company: 'tse' }, null, metas, newId), { id: 't' });
  assert.deepEqual(resolveTarget({ id: 'a', company: 'Neu' }, null, metas, newId), { id: 'n1', created: { id: 'n1', name: 'Neu' } });
  assert.deepEqual(resolveTarget({ id: 'a' }, null, metas, newId), { id: 'meine' });
  assert.deepEqual(resolveTarget({ id: 'a', company: 'Meine Sammlung' }, null, metas, newId), { id: 'meine' });
  // Listen-Case mit company „CAB“, bearbeitet: bleibt in Meine, legt keine Sammlung „CAB“ an
  assert.deepEqual(resolveTarget({ id: 'lib-x', company: 'CAB' }, { id: 'lib-x', builtin: true }, metas, newId), { id: 'meine' });
});

test('moveCase: eigene Sammlung setzt company, Meine löscht sie, Listen-Case wird zur Überlagerung', () => {
  const lib = { id: 'lib-x', builtin: true, company: 'CAB', name: 'K1' };
  const moved = moveCase(lib, { id: 't', name: 'TSE' });
  assert.deepEqual([moved.id, moved.builtin, moved.company, moved.collectionId], ['lib-x', false, 'TSE', 't']);
  const back = moveCase(moved, { id: MEINE_ID, name: 'Meine Sammlung' });
  assert.equal(back.company, undefined);
  assert.equal(back.collectionId, 'meine');
});

test('recordsAfterChanges: Case wandert zwischen Datensätzen, nur geänderte kommen zurück, collectionId wird nicht gespeichert', () => {
  const records = [
    { id: 'meine', name: 'Meine Sammlung', cases: [{ id: 'a' }, { id: 'b' }] },
    { id: 't', name: 'TSE', cases: [{ id: 'c' }] },
  ];
  const out = recordsAfterChanges(records, metas, { upserts: [{ id: 'a', collectionId: 't', x: 1 }] }, stampFn);
  assert.deepEqual(out.map(r => r.id).sort(), ['meine', 't']);
  assert.deepEqual(out.find(r => r.id === 'meine').cases, [{ id: 'b' }]);
  assert.deepEqual(out.find(r => r.id === 't').cases, [{ id: 'c' }, { id: 'a', x: 1 }]);
  assert.equal(out[0].updatedAt, 'T');
});

test('recordsAfterChanges: fehlender Datensatz entsteht aus der Meta (Meine), Löschen und touchIds', () => {
  const out = recordsAfterChanges([], metas, { upserts: [{ id: 'a', collectionId: 'meine' }], touchIds: ['t'] }, stampFn);
  assert.deepEqual(out.map(r => [r.id, r.name]).sort(), [['meine', 'Meine Sammlung'], ['t', 'TSE']]);
  const rem = recordsAfterChanges([{ id: 't', name: 'TSE', cases: [{ id: 'c' }] }], metas, { removeIds: ['c'] }, stampFn);
  assert.deepEqual(rem[0].cases, []);
  assert.throws(() => recordsAfterChanges([], metas, { upserts: [{ id: 'a', collectionId: 'weg' }] }, stampFn), /unbekannt/);
});

test('userCollectionNames: ohne Standard und Meine', () => {
  assert.deepEqual(userCollectionNames(metas), ['Robe', 'TSE']);
});

test('planCollectionImport: gleiche ID mischt in die vorhandene, gleicher Name anderer ID bekommt Suffix, neue ID bleibt', () => {
  let n = 0;
  const newId = () => `n${++n}`;
  const file = { collection: { id: 't', name: 'TSE' }, cases: [{ id: 'k1', name: 'K' }] };
  const same = planCollectionImport(metas, file, newId);
  assert.equal(same.meta.id, 't');
  assert.deepEqual(same.cases.map(c => [c.id, c.collectionId, c.company]), [['k1', 't', 'TSE']]);

  const clash = planCollectionImport(metas, { collection: { id: 'andere', name: 'tse' }, cases: [] }, newId);
  assert.equal(clash.meta.id, 'andere');
  assert.equal(clash.meta.name, 'tse (2)');

  const fresh = planCollectionImport(metas, { collection: { id: 'neu', name: 'Mac' }, cases: [{ id: 'x' }] }, newId);
  assert.ok(fresh.merged.some(c => c.id === 'neu'));
});

test('Zyklen aus fremden Daten: parentError und depthOf hängen nicht und laufen nicht über', () => {
  const cols = withBuiltins([
    { id: 'A', name: 'A', parentId: 'B' },
    { id: 'B', name: 'B', parentId: 'A' },
    { id: 'C', name: 'C' },
  ]);
  const err = parentError(cols, 'A', 'C');
  assert.ok(err === null || typeof err === 'string');
  assert.equal(depthOf(cols, 'A'), 2);
});

test('resolveTarget: Name einer festen Sammlung oder reservierter Name wird nicht als neue Sammlung angelegt', () => {
  let n = 0;
  const newId = () => `n${++n}`;
  assert.deepEqual(resolveTarget({ id: 'a', company: 'standard' }, null, metas, newId), { id: 'meine' });
  assert.deepEqual(resolveTarget({ id: 'a', company: 'Standard' }, null, metas, newId), { id: 'meine' });
  assert.deepEqual(resolveTarget({ id: 'a', company: '__x__' }, null, metas, newId), { id: 'meine' });
  assert.equal(n, 0);
});

test('resolveTarget: veraltete collectionId fällt auf die Sammlung des vorhandenen Cases zurück', () => {
  const newId = () => 'n1';
  assert.deepEqual(resolveTarget({ id: 'a', collectionId: 'weg' }, { id: 'a', collectionId: 'r' }, metas, newId), { id: 'r' });
});

test('withBuiltins: Veränderung des Ergebnisses wirkt nicht auf den nächsten Aufruf', () => {
  const first = withBuiltins([]);
  first[0].name = 'Verändert';
  first[0].readOnly = false;
  const second = withBuiltins([]);
  assert.equal(second[0].name, 'Standard');
  assert.equal(second[0].readOnly, true);
});

test('recordsAfterChanges: stampFn bekommt nur den Datensatz (kein Index als zweites Argument)', () => {
  const out = recordsAfterChanges([], metas, { touchIds: ['t'] }, (r, now = 'X') => ({ ...r, updatedAt: now }));
  assert.equal(out[0].updatedAt, 'X');
});

test('exportableCases: nur Bestand der Sammlung, kein onlyInPlan/legacy', () => {
  const cases = [
    { id: 'a', collectionId: 't' }, { id: 'b', collectionId: 't', onlyInPlan: true },
    { id: 'c', collectionId: 't', legacy: true }, { id: 'd' }, { id: 'e', collectionId: 'meine', onlyInPlan: true },
  ];
  assert.deepEqual(exportableCases(cases, 't').map(c => c.id), ['a']);
  assert.deepEqual(exportableCases(cases, MEINE_ID).map(c => c.id), ['d']);
});

test('adoptInto: Plan-Case mit collectionId meine landet in der gewählten Sammlung, onlyInPlan weg', () => {
  const c = { id: 'p', name: 'X', collectionId: 'meine', onlyInPlan: true };
  const r = adoptInto(c, tse);
  assert.equal(r.collectionId, 't');
  assert.equal(r.company, 'TSE');
  assert.equal(r.onlyInPlan, undefined);
  const m = adoptInto({ ...c, company: 'TSE' }, withBuiltins([]).find(x => x.id === MEINE_ID));
  assert.equal(m.collectionId, MEINE_ID);
  assert.equal(m.company, undefined);
});

test('moveCase: Listen-Case kommt mit seiner Marke aus meine.json aus einer Sammlung zurück (#6)', async () => {
  const { CASE_LIBRARY } = await import('../js/data/case-library.js');
  const shipped = CASE_LIBRARY.find(c => c.company);
  assert.ok(shipped, 'meine.json hat Listen-Cases mit Marke');
  const moved = moveCase(shipped, { id: 't', name: 'TSE' }, shipped);
  assert.equal(moved.company, 'TSE');
  const back = moveCase(moved, { id: MEINE_ID, name: 'Meine Sammlung' }, shipped);
  assert.equal(back.company, shipped.company);
  assert.equal(back.collectionId, MEINE_ID);
});

test('moveCase: eigenes Case (ohne mitgelieferte Fassung) verliert die Marke wie bisher (#6)', () => {
  const own = { id: 'own-1', builtin: false, company: 'TSE', name: 'Eigenes' };
  assert.equal(moveCase(own, { id: MEINE_ID, name: 'Meine Sammlung' }, undefined).company, undefined);
  // nach „Standard“-ähnlichen festen Zielen (kein Meine) bleibt es ohne Marke
  assert.equal(moveCase(own, { id: 'standard', name: 'Standard' }, { company: 'CAB' }).company, undefined);
});
