import test from 'node:test';
import assert from 'node:assert/strict';
import * as hostDb from '../js/store/hostDb.js';

// Fake-Host wie ihn NYX per Preload setzt (docs/nyx-host.md): Promise-Funktionen, Aufrufe werden
// mitgeschrieben.
function fakeHost(over = {}) {
  const calls = [];
  const host = {
    calls,
    getAll: async store => { calls.push(['getAll', store]); return [{ id: 'a' }]; },
    put: async (store, value) => { calls.push(['put', store, value]); },
    del: async (store, id) => { calls.push(['del', store, id]); },
    putMany: async items => { calls.push(['putMany', items]); },
    ...over,
  };
  return host;
}

test('getAll reicht an den Host durch und liefert dessen Liste', async () => {
  const h = fakeHost();
  assert.deepEqual(await hostDb.getAll(h, 'cases'), [{ id: 'a' }]);
  assert.deepEqual(h.calls, [['getAll', 'cases']]);
});

test('getAll lehnt Nicht-Liste ab (sonst sähe der Bestand gelöscht aus)', async () => {
  for (const wert of [undefined, null, {}]) {
    const h = fakeHost({ getAll: async () => wert });
    await assert.rejects(hostDb.getAll(h, 'plans'), err => err instanceof Error && /keine Liste/.test(err.message));
  }
});

test('put, del und putMany reichen unverändert durch und lösen ohne Wert auf', async () => {
  const h = fakeHost();
  const value = { id: 'p1', name: 'Plan' };
  assert.equal(await hostDb.put(h, 'plans', value), undefined);
  assert.equal(await hostDb.del(h, 'cases', 'c1'), undefined);
  const items = [{ store: 'cases', value: { id: 'c2' } }, { store: 'plans', value }];
  assert.equal(await hostDb.putMany(h, items), undefined);
  assert.deepEqual(h.calls, [['put', 'plans', value], ['del', 'cases', 'c1'], ['putMany', items]]);
});

test('synchroner Wurf des Hosts wird zur Ablehnung mit Error', async () => {
  const h = fakeHost({ put: () => { throw new Error('kaputt'); } });
  const p = hostDb.put(h, 'plans', { id: 'x' });
  assert.ok(p instanceof Promise);
  await assert.rejects(p, err => err instanceof Error && err.message === 'kaputt');
});

test('Ablehnung ohne Error-Objekt wird zu Error mit lesbarer Meldung', async () => {
  const h1 = fakeHost({ del: async () => { throw 'Kein Projekt offen.'; } });
  await assert.rejects(hostDb.del(h1, 'plans', 'x'), err => err instanceof Error && err.message === 'Kein Projekt offen.');
  const h2 = fakeHost({ putMany: async () => { throw { error: 'voll' }; } });
  await assert.rejects(hostDb.putMany(h2, []), err => err instanceof Error && /voll/.test(err.message));
  const h3 = fakeHost({ getAll: async () => { throw null; } });
  await assert.rejects(hostDb.getAll(h3, 'cases'), err => err instanceof Error && err.message === 'NYX-Speicher nicht erreichbar');
});
