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

// 1.5: Eine abgelehnte open()-Promise darf nicht für die ganze Sitzung kleben bleiben. Frische
// Modulinstanz (Query-String), weil der Test oben dbPromise schon aufgelöst im Cache hat.
test('open(): nach einem Fehler wird beim nächsten Zugriff neu versucht', async () => {
  const fresh = await import('../js/store/db.js?retry');
  const fakeDb = { onversionchange: null, close() {} };
  const reqs = [];
  globalThis.indexedDB = { open() { const r = makeFakeRequest(fakeDb); reqs.push(r); return r; } };

  const first = fresh.open();
  reqs[0].error = new Error('Speicher gesperrt');
  reqs[0].onerror();
  await assert.rejects(first, /Speicher gesperrt/);

  const second = fresh.open();
  assert.equal(reqs.length, 2, 'indexedDB.open wurde erneut aufgerufen');
  reqs[1].onsuccess();
  assert.equal(await second, fakeDb);
  assert.equal(fresh.open(), second, 'ein Erfolg bleibt zwischengespeichert');
  assert.equal(reqs.length, 2);
});

test('open(): während onblocked-Wartezeit wird NICHT neu geöffnet', async () => {
  const fresh = await import('../js/store/db.js?blocked');
  const fakeDb = { onversionchange: null, close() {} };
  const reqs = [];
  globalThis.indexedDB = { open() { const r = makeFakeRequest(fakeDb); reqs.push(r); return r; } };
  const p1 = fresh.open();
  reqs[0].onblocked();
  const p2 = fresh.open();
  assert.equal(p1, p2);
  assert.equal(reqs.length, 1);
  reqs[0].onsuccess();
  await p1;
});
