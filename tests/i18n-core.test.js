import { test, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { t, num, trade, builtinNote, setLang } from '../js/i18n/i18n.js';
import EN from '../js/i18n/en.js';

afterEach(() => {
  setLang('de');
  delete EN['Hallo {name}'];
  delete EN['Stapel|Lage'];
  delete EN['X'];
});

test('t: Deutsch gibt den Text unverändert zurück, ersetzt Platzhalter ohne Escaping', () => {
  assert.equal(t('Hallo {name}', { name: '<b>' }), 'Hallo <b>');
});

test('t: Englisch nutzt die Tabelle, fehlender Eintrag fällt auf Deutsch zurück', () => {
  setLang('en');
  assert.equal(t('Hallo {name}', { name: '<b>' }), 'Hallo <b>');
  EN['Hallo {name}'] = 'Hello {name}';
  assert.equal(t('Hallo {name}', { name: '<b>' }), 'Hello <b>');
  assert.equal(t('Unbekannt {x}', { y: 1 }), 'Unbekannt {x}');
});

test('t: Kontext sucht „ctx|text“, nur auf Englisch', () => {
  EN['Stapel|Lage'] = 'Layer';
  assert.equal(t('Lage', null, 'Stapel'), 'Lage');
  setLang('en');
  assert.equal(t('Lage', null, 'Stapel'), 'Layer');
  assert.equal(t('Lage'), 'Lage');
});

test('num: Locale je Sprache', () => {
  assert.equal(num(1234.5, { maximumFractionDigits: 1, useGrouping: false }), '1234,5');
  assert.equal(num(12000), '12.000');
  setLang('en');
  assert.equal(num(1234.5, { maximumFractionDigits: 1, useGrouping: false }), '1234.5');
  assert.equal(num(12000), '12,000');
});

test('trade: Englisch übersetzt bekannte Gewerke, Unbekanntes bleibt', () => {
  assert.equal(trade('Bühne'), 'Bühne');
  setLang('en');
  assert.equal(trade('Bühne'), 'Staging');
  assert.equal(trade('Strom'), 'Power');
  assert.equal(trade('Eigenes'), 'Eigenes');
});

test('builtinNote: nur eingebaute Notizen werden übersetzt', () => {
  EN['X'] = 'Y';
  setLang('en');
  assert.equal(builtinNote({ builtin: true, note: 'X' }), 'Y');
  assert.equal(builtinNote({ note: 'X' }), 'X');
  assert.equal(builtinNote({}), '');
});

test('Prototyp-Namen aus Importdaten werden nicht als Übersetzung gefunden', () => {
  setLang('en');
  try {
    assert.equal(trade('constructor'), 'constructor');
    assert.equal(t('toString'), 'toString');
    assert.equal(t('{constructor} x', {}), '{constructor} x');
  } finally { setLang('de'); }
});
