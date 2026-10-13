import test from 'node:test';
import assert from 'node:assert/strict';
import { createPersistence } from '../js/app/persistence.js';
import { withBuiltins } from '../js/model/collections.js';
import { createStore } from '../js/store/state.js';
import { stamp } from '../js/model/stamp.js';

const own = (id, extra = {}) => ({ id, name: id, builtin: false, l: 60, w: 60, h: 60, weight: 1, ...extra });
function setup(cases = [], collections = withBuiltins([]), writer = null) {
  const writes = [];
  const repo = { writeCases: writer ? async arg => { await writer(arg); writes.push(arg); } : async arg => { writes.push(arg); }, savePlan: async () => {}, deleteTruck: async () => {}, saveTruck: async () => {} };
  const store = createStore({ cases, collections, trucks: [], plans: [], plan: null, ruleSets: [], selectedId: null });
  let n = 0;
  const alerts = [];
  const p = createPersistence({
    repo, store, stamp, uid: () => `id${++n}`,
    showAlert: async m => { alerts.push(m); }, showConfirm: async () => true,
  });
  return { p, store, writes, alerts };
}

test('saveCase: neue Firma im Wizard legt die Sammlung an, ein Schreibvorgang, Store hat Case und Sammlung', async () => {
  const { p, store, writes } = setup();
  const saved = await p.saveCase(own('a', { company: 'TSE' }));
  assert.equal(writes.length, 1);
  assert.equal(saved.collectionId, 'id1');
  assert.deepEqual(store.get().collections.map(c => c.name), ['Standard', 'Meine Sammlung', 'TSE']);
});

test('saveCase: ohne company und ohne Vorgänger landet das Case in Meine Sammlung', async () => {
  const { p } = setup();
  assert.equal((await p.saveCase(own('a'))).collectionId, 'meine');
});

test('createCollection: Namenskollision und Ebenen werden gemeldet, nichts geschrieben', async () => {
  const { p, writes, alerts } = setup([], withBuiltins([{ id: 't', name: 'TSE' }]));
  assert.equal(await p.createCollection('tse', null), null);
  assert.equal(writes.length, 0);
  assert.match(alerts[0], /gibt es schon/);
  const id = await p.createCollection('Robe', 't');
  assert.equal(id, 'id1');
  assert.deepEqual(writes[0].touchIds, ['id1']);
});

test('renameCollection: company der enthaltenen Cases zieht mit, in einem Schreibvorgang', async () => {
  const cases = [own('a', { collectionId: 't', company: 'TSE' })];
  const { p, store, writes } = setup(cases, withBuiltins([{ id: 't', name: 'TSE' }]));
  assert.equal(await p.renameCollection('t', 'TSE Berlin'), true);
  assert.equal(writes.length, 1);
  assert.equal(store.get().cases[0].company, 'TSE Berlin');
  assert.equal(store.get().collections.find(c => c.id === 't').name, 'TSE Berlin');
});

test('moveCollection: Zyklus wird abgelehnt', async () => {
  const cols = withBuiltins([{ id: 't', name: 'TSE' }, { id: 'r', name: 'Robe', parentId: 't' }]);
  const { p, alerts } = setup([], cols);
  assert.equal(await p.moveCollection('t', 'r'), false);
  assert.match(alerts[0], /in sich selbst/);
});

test('deleteCollection: Listen-Case wird in Meine ausgeblendet statt gelöscht, eigene Cases fallen weg, Unterbaum geht mit', async () => {
  const cols = withBuiltins([{ id: 't', name: 'TSE' }, { id: 'r', name: 'Robe', parentId: 't' }]);
  const lib = { id: 'lib-x', builtin: false, name: 'K1', source: 'liste', company: 'TSE', collectionId: 't', l: 1, w: 1, h: 1, weight: 0 };
  const cases = [lib, own('u', { collectionId: 'r', company: 'Robe' })];
  const { p, store, writes } = setup(cases, cols);
  assert.equal(await p.deleteCollection('t'), true);
  assert.deepEqual(writes[0].deleteCollectionIds.sort(), ['r', 't']);
  const hidden = writes[0].upserts.find(c => c.id === 'lib-x');
  assert.equal(hidden.legacy, true);
  assert.equal(hidden.collectionId, 'meine');
  assert.deepEqual(store.get().cases.map(c => c.id), ['lib-x']);
  assert.deepEqual(store.get().collections.map(c => c.id), ['standard', 'meine']);
});

test('moveCaseTo: setzt company und collectionId, Standardvorlage lässt sich nicht verschieben', async () => {
  const cols = withBuiltins([{ id: 't', name: 'TSE' }]);
  const preset = { id: 'preset-a', builtin: true, name: 'P', l: 1, w: 1, h: 1, weight: 1 };
  const { p, store, alerts } = setup([own('a'), preset], cols);
  assert.equal(await p.moveCaseTo('a', 't'), true);
  assert.equal(store.get().cases.find(c => c.id === 'a').company, 'TSE');
  assert.equal(await p.moveCaseTo('preset-a', 't'), false);
  assert.equal(alerts.length, 1);
});

test('importCollectionFile: neue Sammlung mit Cases, company = Name, ein Schreibvorgang', async () => {
  const { p, store, writes } = setup();
  const meta = await p.importCollectionFile({ collection: { id: 'x', name: 'Robe' }, cases: [own('k1')] });
  assert.equal(meta.name, 'Robe');
  assert.equal(writes.length, 1);
  assert.equal(store.get().cases[0].company, 'Robe');
  assert.equal(store.get().cases[0].collectionId, 'x');
});

test('Schreibvorgänge laufen strikt nacheinander: zwei saveCase ohne await legen die Sammlung nur einmal an', async () => {
  const order = [];
  let first = true;
  const slow = async arg => {
    const delay = first ? 20 : 0; first = false;
    order.push(`start:${arg.upserts[0].id}`);
    await new Promise(r => setTimeout(r, delay));
    order.push(`end:${arg.upserts[0].id}`);
  };
  const ctx = setup([], withBuiltins([]), slow);
  const [a, b] = await Promise.all([
    ctx.p.saveCase(own('a', { company: 'Neu' })),
    ctx.p.saveCase(own('b', { company: 'Neu' })),
  ]);
  assert.deepEqual(order, ['start:a', 'end:a', 'start:b', 'end:b']);
  assert.equal(a.collectionId, b.collectionId);
  assert.equal(ctx.store.get().collections.filter(c => c.name === 'Neu').length, 1);
  assert.equal(ctx.writes.length, 2);
  assert.deepEqual(ctx.writes[0].touchIds, ['id1']);
  assert.deepEqual(ctx.writes[1].touchIds, []);
});

test('Eine fehlgeschlagene Schreibung vergiftet die Warteschlange nicht', async () => {
  let fail = true;
  const ctx = setup([], withBuiltins([]), async () => { if (fail) { fail = false; throw new Error('kaputt'); } });
  assert.equal(await ctx.p.saveCase(own('a')), undefined);
  assert.equal((await ctx.p.saveCase(own('b'))).id, 'b');
  assert.match(ctx.alerts[0], /kaputt/);
});
