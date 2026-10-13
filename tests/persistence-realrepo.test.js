import test from 'node:test';
import assert from 'node:assert/strict';

// Persistenz-Schicht gegen das ECHTE repo.js mit einem Speicher-Host (kein Fake-Repo): deckt den
// Ende-zu-Ende-Pfad „Sammlung mit Listen-Case-Überlagerung löschen“ ab.
globalThis.indexedDB = { open() { throw new Error('IndexedDB benutzt'); } };
const repo = await import('../js/store/repo.js');
const { createPersistence } = await import('../js/app/persistence.js');
const { withBuiltins } = await import('../js/model/collections.js');
const { createStore } = await import('../js/store/state.js');
const { stamp } = await import('../js/model/stamp.js');

function memoryHost(seed = {}) {
  const data = { cases: [], collections: [], trucks: [], plans: [], ruleSets: [], ...seed };
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
const own = (id, extra = {}) => ({ id, name: id, builtin: false, l: 60, w: 60, h: 60, weight: 1, ...extra });

async function setup(records) {
  const host = memoryHost({ collections: records });
  globalThis.truckloadHost = host;
  const loaded = await repo.loadAll();
  const store = createStore({ ...loaded, plan: null, selectedId: null });
  const alerts = [];
  let n = 0;
  const p = createPersistence({
    repo, store, stamp, uid: () => `id${++n}`,
    showAlert: async m => { alerts.push(m); }, showConfirm: async () => true,
  });
  return { host, store, p, alerts };
}
test.afterEach(() => { delete globalThis.truckloadHost; });

const libOverlay = (extra = {}) => own('lib-x', { name: 'K1', source: 'liste', company: 'TSE', legacy: true, ...extra });

test('deleteCollection (echtes repo): Sammlung mit Listen-Case-Überlagerung wird gelöscht, Überlagerung landet in Meine', async () => {
  const { host, store, p, alerts } = await setup([
    { id: 'meine', name: 'Meine Sammlung', cases: [] },
    { id: 't', name: 'TSE', cases: [libOverlay(), own('eigen')] },
  ]);
  assert.equal(await p.deleteCollection('t'), true, alerts.join('|'));
  assert.deepEqual(alerts, []);
  assert.deepEqual(host.data.collections.map(r => r.id), ['meine']);
  assert.deepEqual(host.data.collections[0].cases.map(c => c.id), ['lib-x']);
  assert.equal(host.data.collections[0].cases[0].legacy, true);
  assert.deepEqual(store.get().collections.map(c => c.id), ['standard', 'meine']);
  assert.equal(store.get().cases.find(c => c.id === 'lib-x').collectionId, 'meine');
  assert.equal(store.get().cases.some(c => c.id === 'eigen'), false);
});

test('deleteCollection (echtes repo): Überlagerung in einer Untersammlung, Eltern und Kind verschwinden', async () => {
  const { host, store, p, alerts } = await setup([
    { id: 'meine', name: 'Meine Sammlung', cases: [] },
    { id: 't', name: 'TSE', cases: [own('t1')] },
    { id: 'r', name: 'Robe', parentId: 't', cases: [libOverlay(), own('r1')] },
  ]);
  assert.equal(await p.deleteCollection('t'), true, alerts.join('|'));
  assert.deepEqual(host.data.collections.map(r => r.id), ['meine']);
  assert.deepEqual(host.data.collections[0].cases.map(c => c.id), ['lib-x']);
  assert.deepEqual(store.get().cases.filter(c => !c.builtin || c.legacy).map(c => c.id).filter(id => id === 'lib-x' || id === 'r1' || id === 't1'), ['lib-x']);
});

test('deleteCollection (echtes repo): nur die Untersammlung löschen, Eltern bleibt', async () => {
  const { host, p, alerts } = await setup([
    { id: 'meine', name: 'Meine Sammlung', cases: [] },
    { id: 't', name: 'TSE', cases: [own('t1')] },
    { id: 'r', name: 'Robe', parentId: 't', cases: [libOverlay()] },
  ]);
  assert.equal(await p.deleteCollection('r'), true, alerts.join('|'));
  assert.deepEqual(host.data.collections.map(r => r.id).sort(), ['meine', 't']);
  assert.deepEqual(host.data.collections.find(r => r.id === 'meine').cases.map(c => c.id), ['lib-x']);
  assert.deepEqual(host.data.collections.find(r => r.id === 't').cases.map(c => c.id), ['t1']);
});
