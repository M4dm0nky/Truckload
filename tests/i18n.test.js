// Sperr-Tests der Mehrsprachigkeit (#42): messen den Fortschritt, statt ihn zu glauben.
// Eine Datei verlässt PENDING, sobald sie ihre Texte über t() führt; danach sperrt Test C sie.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import EN from '../js/i18n/en.js';
import { literals, tCalls, looksGerman, shadowsT } from './i18n-scan.js';

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
      else if (c.ident && Object.hasOwn(DYNAMIC_KEYS, c.ident)) used.push({ key: DYNAMIC_KEYS[c.ident], text: DYNAMIC_KEYS[c.ident], where: `${f}:${c.line}` });
    }
  }
  for (const text of dataTTexts()) used.push({ key: text, text, where: 'index.html' });
  return used;
}

test('A: jeder t()-Schlüssel hat einen englischen Eintrag mit denselben Platzhaltern', () => {
  const fehler = [];
  for (const u of usedKeys()) {
    if (!Object.hasOwn(EN, u.key)) { fehler.push(`${u.where}: kein englischer Eintrag für „${u.key}“`); continue; }
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
  const note = NOTE_RE.exec(read('js/data/preset-trucks.js'));
  assert.ok(note, 'NOTE nicht gefunden: js/data/preset-trucks.js braucht `const NOTE = \'…\';` (Test B liest sie dort)');
  benutzt.add(note[2]);
  assert.deepEqual(Object.keys(EN).filter(k => !benutzt.has(k)), []);
});

// Englische Schlüssel samt Textteil von „ctx|text“: ein solches Literal außerhalb von t() ist ein Fund.
const enTexte = () => new Set(Object.keys(EN).flatMap(k => (k.includes('|') ? [k, k.slice(k.indexOf('|') + 1)] : [k])));

test('C: kein deutscher Text außerhalb von t()', () => {
  const fehler = [];
  const bekannt = enTexte();
  // HTML wird erst gescannt, wenn die Seite umgestellt ist (Task 3): bis dahin muss index.html in PENDING stehen.
  for (const f of ['index.html'].filter(f => !PENDING.includes(f))) fehler.push(`${f}: nicht mehr in PENDING, aber es gibt noch keinen HTML-Scan in Test C`);
  // en.js ist die Übersetzungstabelle: ihre Schlüssel sind absichtlich deutsch
  for (const f of jsFiles.filter(f => !PENDING.includes(f) && f !== 'js/i18n/en.js')) {
    const src = read(f);
    for (const l of literals(src)) {
      if (l.inT || ALLOW.some(a => a.file === f && a.text === l.text)) continue;
      if (looksGerman(l.text)) fehler.push(`${f}:${l.line}: deutsches Literal außerhalb von t(): ${JSON.stringify(l.text)}`);
      else if (bekannt.has(l.text)) fehler.push(`${f}:${l.line}: Literal entspricht einem en.js-Schlüssel, steht aber außerhalb von t(): ${JSON.stringify(l.text)}`);
    }
    if (f !== 'js/i18n/i18n.js') {
      for (const c of tCalls(src)) {
        if (c.key === null && !(c.ident && Object.hasOwn(DYNAMIC_KEYS, c.ident))) fehler.push(`${f}:${c.line}: t() mit nicht-literalem Schlüssel`);
      }
      for (const h of shadowsT(src)) fehler.push(`${f}:${h.line}: lokale Bindung „t“ verdeckt den Import aus i18n.js, bitte umbenennen`);
    }
  }
  assert.deepEqual(fehler, []);
});

test('D: looksGerman trifft Deutsch und schweigt auf Englisch', () => {
  for (const s of ['Alles neu packen', '„X“ ragt über den Laderaum hinaus.', 'Löschen', 'Duplizieren', 'Meine Sammlung',
    'Ladeplan', 'Bearbeiten', 'Umbenennen', 'Seitenansicht']) assert.equal(looksGerman(s), true, s);
  for (const s of ['Repack all', 'Load space', 'kg', '#e8b10c', 'standing', 'lautsprecher', 'Duplicate', 'Rename', 'Edit',
    'Side view', 'Load plan', 'My collection']) assert.equal(looksGerman(s), false, s);
});

test('D2: shadowsT erkennt lokale Bindungen namens t', () => {
  for (const s of ['const t = 1;', 'let t;', 'xs.map(t => t.x);', 'xs.map((a, t) => a);', 'function f(a, t) {}', 'const { t } = obj;',
    'const { a: t } = obj;', 'const [t] = arr;', 'try {} catch (t) {}', 'for (const t of xs) {}']) {
    assert.equal(shadowsT(s).length > 0, true, s);
  }
  for (const s of ['import { t, num } from \'./i18n.js\';', 'const x = t(\'Hallo\');', 'const test = 1;', 'obj.t = 1;', 'xs.map(x => t(\'y\'));',
    'const { a } = t(\'x\');', 'const o = { t: 1 };', 'f(a, t);']) {
    assert.equal(shadowsT(s).length, 0, s);
  }
});

test('E: PENDING enthält nur existierende Dateien', () => {
  assert.deepEqual(PENDING.filter(f => !fs.existsSync(path.join(ROOT, f))), []);
});
