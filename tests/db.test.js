import test from 'node:test';
import assert from 'node:assert/strict';

// Fake-indexedDB-Global (Befund F1): reine Event-Attrappe, kein echtes IndexedDB nötig.
// Muss VOR dem Import von js/store/db.js gesetzt sein, weil open() beim Aufruf das globale
// `indexedDB` liest.
function makeFakeRequest(fakeDb) {
  return { result: fakeDb, onupgradeneeded: null, onblocked: null, onsuccess: null, onerror: null };
}

globalThis.indexedDB = { open: () => { throw new Error('nicht in diesem Test benutzt'); } };
const db = await import('../js/store/db.js');

test('open(): onblocked lehnt NICHT ab, wartet weiter; onsuccess löst danach auf; onversionchange schließt', async () => {
  const closes = [];
  const fakeDb = { onversionchange: null, close: () => closes.push('close') };
  let req;
  globalThis.indexedDB = {
    open() { req = makeFakeRequest(fakeDb); return req; },
  };

  let blockedCalls = 0, unblockedCalls = 0, versionChangeCalls = 0;
  db.setBlockedHandler(() => { blockedCalls++; });
  db.setUnblockedHandler(() => { unblockedCalls++; });
  db.setVersionChangeHandler(() => { versionChangeCalls++; });

  const openPromise = db.open();
  // Zwischenstand: db.open() darf trotz onblocked nicht ablehnen und muss weiter warten.
  req.onblocked();
  assert.equal(blockedCalls, 1, 'onblocked-Rückruf wurde aufgerufen');
  assert.equal(unblockedCalls, 0, 'onUnblocked noch nicht aufgerufen, solange onsuccess nicht feuerte');

  let settled = false;
  openPromise.then(() => { settled = true; });
  await Promise.resolve();
  assert.equal(settled, false, 'Promise ist nach onblocked allein noch PENDING, nicht abgelehnt');

  req.onsuccess();
  const resolved = await openPromise;
  assert.equal(resolved, fakeDb, 'löst nach onsuccess mit der DB-Verbindung auf');
  assert.equal(unblockedCalls, 1, 'onUnblocked-Rückruf wurde nach onsuccess aufgerufen');

  fakeDb.onversionchange();
  assert.equal(versionChangeCalls, 1, 'onVersionChange-Rückruf wurde aufgerufen');
  assert.deepEqual(closes, ['close'], 'db.close() wird bei onversionchange aufgerufen');
});
