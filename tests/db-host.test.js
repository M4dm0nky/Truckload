import test from 'node:test';
import assert from 'node:assert/strict';

// Ohne Host muss jeder Zugriff weiter bei IndexedDB landen – die Attrappe meldet sich mit einem
// erkennbaren Fehler, sobald open() sie anfasst.
let idbOpens = 0;
globalThis.indexedDB = { open() { idbOpens++; throw new Error('IndexedDB benutzt'); } };
const db = await import('../js/store/db.js');

function fakeHost() {
  const calls = [];
  return {
    calls,
    getAll: async store => { calls.push(['getAll', store]); return []; },
    put: async (store, value) => { calls.push(['put', store, value.id]); },
    del: async (store, id) => { calls.push(['del', store, id]); },
    putMany: async items => { calls.push(['putMany', items.length]); },
  };
}

test('mit Host gehen getAll/put/del/putMany an den Host, IndexedDB bleibt unberührt', async () => {
  const host = fakeHost();
  globalThis.truckloadHost = host;
  try {
    assert.deepEqual(await db.getAll('cases'), []);
    await db.put('plans', { id: 'p1' });
    await db.del('cases', 'c1');
    await db.putMany([{ store: 'cases', value: { id: 'c2' } }]);
    assert.equal(await db.open(), null);
    await db.persist();
    assert.deepEqual(host.calls, [['getAll', 'cases'], ['put', 'plans', 'p1'], ['del', 'cases', 'c1'], ['putMany', 1]]);
    assert.equal(idbOpens, 0);
  } finally {
    delete globalThis.truckloadHost;
  }
});

test('putMany leer ruft den Host nicht', async () => {
  const host = fakeHost();
  globalThis.truckloadHost = host;
  try {
    await db.putMany([]);
    assert.deepEqual(host.calls, []);
  } finally {
    delete globalThis.truckloadHost;
  }
});

test('ohne Host weiter IndexedDB (Gegenprobe)', async () => {
  const vorher = idbOpens;
  await assert.rejects(db.getAll('cases'), /IndexedDB benutzt/);
  assert.equal(idbOpens, vorher + 1);
});
