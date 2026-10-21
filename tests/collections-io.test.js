import test from 'node:test';
import assert from 'node:assert/strict';
import { exportBundle, parseBundle, exportCollectionFile, parseCollectionFile, collectionFileName, checkCollection, checkCase } from '../js/store/io.js';
import { NAME_MAX } from '../js/model/limits.js';

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

const bundleOf = collections => JSON.stringify({ format: 'truckload', version: 1, cases: [], trucks: [], plans: [], ruleSets: [], collections });

test('doppelte Sammlungs-IDs lehnen die Datei ab', () => {
  assert.throws(() => parseBundle(bundleOf([{ id: 'a', name: 'A' }, { id: 'a', name: 'B' }])), /doppelte IDs/);
});

test('Bundle nur mit Sammlungen ist nicht leer', () => {
  const b = parseBundle(bundleOf([{ id: 'a', name: 'A' }]));
  assert.deepEqual(b.collections.map(x => x.id), ['a']);
});

test('Sammlung als eigene Oberebene wird repariert und gemeldet', () => {
  const b = parseBundle(bundleOf([{ id: 'a', name: 'A', parentId: 'a' }]));
  assert.equal(b.collections[0].parentId, undefined);
  assert.ok(b.repairs.some(r => /Oberebene|Schleife/.test(r)));
});

test('readOnly, builtin, preset- und fremde Felder kommen nicht in den Bestand', () => {
  const b = parseBundle(bundleOf([
    { id: 'r', name: 'R', readOnly: true }, { id: 'b', name: 'B', builtin: true }, { id: 'preset-x', name: 'P' },
    { id: 'k', name: 'K', cases: [1], evil: 'x', updatedAt: 'T' },
  ]));
  assert.deepEqual(b.collections, [{ id: 'k', name: 'K', updatedAt: 'T' }]);
});

test('null-Eintrag in collections lehnt die Datei ab', () => {
  assert.throws(() => parseBundle(bundleOf([null])), /Sammlung ohne ID oder Name/);
});

test('reservierte, doppelte und feste Namen werden umbenannt und gemeldet', () => {
  const b = parseBundle(bundleOf([
    { id: 'a', name: '__x__' }, { id: 'b', name: 'Standard' }, { id: 'c', name: 'Meine Sammlung' },
    { id: 'd', name: 'TSE' }, { id: 'e', name: 'tse' },
  ]));
  const names = b.collections.map(x => x.name);
  assert.equal(new Set(names.map(n => n.toLowerCase())).size, 5);
  assert.deepEqual(names.slice(3), ['TSE', 'tse (2)']);
  assert.ok(names.every(n => !/^__.*__$/.test(n) && n !== 'Standard' && n !== 'Meine Sammlung'));
  assert.equal(b.repairs.filter(r => /Name doppelt oder reserviert/.test(r)).length, 1);
  assert.ok(b.repairs.some(r => /^4 Sammlungen/.test(r)));
});

test('Umbenennen hält die Namenslänge ein', () => {
  const b = parseBundle(bundleOf([{ id: 'a', name: 'x'.repeat(80) }, { id: 'b', name: 'X'.repeat(80) }]));
  assert.ok(b.collections.every(x => x.name.length <= 80));
  assert.notEqual(b.collections[0].name, b.collections[1].name);
});

test('leere und zu lange Sammlungs-IDs werden abgelehnt', () => {
  assert.throws(() => checkCollection({ id: '', name: 'A' }), /ohne ID oder Name/);
  assert.throws(() => checkCollection({ id: 'x'.repeat(65), name: 'A' }), /ID zu lang/);
  assert.doesNotThrow(() => checkCollection({ id: 'x'.repeat(64), name: 'A' }));
});

test('Sammlungsdatei: reservierter Name wird abgelehnt', () => {
  const t = JSON.stringify({ format: 'truckload-collection', version: 1, collection: { id: 'a', name: '__x__' }, cases: [] });
  assert.throws(() => parseCollectionFile(t), /reserviert/);
});

test('Sammlung unter „Meine Sammlung“: parentId überlebt Export und Parsen ohne Reparaturhinweis', () => {
  const text = exportBundle({
    cases: [], trucks: [], plans: [plan], ruleSets: [],
    collections: [{ id: 'standard', name: 'Standard', readOnly: true }, { id: 'meine', name: 'Meine Sammlung' }, { id: 'a', name: 'Robe', parentId: 'meine' }],
  });
  const b = parseBundle(text);
  assert.equal(b.collections.find(x => x.id === 'a').parentId, 'meine');
  assert.deepEqual(b.repairs.filter(r => /Oberebene/.test(r)), []);
});

test('parentId „standard“ wird weiterhin repariert und gemeldet', () => {
  const b = parseBundle(bundleOf([{ id: 'a', name: 'A', parentId: 'standard' }]));
  assert.equal(b.collections[0].parentId, undefined);
  assert.ok(b.repairs.some(r => /Oberebene/.test(r)));
});

// #11: Altschema-Reparaturen auch für Sammlungsdateien (statt Ablehnung), mit Meldung
const dateiMit = cases => JSON.stringify({ format: 'truckload-collection', version: 1, collection: { id: 't', name: 'TSE' }, cases });

test('Sammlungsdatei: alte Rollenhöhe (≥ Case-Höhe) wird repariert und gemeldet, Maße bleiben', () => {
  const alt = c('a', { l: 100, w: 50, h: 40, wheels: true, wheelH: 40 });
  assert.throws(() => checkCase(alt), /ungültige Eigenschaften/);
  const r = parseCollectionFile(dateiMit([alt]));
  assert.deepEqual([r.cases[0].l, r.cases[0].w, r.cases[0].h], [100, 50, 40]);
  assert.equal(r.cases[0].wheelH, 0);
  assert.equal(r.cases[0].wheels, false);
  assert.equal(r.repairs.length, 1);
  assert.match(r.repairs[0], /1 Case: Rollenhöhe/);
});

test('Sammlungsdatei: zu langer Name wird gekürzt und gemeldet; saubere Datei meldet nichts', () => {
  const lang = c('b', { name: 'N'.repeat(NAME_MAX + 5) });
  const r = parseCollectionFile(dateiMit([lang]));
  assert.equal(r.cases[0].name.length, NAME_MAX);
  assert.match(r.repairs[0], new RegExp(`Name länger als ${NAME_MAX} Zeichen`));
  assert.deepEqual(parseCollectionFile(dateiMit([c('ok')])).repairs, []);
});
