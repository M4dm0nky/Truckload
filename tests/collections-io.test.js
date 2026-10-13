import test from 'node:test';
import assert from 'node:assert/strict';
import { exportBundle, parseBundle, exportCollectionFile, parseCollectionFile, collectionFileName, checkCollection } from '../js/store/io.js';

const c = (id, extra = {}) => ({ id, name: id, builtin: false, l: 60, w: 60, h: 60, weight: 1, ...extra });
const plan = { id: 'p', name: 'P', truckId: 'x', placements: [], unplaced: [], notes: '' };

test('exportBundle schreibt eigene Sammlungen, nicht Standard und Meine; parseBundle liest sie zurück', () => {
  const text = exportBundle({
    cases: [c('a', { collectionId: 't' })], trucks: [], plans: [plan], ruleSets: [],
    collections: [{ id: 'standard', name: 'Standard', readOnly: true }, { id: 'meine', name: 'Meine Sammlung' }, { id: 't', name: 'TSE', updatedAt: 'T' }],
  });
  const raw = JSON.parse(text);
  assert.deepEqual(raw.collections.map(x => x.id), ['t']);
  const back = parseBundle(text);
  assert.deepEqual(back.collections.map(x => x.name), ['TSE']);
  assert.equal(back.cases[0].collectionId, 't');
});

test('Alte Sicherung ohne collections lädt: Cases ohne collectionId, leere Sammlungsliste', () => {
  const old = JSON.stringify({
    format: 'truckload', version: 1, cases: [c('a', { company: 'TSE' }), c('lib-k', { company: 'CAB', legacy: true }), c('t', { onlyInPlan: true })],
    trucks: [], plans: [plan], ruleSets: [],
  });
  const b = parseBundle(old);
  assert.equal(b.cases.length, 3);
  assert.deepEqual(b.collections, []);
  assert.ok(b.cases.every(x => x.collectionId === undefined));
});

test('Case mit collectionId auf eine Sammlung, die die Datei nicht kennt, verliert das Feld und wird gemeldet', () => {
  const text = JSON.stringify({ format: 'truckload', version: 1, cases: [c('a', { collectionId: 'weg' }), c('b', { collectionId: 'meine' })], trucks: [], plans: [plan], ruleSets: [], collections: [] });
  const b = parseBundle(text);
  assert.equal(b.cases.find(x => x.id === 'a').collectionId, undefined);
  assert.equal(b.cases.find(x => x.id === 'b').collectionId, 'meine');
  assert.ok(b.repairs.some(r => /Sammlung/.test(r)));
});

test('checkCollection: Name, ID, Zeitstempel, parentId', () => {
  assert.doesNotThrow(() => checkCollection({ id: 'a', name: 'A' }));
  assert.throws(() => checkCollection({ id: 'a' }), /ohne ID oder Name/);
  assert.throws(() => checkCollection({ id: 'a', name: 'x'.repeat(81) }), /zu lang/);
  assert.throws(() => checkCollection({ id: 'a', name: 'A', parentId: 5 }), /ungültig/);
  assert.throws(() => checkCollection({ id: 'a', name: 'A', updatedAt: 3 }), /Zeitstempel/);
});

test('parseBundle: Sammlungen mit parentId-Schleife werden angenommen und gemeldet statt abgelehnt', () => {
  const text = JSON.stringify({ format: 'truckload', version: 1, cases: [], trucks: [], plans: [plan], ruleSets: [],
    collections: [{ id: 'a', name: 'A', parentId: 'b' }, { id: 'b', name: 'B', parentId: 'a' }] });
  const b = parseBundle(text);
  assert.ok(b.collections.every(x => x.parentId === undefined));
  assert.ok(b.repairs.some(r => /Oberebene|Schleife/.test(r)));
});

test('Sammlungsdatei: Export und Parsen, mitgelieferte Cases bleiben draußen', () => {
  const text = exportCollectionFile({ id: 't', name: 'TSE' }, [c('a', { collectionId: 't' }), c('lib-x', { builtin: true })], new Date('2026-10-13T10:00:00Z'));
  const raw = JSON.parse(text);
  assert.equal(raw.format, 'truckload-collection');
  assert.deepEqual(raw.cases.map(x => x.id), ['a']);
  assert.equal('collectionId' in raw.cases[0], false);
  const back = parseCollectionFile(text);
  assert.deepEqual(back.collection, { id: 't', name: 'TSE' });
  assert.equal(back.cases.length, 1);
  assert.equal(collectionFileName('Robe & Co', new Date('2026-10-13T10:00:00Z')), 'sammlung-robe-co-2026-10-13.json');
});

test('Sammlungsdatei: falsches Format, neuere Version, Fremdes, leer', () => {
  assert.throws(() => parseCollectionFile('{}'), /Sammlungsdatei/);
  assert.throws(() => parseCollectionFile(JSON.stringify({ format: 'truckload-collection', version: 99, collection: { id: 'a', name: 'A' }, cases: [] })), /neueren Version/);
  assert.throws(() => parseCollectionFile(JSON.stringify({ format: 'truckload-collection', version: 1, collection: { id: 'a', name: 'A' }, cases: [{ id: 'x' }] })), /Case/);
  assert.throws(() => parseCollectionFile('kein json'), /kein gültiges JSON/);
});
