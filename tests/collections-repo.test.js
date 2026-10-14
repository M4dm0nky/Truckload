import test from 'node:test';
import assert from 'node:assert/strict';

globalThis.indexedDB = { open() { throw new Error('IndexedDB benutzt'); } };
const repo = await import('../js/store/repo.js');
const { PRESET_CASES } = await import('../js/data/preset-cases.js');
const { CASE_LIBRARY } = await import('../js/data/case-library.js');

function memoryHost(seed = {}) {
  const data = { cases: [], collections: [], trucks: [], plans: [], ruleSets: [], projectRuleSets: [], ...seed };
  const put = (s, v) => { data[s] = [...data[s].filter(x => x.id !== v.id), structuredClone(v)]; };
  return {
    data,
    getAll: async s => structuredClone(data[s]),
    put: async (s, v) => put(s, v),
    del: async (s, id) => { data[s] = data[s].filter(x => x.id !== id); },
    writeMany: async ({ puts = [], deletes = [] }) => {
      for (const { store, value } of puts) put(store, value);
      for (const { store, id } of deletes) data[store] = data[store].filter(x => x.id !== id);
    },
  };
}
async function withHost(host, fn) {
  globalThis.truckloadHost = host;
  try { return await fn(); } finally { delete globalThis.truckloadHost; }
}
const own = (id, extra = {}) => ({ id, name: id, builtin: false, l: 60, w: 60, h: 60, weight: 1, ...extra });

test('loadAll: leere Datenbank liefert Standard, Meine, alle mitgelieferten Cases', async () => {
  const host = memoryHost();
  const d = await withHost(host, () => repo.loadAll());
  assert.deepEqual(d.collections.map(c => c.id), ['standard', 'meine']);
  assert.equal(d.cases.length, PRESET_CASES.length + CASE_LIBRARY.length);
  assert.equal(host.data.collections.length, 0, 'nichts zu migrieren, nichts geschrieben');
});

test('Migration: eigene Cases aus dem alten Store landen in „Meine Sammlung“, in einem Schreibvorgang; alter Store bleibt', async () => {
  const host = memoryHost({ cases: [own('a'), own('lib-x', { company: 'CAB', legacy: true })] });
  const d = await withHost(host, () => repo.loadAll());
  const rec = host.data.collections.find(r => r.id === 'meine');
  assert.deepEqual(rec.cases.map(c => c.id).sort(), ['a', 'lib-x']);
  assert.equal(host.data.cases.length, 2, 'alter Store wird nicht gelöscht');
  assert.equal(d.cases.find(c => c.id === 'a').collectionId, 'meine');
  assert.equal(d.cases.find(c => c.id === 'lib-x').legacy, true);
  assert.equal(d.cases.filter(c => c.id === 'lib-x').length, 1, 'Überlagerung ersetzt die mitgelieferte Vorlage');
});

test('Migration scheitert: App startet trotzdem, das nächste Speichern verliert nichts', async () => {
  const host = memoryHost({ cases: [own('a'), own('b')] });
  const realWrite = host.writeMany;
  host.writeMany = async () => { throw new Error('Platte voll'); };
  const d = await withHost(host, () => repo.loadAll());
  assert.deepEqual(d.cases.filter(c => c.collectionId === 'meine' && !c.builtin).map(c => c.id).sort(), ['a', 'b']);
  assert.equal(host.data.collections.length, 0);
  host.writeMany = realWrite;
  await withHost(host, () => repo.writeCases({ upserts: [{ ...own('c'), collectionId: 'meine' }], collections: d.collections }));
  const rec = host.data.collections.find(r => r.id === 'meine');
  assert.deepEqual(rec.cases.map(c => c.id).sort(), ['a', 'b', 'c']);
});

test('Datensätze gewinnen: ist „meine“ da, wird der alte Store nicht mehr gelesen', async () => {
  const host = memoryHost({
    cases: [own('alt')],
    collections: [{ id: 'meine', name: 'Meine Sammlung', cases: [own('neu')] }, { id: 't', name: 'TSE', cases: [own('t1')] }],
  });
  const d = await withHost(host, () => repo.loadAll());
  const ids = d.cases.filter(c => !c.builtin).map(c => [c.id, c.collectionId]);
  assert.deepEqual(ids.sort(), [['neu', 'meine'], ['t1', 't']]);
  assert.deepEqual(d.collections.map(c => c.id), ['standard', 'meine', 't']);
});

