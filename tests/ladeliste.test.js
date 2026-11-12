import { test } from 'node:test';
import assert from 'node:assert/strict';
import { REITER, SPALTEN, erkenneReiter } from '../js/model/ladeliste.js';

const kopf = (reiter, sprache = 'de') => SPALTEN[reiter].map(s => s[sprache]);

test('SPALTEN: vier Reiter, Schlüssel eindeutig, Pflichtspalten wie spezifiziert', () => {
  assert.deepEqual(REITER, ['cases', 'traversen', 'boxen', 'set']);
  for (const r of REITER) {
    const keys = SPALTEN[r].map(s => s.key);
    assert.equal(new Set(keys).size, keys.length, r);
  }
  const pflicht = r => SPALTEN[r].filter(s => s.pflicht).map(s => s.key);
  assert.deepEqual(pflicht('cases'), ['name', 'breite', 'tiefe', 'hoehe']);
  assert.deepEqual(pflicht('set'), ['name', 'breite', 'tiefe', 'hoehe']);
  assert.equal(SPALTEN.cases.find(s => s.key === 'hoehe').de, 'Höhe inkl. Rollen (cm)');
  assert.equal(SPALTEN.set.find(s => s.key === 'hoehe').de, 'Höhe (cm)');
  assert.equal(SPALTEN.set.some(s => s.key === 'rollen' || s.key === 'tippen'), false);
});

test('deutsche und englische Kopfzeile je Reiter', () => {
  for (const r of REITER) for (const sprache of ['de', 'en']) {
    const k = erkenneReiter([kopf(r, sprache), ['x']]);
    assert.equal(k.reiter, r, `${r}/${sprache}`);
    assert.equal(k.kopfzeile, 0);
    assert.equal(Object.keys(k.spalten).length, SPALTEN[r].length);
    assert.equal(k.spalten[SPALTEN[r][0].key], 0);
  }
});

test('Groß/Klein, Leerzeichen und Mehrfach-Leerzeichen werden ignoriert', () => {
  const k = erkenneReiter([['Name', 'Breite (cm)', 'Tiefe (cm)', '  höhe INKL.   rollen (cm) ']]);
  assert.equal(k.reiter, 'cases');
  assert.equal(k.spalten.hoehe, 3);
});

test('vertauschte Spaltenreihenfolge und unbekannte Spalten', () => {
  const k = erkenneReiter([['Foo', 'Höhe inkl. Rollen (cm)', 'Tiefe (cm)', 'Bar', 'Breite (cm)', 'Name']]);
  assert.equal(k.reiter, 'cases');
  assert.deepEqual(k.spalten, { hoehe: 1, tiefe: 2, breite: 4, name: 5 });
});

test('Kopfzeile in Zeile 3 hinter Hinweiszeilen', () => {
  const k = erkenneReiter([['Ladeliste Tour 2027'], [], ['Bitte ausfüllen', 'Danke'], kopf('set'), ['a']]);
  assert.equal(k.reiter, 'set');
  assert.equal(k.kopfzeile, 3);
});

test('Set: „Höhe (cm)“ ohne Rollen; Cases: Höhe-Text bzw. Rollen-Spalte entscheidet', () => {
  assert.equal(erkenneReiter([['Name', 'Breite (cm)', 'Tiefe (cm)', 'Höhe (cm)']]).reiter, 'set');
  assert.equal(erkenneReiter([['Name', 'Breite (cm)', 'Tiefe (cm)', 'Höhe (cm)', 'Rollen (ja/nein)']]).reiter, 'cases');
});

test('keine Pflichtspalten oder leere Tabelle: reiter null', () => {
  assert.equal(erkenneReiter([['Name', 'Menge'], ['a', '1']]).reiter, null);
  const leer = erkenneReiter([]);
  assert.equal(leer.reiter, null);
  assert.equal(leer.kopfzeile, 0);
  assert.equal(erkenneReiter([[], ['Foo']]).kopfzeile, 1);
});

test('Kopfzeile nur in den ersten 5 Zeilen', () => {
  const rows = [[], [], [], [], [], kopf('cases')];
  assert.equal(erkenneReiter(rows).reiter, null);
});
