import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { REITER, SPALTEN, HINWEIS, erkenneReiter } from '../js/model/ladeliste.js';
import { readXlsx } from '../js/store/tabelle-lesen.js';

const DATEIEN = { de: 'data/Truckload-Ladeliste.xlsx', en: 'data/Truckload-Loadlist.xlsx' };
const lies = async f => {
  const b = readFileSync(new URL(`../${f}`, import.meta.url));
  return readXlsx(b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength));
};

for (const [sprache, datei] of Object.entries(DATEIEN)) {
  test(`Vorlage ${sprache}: vier Reiter, Hinweis in Zeile 1, Kopfzeile = SPALTEN`, async () => {
    const blaetter = await lies(datei);
    assert.equal(blaetter.length, REITER.length);
    blaetter.forEach((blatt, i) => {
      const reiter = REITER[i];
      const e = erkenneReiter(blatt.rows);
      assert.equal(e.reiter, reiter, blatt.name);
      assert.equal(e.kopfzeile, 1, blatt.name);
      assert.equal(blatt.rows[0][0], HINWEIS[sprache], blatt.name);
      const kopf = blatt.rows[1].slice(0, SPALTEN[reiter].length);
      assert.deepEqual(kopf, SPALTEN[reiter].map(s => s[sprache]), blatt.name);
    });
  });
}

test('Vorlagen stehen in ASSETS (sw.js)', () => {
  const sw = readFileSync(new URL('../sw.js', import.meta.url), 'utf8');
  for (const f of Object.values(DATEIEN)) assert.ok(sw.includes(`'${f}'`), f);
});