test('writeCases: Case wandert, collectionId wird nicht gespeichert, ein einziger writeMany', async () => {
  const host = memoryHost({ collections: [{ id: 'meine', name: 'Meine Sammlung', cases: [own('a')] }] });
  let calls = 0;
  const wm = host.writeMany;
  host.writeMany = async arg => { calls++; return wm(arg); };
  const collections = [{ id: 'standard', name: 'Standard', readOnly: true }, { id: 'meine', name: 'Meine Sammlung' }, { id: 't', name: 'TSE' }];
  await withHost(host, () => repo.writeCases({ upserts: [{ ...own('a'), collectionId: 't', company: 'TSE' }], collections }));
  assert.equal(calls, 1);
  const t = host.data.collections.find(r => r.id === 't');
  assert.deepEqual(t.cases.map(c => c.id), ['a']);
  assert.equal('collectionId' in t.cases[0], false);
  assert.deepEqual(host.data.collections.find(r => r.id === 'meine').cases, []);
});

test('writeCases: deleteCollectionIds löscht den Datensatz in derselben Transaktion', async () => {
  const host = memoryHost({ collections: [{ id: 't', name: 'TSE', cases: [own('x')] }] });
  const collections = [{ id: 'standard', name: 'Standard', readOnly: true }, { id: 'meine', name: 'Meine Sammlung' }];
  await withHost(host, () => repo.writeCases({
    upserts: [{ ...own('lib-y', { legacy: true }), collectionId: 'meine' }], deleteCollectionIds: ['t'], collections,
  }));
  assert.deepEqual(host.data.collections.map(r => r.id), ['meine']);
});

test('Alter Datensatz im alten Schema (Cases mit company, Überlagerung, onlyInPlan) lädt vollständig', async () => {
  const host = memoryHost({ cases: [
    own('a', { company: 'TSE' }), own('lib-k', { company: 'CAB', builtin: false }), own('tmp', { onlyInPlan: true }),
  ] });
  const d = await withHost(host, () => repo.loadAll());
  for (const id of ['a', 'lib-k', 'tmp']) assert.ok(d.cases.some(c => c.id === id), id);
  assert.equal(d.cases.find(c => c.id === 'a').company, 'TSE', 'company bleibt ein gewöhnliches Feld');
  assert.equal(d.cases.find(c => c.id === 'tmp').onlyInPlan, true);
});

test('loadAllFallback: Standard und Meine, keine eigenen Cases', () => {
  const f = repo.loadAllFallback();
  assert.deepEqual(f.collections.map(c => c.id), ['standard', 'meine']);
  assert.equal(f.cases.length, PRESET_CASES.length + CASE_LIBRARY.length);
});

test('writeCases: leere Eingabe macht keinen writeMany-Aufruf', async () => {
  const host = memoryHost();
  let calls = 0;
  host.writeMany = async () => { calls++; };
  await withHost(host, () => repo.writeCases({ collections: [] }));
  assert.equal(calls, 0);
});

const metaT = [{ id: 'standard', name: 'Standard', readOnly: true }, { id: 'meine', name: 'Meine Sammlung' }, { id: 't', name: 'TSE' }];

test('saveImportWinners: alte Sicherung ohne collectionId verschiebt kein vorhandenes Case; neues kommt nach Meine', async () => {
  const host = memoryHost({ collections: [
    { id: 'meine', name: 'Meine Sammlung', cases: [] }, { id: 't', name: 'TSE', cases: [own('a')] },
  ] });
  await withHost(host, () => repo.saveImportWinners(
    { cases: [own('a', { name: 'neu' }), own('n')], trucks: [], plans: [] }, metaT));
  const t = host.data.collections.find(r => r.id === 't');
  const m = host.data.collections.find(r => r.id === 'meine');
  assert.deepEqual(t.cases.map(c => [c.id, c.name]), [['a', 'neu']]);
  assert.deepEqual(m.cases.map(c => c.id), ['n']);
});

