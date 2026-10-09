import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

// sw.js ist ein klassisches Service-Worker-Skript (kein Modul) – für den Test in einem eigenen
// Kontext mit einem Minimal-`self` ausführen und die Strategie-Funktion daraus holen.
function loadSw() {
  const ctx = { self: { addEventListener() {}, location: { origin: 'https://x.test' } }, URL, Request, Response, setTimeout, clearTimeout, Promise };
  vm.runInNewContext(readFileSync(new URL('../sw.js', import.meta.url), 'utf8'), ctx);
  return ctx;
}
function fakeCache(entries = {}) {
  const store = new Map(Object.entries(entries));
  return {
    store,
    async match(req) { return store.get(typeof req === 'string' ? req : req.url); },
    async put(req, res) { store.set(typeof req === 'string' ? req : req.url, res); },
  };
}
const req = new Request('https://x.test/js/app.js');
const body = async r => (r ? await r.text() : null);

test('Netz zuerst: frische Antwort gewinnt und landet im Cache', async () => {
  const { networkFirst } = loadSw();
  const cache = fakeCache({ [req.url]: new Response('alt') });
  const res = await networkFirst(req, cache, async () => new Response('neu'), 1000);
  assert.equal(await body(res), 'neu');
  assert.equal(await body(await cache.match(req)), 'neu');
});

test('Netz zuerst: am HTTP-Cache des Browsers vorbei (cache: no-cache)', async () => {
  const { networkFirst } = loadSw();
  let seen;
  await networkFirst(req, fakeCache(), async r => { seen = r; return new Response('neu'); }, 1000);
  assert.equal(seen.cache, 'no-cache');
  assert.equal(seen.url, req.url);
});

test('Offline: Kopie aus dem Cache', async () => {
  const { networkFirst } = loadSw();
  const cache = fakeCache({ [req.url]: new Response('alt') });
  const res = await networkFirst(req, cache, async () => { throw new TypeError('offline'); }, 1000);
  assert.equal(await body(res), 'alt');
});

test('Server antwortet zu langsam: nach der Zeitgrenze die Kopie aus dem Cache', async () => {
  const { networkFirst } = loadSw();
  const cache = fakeCache({ [req.url]: new Response('alt') });
  const slow = () => new Promise(r => setTimeout(() => r(new Response('neu')), 200));
  const res = await networkFirst(req, cache, slow, 20);
  assert.equal(await body(res), 'alt');
});

test('Zu langsam, aber keine Kopie im Cache: auf das Netz warten', async () => {
  const { networkFirst } = loadSw();
  const slow = () => new Promise(r => setTimeout(() => r(new Response('neu')), 50));
  const res = await networkFirst(req, fakeCache(), slow, 10);
  assert.equal(await body(res), 'neu');
});

test('Serverfehler (z. B. 404) mit Kopie im Cache: Kopie, Cache bleibt unverändert', async () => {
  const { networkFirst } = loadSw();
  const cache = fakeCache({ [req.url]: new Response('alt') });
  const res = await networkFirst(req, cache, async () => new Response('weg', { status: 404 }), 1000);
  assert.equal(await body(res), 'alt');
});
