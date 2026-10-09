import test from 'node:test';
import assert from 'node:assert/strict';

// Eigene Datei, weil die Ladesperre in db.js Modulzustand ist: einmal gesetzt, bleibt sie bis
// zum Neuladen. Der Kontrolltest steht deshalb VOR dem fehlschlagenden Laden; die Reihenfolge
// ist Absicht.
globalThis.indexedDB = { open() { throw new Error('IndexedDB benutzt'); } };
const db = await import('../js/store/db.js');

const MELDUNG = 'Laden aus NYX fehlgeschlagen – Truckload bitte neu laden.';

function fakeHost(getAll) {
  const calls = [];
  return {
    calls,
    getAll,
    put: async (store, value) => { calls.push(['put', store, value.id]); },
    del: async (store, id) => { calls.push(['del', store, id]); },
    putMany: async items => { calls.push(['putMany', items.length]); },
  };
}

test('Kontrolle (vor dem Ladefehler): mit gesundem Host erreicht put den Host', async () => {
  const host = fakeHost(async () => []);
  globalThis.truckloadHost = host;
  try {
    await db.getAll('plans');
    await db.put('cases', { id: 'c' });
    assert.deepEqual(host.calls, [['put', 'cases', 'c']]);
  } finally {
    delete globalThis.truckloadHost;
  }
});

test('nach gescheitertem Lesen sperrt db.js put, del und putMany, putMany([]) bleibt frei', async () => {
  const fehler = new Error('Lesen kaputt');
  const host = fakeHost(async () => { throw fehler; });
  globalThis.truckloadHost = host;
  try {
    await assert.rejects(db.getAll('plans'), err => err === fehler);
    const sperre = err => err instanceof Error && err.message === MELDUNG;
    await assert.rejects(db.put('cases', { id: 'c' }), sperre);
    await assert.rejects(db.del('plans', 'p'), sperre);
    await assert.rejects(db.putMany([{ store: 'cases', value: { id: 'c' } }]), sperre);
    await db.putMany([]);
    assert.deepEqual(host.calls, []);
  } finally {
    delete globalThis.truckloadHost;
  }
});