test('saveImportWinners: bekannte collectionId bleibt, touchIds, plans und ruleSets in EINEM writeMany', async () => {
  const host = memoryHost({ collections: [{ id: 'meine', name: 'Meine Sammlung', cases: [own('a')] }] });
  const args = [];
  const wm = host.writeMany;
  host.writeMany = async arg => { args.push(arg); return wm(arg); };
  await withHost(host, () => repo.saveImportWinners({
    cases: [{ ...own('a'), collectionId: 't' }],
    collections: [{ id: 't', name: 'TSE' }, { id: 'ghost', name: 'Weg' }],
    trucks: [], plans: [{ id: 'p1' }], ruleSets: [{ id: 'r1' }],
  }, metaT));
  assert.equal(args.length, 1);
  assert.deepEqual(args[0].puts.map(p => p.store).sort(), ['collections', 'collections', 'plans', 'ruleSets']);
  assert.deepEqual(host.data.collections.find(r => r.id === 't').cases.map(c => c.id), ['a']);
  assert.deepEqual(host.data.collections.find(r => r.id === 'meine').cases, []);
  assert.equal(host.data.plans.length, 1);
});

test('saveImportWinners: ohne Sammlungsliste Fehler, ohne Gewinner kein Schreibvorgang', async () => {
  const host = memoryHost();
  let calls = 0;
  host.writeMany = async () => { calls++; };
  await withHost(host, async () => {
    await assert.rejects(repo.saveImportWinners({ cases: [], trucks: [], plans: [] }), /Sammlungsliste/);
    await repo.saveImportWinners({ cases: [], trucks: [], plans: [] }, metaT);
  });
  assert.equal(calls, 0);
});

test('mergeImportedBundle: Sammlungen aus Zustand und Datei, neuerer Stand gewinnt, Gewinner gemeldet', () => {
  const local = [{ id: 't', name: 'TSE alt', updatedAt: '2026-01-01T00:00:00.000Z' }, { id: 'u', name: 'Lokal', updatedAt: '2026-05-01T00:00:00.000Z' }];
  const file = [{ id: 't', name: 'TSE neu', updatedAt: '2026-02-01T00:00:00.000Z' }, { id: 'u', name: 'Datei alt', updatedAt: '2026-01-01T00:00:00.000Z' }];
  const r = repo.mergeImportedBundle(
    { cases: [], trucks: [], plans: [], plan: null, collections: repo.loadAllFallback().collections.concat(local) },
    { cases: [], trucks: [], plans: [], collections: file });
  assert.equal(r.collections.find(c => c.id === 't').name, 'TSE neu');
  assert.equal(r.collections.find(c => c.id === 'u').name, 'Lokal');
  assert.deepEqual(r.winners.collections.map(c => c.id), ['t']);
});

test('Migration/readRecords: null-Einträge im alten Store werden übergangen', async () => {
  const host = memoryHost({ cases: [own('a'), null] });
  const d = await withHost(host, () => repo.loadAll());
  assert.ok(d.cases.some(c => c.id === 'a'));
});

// --- Abschluss-Fixes (Welle „final“) ---

test('writeCases: gelöschte Sammlung mit Überlagerung lib-x, die nach „meine“ wandert, wirft nicht', async () => {
  const host = memoryHost({ collections: [
    { id: 'meine', name: 'Meine Sammlung', cases: [] },
    { id: 't', name: 'TSE', cases: [own('lib-x', { company: 'TSE', legacy: true }), own('eigen')] },
    { id: 'r', name: 'Robe', parentId: 't', cases: [own('r1')] },
  ] });
  const collections = [{ id: 'standard', name: 'Standard', readOnly: true }, { id: 'meine', name: 'Meine Sammlung' }];
  await withHost(host, () => repo.writeCases({
    upserts: [{ ...own('lib-x', { company: 'TSE', legacy: true }), collectionId: 'meine' }],
    deleteCollectionIds: ['t', 'r'], collections,
  }));
  assert.deepEqual(host.data.collections.map(r => r.id), ['meine']);
  const m = host.data.collections[0];
  assert.deepEqual(m.cases.map(c => c.id), ['lib-x']);
  assert.equal(m.cases[0].legacy, true);
});

