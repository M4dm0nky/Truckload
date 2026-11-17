import test, { afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { hatProjektGeraete, ladeProjektGeraete } from '../js/store/projektGeraete.js';

const orig = globalThis.truckloadHost;
afterEach(() => {
  if (orig === undefined) delete globalThis.truckloadHost; else globalThis.truckloadHost = orig;
});
const mitHost = fn => { globalThis.truckloadHost = { projektGeraete: fn }; };

const gueltig = {
  key: 'gdtf:abc', name: 'Spot 700', anzahl: 4, hersteller: 'Acme', gewerk: 'Licht',
  vwNamen: ['Spot 700 Mode 1'], gewichtKg: 32.5,
};

test('ohne Host-Funktion: hatProjektGeraete false', () => {
  delete globalThis.truckloadHost;
  assert.equal(hatProjektGeraete(), false);
  globalThis.truckloadHost = {};
  assert.equal(hatProjektGeraete(), false);
  mitHost(async () => []);
  assert.equal(hatProjektGeraete(), true);
});

test('gültige Liste wird übernommen', async () => {
  mitHost(async () => [gueltig, { key: 'vw:Sub', name: 'Sub', anzahl: 0, vwNamen: [] }]);
  const l = await ladeProjektGeraete();
  assert.deepEqual(l[0], gueltig);
  assert.equal(l.length, 2);
  assert.equal(l[1].anzahl, 0);
});

test('leere Liste', async () => {
  mitHost(async () => []);
  assert.deepEqual(await ladeProjektGeraete(), []);
});

test('fehlende vwNamen werden []; ungültige optionale Felder entfallen', async () => {
  mitHost(async () => [{ key: 'vw:x', name: 'X', anzahl: 1, hersteller: 5, gewerk: '', gewichtKg: -1 }]);
  assert.deepEqual(await ladeProjektGeraete(), [{ key: 'vw:x', name: 'X', anzahl: 1, vwNamen: [] }]);
});

test('ungültige Einträge werden verworfen', async () => {
  mitHost(async () => [
    { key: 'vw:a', name: 'A', anzahl: -1, vwNamen: [] },
    { key: 'vw:b', name: 'B', anzahl: '3', vwNamen: [] },
    { key: 'vw:c', name: 'C', anzahl: 1.5, vwNamen: [] },
    { key: 'xx:d', name: 'D', anzahl: 1, vwNamen: [] },
    { key: 'vw:e', name: '', anzahl: 1, vwNamen: [] },
    { name: 'F', anzahl: 1, vwNamen: [] },
    null,
    { key: 'vw:ok', name: 'OK', anzahl: 2, vwNamen: [] },
  ]);
  const l = await ladeProjektGeraete();
  assert.deepEqual(l.map(g => g.key), ['vw:ok']);
});

test('doppelter key wird zusammengeführt', async () => {
  mitHost(async () => [
    { key: 'gdtf:1', name: 'Erst', hersteller: 'H', anzahl: 2, vwNamen: ['a', 'b'], gewichtKg: 5 },
    { key: 'gdtf:1', name: 'Zweit', anzahl: 3, vwNamen: ['b', 'c'], gewichtKg: 5 },
    { key: 'vw:2', name: 'Z', anzahl: 1, vwNamen: [], gewichtKg: 1 },
    { key: 'vw:2', name: 'Z', anzahl: 1, vwNamen: [], gewichtKg: 2 },
  ]);
  const l = await ladeProjektGeraete();
  assert.equal(l.length, 2);
  assert.deepEqual(l[0], { key: 'gdtf:1', name: 'Erst', hersteller: 'H', anzahl: 5, vwNamen: ['a', 'b', 'c'], gewichtKg: 5 });
  assert.equal(l[1].anzahl, 2);
  assert.equal('gewichtKg' in l[1], false);
});

test('Host-Ablehnung wird als Error mit derselben Meldung weitergereicht', async () => {
  const msg = 'Das Projekt wurde gewechselt – Truckload lädt neu.';
  mitHost(async () => { throw new Error(msg); });
  await assert.rejects(ladeProjektGeraete(), err => err instanceof Error && err.message === msg);
  mitHost(() => { throw new Error(msg); });
  await assert.rejects(ladeProjektGeraete(), err => err.message === msg);
});

test('Nicht-Liste ist ein Fehler', async () => {
  for (const wert of [undefined, null, {}]) {
    mitHost(async () => wert);
    await assert.rejects(ladeProjektGeraete(), err => err instanceof Error && err.message.length > 0);
  }
});
