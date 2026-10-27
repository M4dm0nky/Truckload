// Sperr-Tests der Mehrsprachigkeit (#42): messen den Fortschritt, statt ihn zu glauben.
// Eine Datei verlässt PENDING, sobald sie ihre Texte über t() führt; danach sperrt Test C sie.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import EN from '../js/i18n/en.js';
import { literals, tCalls, looksGerman } from './i18n-scan.js';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const rel = f => path.relative(ROOT, f).split(path.sep).join('/');
const read = f => fs.readFileSync(path.join(ROOT, f), 'utf8');
const walk = d => fs.readdirSync(path.join(ROOT, d), { withFileTypes: true })
  .flatMap(e => (e.isDirectory() ? walk(`${d}/${e.name}`) : e.name.endsWith('.js') ? [`${d}/${e.name}`] : []));

// Noch nicht umgestellte Dateien. Spätere Tasks streichen ihre Dateien hier.
export const PENDING = [
  'index.html', 'js/app.js',
  ...['js/app', 'js/ui', 'js/model', 'js/store', 'js/data'].flatMap(walk),
];

// Ausnahmen für Test C: deutsche Literale, die bewusst deutsch bleiben (Daten, keine Anzeige).
export const ALLOW = [
  { file: 'js/i18n/i18n.js', text: 'Bühne', why: 'Schlüssel der Gewerk-Tabelle: gespeicherte Daten bleiben deutsch' },
];

// Bezeichner, die als t(<Bezeichner>) mit nicht-literalem Schlüssel aufgerufen werden dürfen.
// Wert = der deutsche Text, der dahinter steckt (braucht einen en.js-Eintrag, sobald er benutzt wird).
const DYNAMIC_KEYS = { MEINE_NAME: 'Meine Sammlung' };

const jsFiles = walk('js');
const NOTE_RE = /const NOTE = (['"`])(.*?)\1;/;

// data-t*-Texte aus index.html (data-t, data-t-title, …); Entitäten zurückwandeln.
function dataTTexts() {
  const html = read('index.html');
  return [...html.matchAll(/data-t[\w-]*="([^"]*)"/g)].map(m => m[1]
    .replace(/&quot;/g, '"').replace(/&#39;/g, '\'').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&'));
}

const placeholders = s => [...s.matchAll(/\{(\w+)\}/g)].map(m => m[1]).sort().join(',');
const fullKey = c => (c.ctx ? `${c.ctx}|${c.key}` : c.key);

// Alle Schlüssel, die der Code tatsächlich benutzt: [{ key, where }]
function usedKeys() {
  const used = [];
  for (const f of jsFiles) {
    for (const c of tCalls(read(f))) {
      if (c.key !== null) used.push({ key: fullKey(c), text: c.key, where: `${f}:${c.line}` });
      else if (c.ident && c.ident in DYNAMIC_KEYS) used.push({ key: DYNAMIC_KEYS[c.ident], text: DYNAMIC_KEYS[c.ident], where: `${f}:${c.line}` });
    }
  }
  for (const text of dataTTexts()) used.push({ key: text, text, where: 'index.html' });
  return used;
}

test('A: jeder t()-Schlüssel hat einen englischen Eintrag mit denselben Platzhaltern', () => {
  const fehler = [];
  for (const u of usedKeys()) {
    if (!(u.key in EN)) { fehler.push(`${u.where}: kein englischer Eintrag für „${u.key}“`); continue; }
    // Kontextschlüssel „ctx|text“: Platzhalter nur am Textteil vergleichen
    if (placeholders(u.text) !== placeholders(EN[u.key])) fehler.push(`${u.where}: Platzhalter von „${u.key}“ weichen ab`);
  }
  assert.deepEqual(fehler, []);
});

test('B: kein verwaister Eintrag in en.js', () => {
  const benutzt = new Set(usedKeys().map(u => u.key));
  // eingebaute Notizen laufen über builtinNote(): die Texte stehen in den Daten
  for (const f of ['data/standard.json', 'data/meine.json']) {
    for (const c of JSON.parse(read(f)).cases) if (c.note) benutzt.add(c.note);
  }
  benutzt.add(NOTE_RE.exec(read('js/data/preset-trucks.js'))[2]);
  assert.deepEqual(Object.keys(EN).filter(k => !benutzt.has(k)), []);
});

test('C: kein deutscher Text außerhalb von t()', () => {
  const fehler = [];
  // en.js ist die Übersetzungstabelle: ihre Schlüssel sind absichtlich deutsch
  for (const f of jsFiles.filter(f => !PENDING.includes(f) && f !== 'js/i18n/en.js')) {
    const src = read(f);
    for (const l of literals(src)) {
      if (!l.inT && looksGerman(l.text) && !ALLOW.some(a => a.file === f && a.text === l.text)) {
        fehler.push(`${f}:${l.line}: deutsches Literal außerhalb von t(): ${JSON.stringify(l.text)}`);
      }
    }
    if (f !== 'js/i18n/i18n.js') {
      for (const c of tCalls(src)) {
        if (c.key === null && !(c.ident && c.ident in DYNAMIC_KEYS)) fehler.push(`${f}:${c.line}: t() mit nicht-literalem Schlüssel`);
      }
    }
  }
  assert.deepEqual(fehler, []);
});

test('D: looksGerman trifft Deutsch und schweigt auf Englisch', () => {
  for (const s of ['Alles neu packen', '„X“ ragt über den Laderaum hinaus.', 'Löschen']) assert.equal(looksGerman(s), true, s);
  for (const s of ['Repack all', 'Load space', 'kg', '#e8b10c', 'standing']) assert.equal(looksGerman(s), false, s);
});

test('E: PENDING enthält nur existierende Dateien', () => {
  assert.deepEqual(PENDING.filter(f => !fs.existsSync(path.join(ROOT, f))), []);
});