test('mergeImportedBundle: flache Sicherung über ein Case in einer benannten Sammlung behält dessen collectionId', () => {
  const local = { ...own('a', { name: 'alt', updatedAt: '2026-01-01T00:00:00.000Z' }), collectionId: 'robe-id' };
  const file = own('a', { name: 'neu', updatedAt: '2026-02-01T00:00:00.000Z' });
  const fresh = own('n', { updatedAt: '2026-02-01T00:00:00.000Z' });
  const r = repo.mergeImportedBundle(
    { cases: [local], trucks: [], plans: [], plan: null, collections: repo.loadAllFallback().collections.concat([{ id: 'robe-id', name: 'Robe' }]) },
    { cases: [file, fresh], trucks: [], plans: [], collections: [] });
  const a = r.cases.find(c => c.id === 'a');
  assert.equal(a.name, 'neu');
  assert.equal(a.collectionId, 'robe-id');
  assert.equal(r.cases.find(c => c.id === 'n').collectionId, undefined, 'neues Case bleibt ohne collectionId');
  assert.deepEqual(r.winners.cases.map(c => [c.id, c.collectionId]).sort(), [['a', 'robe-id'], ['n', undefined]]);
  assert.ok(r.winners.cases.every(w => r.cases.includes(w)), 'Gewinner sind Elemente des Mischergebnisses');
});

test('mergeImportedBundle: unbekannte oder schreibgeschützte lokale Sammlung wird nicht übernommen', () => {
  const local = { ...own('a', { updatedAt: '2026-01-01T00:00:00.000Z' }), collectionId: 'standard' };
  const file = own('a', { name: 'neu', updatedAt: '2026-02-01T00:00:00.000Z' });
  const r = repo.mergeImportedBundle(
    { cases: [local], trucks: [], plans: [], plan: null, collections: repo.loadAllFallback().collections },
    { cases: [file], trucks: [], plans: [], collections: [] });
  assert.equal(r.cases.find(c => c.id === 'a').collectionId, undefined);
});

test('writeCases: ein null-Case in einem gespeicherten Datensatz wird verworfen, nichts wirft', async () => {
  const host = memoryHost({ collections: [
    { id: 'meine', name: 'Meine Sammlung', cases: [own('a'), null, 7] },
    { id: 't', name: 'TSE', cases: [null, own('t1')] },
  ] });
  await withHost(host, () => repo.writeCases({
    upserts: [{ ...own('b'), collectionId: 'meine' }, { ...own('t2'), collectionId: 't' }], collections: metaT,
  }));
  assert.deepEqual(host.data.collections.find(r => r.id === 'meine').cases.map(c => c.id).sort(), ['a', 'b']);
  assert.deepEqual(host.data.collections.find(r => r.id === 't').cases.map(c => c.id).sort(), ['t1', 't2']);
});

test('writeCases: der aus dem alten Store gebaute „meine“ ist ebenfalls bereinigt', async () => {
  const host = memoryHost({ cases: [own('a'), null, own('b', { updatedAt: 5 })] });
  await withHost(host, () => repo.writeCases({ upserts: [{ ...own('c'), collectionId: 'meine' }], collections: metaT }));
  const m = host.data.collections.find(r => r.id === 'meine');
  assert.deepEqual(m.cases.map(c => c.id).sort(), ['a', 'b', 'c']);
  assert.equal('updatedAt' in m.cases.find(c => c.id === 'b'), false);
});

test('loadAll: projectRuleSets werden geladen, Altwert von updatedAt bereinigt', async () => {
  const host = memoryHost({ projectRuleSets: [{ id: 'pr1', name: 'Tour', rules: [], updatedAt: 5 }] });
  const d = await withHost(host, () => repo.loadAll());
  assert.deepEqual(d.projectRuleSets, [{ id: 'pr1', name: 'Tour', rules: [] }]);
  assert.deepEqual(host.data.projectRuleSets, [{ id: 'pr1', name: 'Tour', rules: [] }], 'zurückgeschrieben');
});
