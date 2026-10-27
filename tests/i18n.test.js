// Sperr-Tests der Mehrsprachigkeit (#42): messen den Fortschritt, statt ihn zu glauben.
// Eine Datei verlässt PENDING, sobald sie ihre Texte über t() führt; danach sperrt Test C sie.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import EN from '../js/i18n/en.js';
import { literals, tCalls, looksGerman, shadowsT, htmlScan, dataTTexts } from './i18n-scan.js';
import { translateDom } from '../js/i18n/dom.js';
import { setLang } from '../js/i18n/i18n.js';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const rel = f => path.relative(ROOT, f).split(path.sep).join('/');
const read = f => fs.readFileSync(path.join(ROOT, f), 'utf8');
const walk = d => fs.readdirSync(path.join(ROOT, d), { withFileTypes: true })
  .flatMap(e => (e.isDirectory() ? walk(`${d}/${e.name}`) : e.name.endsWith('.js') ? [`${d}/${e.name}`] : []));

// Noch nicht umgestellte Dateien. Spätere Tasks streichen ihre Dateien hier.
export const PENDING = [
  'js/app.js',
  ...['js/app', 'js/ui', 'js/data'].flatMap(walk),
];

// Ausnahmen für Test C: deutsche Literale, die bewusst deutsch bleiben (Daten, keine Anzeige).
export const ALLOW = [
  ...[
    'Dieser Browser ist zu alt für Truckload. Gebraucht werden Chrome oder Edge ab 123, Safari ab 17.2 oder Firefox ab 138.',
    'Die App konnte nicht vollständig geladen werden. Bitte neu laden. ', 'Neu laden',
  ].map(text => ({ file: 'index.html', text, why: 'Inline-Notfallmeldung, englisch daneben im selben Objekt (tlTexte); Test H prüft das' })),
  { file: 'js/model/collections.js', text: 'Meine Sammlung', why: 'gespeicherter Wert: Name der festen Sammlung (MEINE_NAME), englisch nur zum Abgleich (MEINE_NAME_EN)' },
  { file: 'js/model/lkw-distribute.js', text: 'Sonstiges', why: 'gespeicherter Wert: Gewerk ohne Angabe (Daten bleiben deutsch)' },
  ...['Bereinigte Datensätze konnten nicht zurückgeschrieben werden:', 'Migration nach „Sammlungen“ nicht gespeichert:']
    .map(text => ({ file: 'js/store/repo.js', text, why: 'Konsole' })),
  { file: 'js/store/repo.js', text: 'saveImportWinners: Sammlungsliste fehlt.', why: 'Entwicklerfehler (Aufrufvertrag), nie für Nutzer bestimmt' },
  { file: 'js/i18n/i18n.js', text: 'Bühne', why: 'Schlüssel der Gewerk-Tabelle: gespeicherte Daten bleiben deutsch' },
];

// Bezeichner, die als t(<Bezeichner>) mit nicht-literalem Schlüssel aufgerufen werden dürfen.
// Wert = der deutsche Text, der dahinter steckt (braucht einen en.js-Eintrag, sobald er benutzt wird).
const DYNAMIC_KEYS = { MEINE_NAME: 'Meine Sammlung' };

const jsFiles = walk('js');
const NOTE_RE = /const NOTE = (['"`])(.*?)\1;/;

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
  for (const text of dataTTexts(read('index.html'))) used.push({ key: text, text, where: 'index.html' });
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
  // MEINE_NAME_EN (js/model/collections.js) liest den Eintrag direkt aus en.js, nicht über t()
  benutzt.add(DYNAMIC_KEYS.MEINE_NAME);
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
  // index.html: sichtbare Textknoten und title/aria-label/placeholder/alt außerhalb von <script>/<style>
  // müssen ihr data-t-Zeichen tragen, sobald sie deutsch wirken
  if (!PENDING.includes('index.html')) {
    const h = htmlScan(read('index.html'));
    for (const x of h.texte) if (!x.marked && looksGerman(x.text)) fehler.push(`index.html:${x.line}: deutscher Text ohne data-t: ${JSON.stringify(x.text)}`);
    for (const x of h.attribute) if (!x.marked && looksGerman(x.text)) fehler.push(`index.html:${x.line}: deutsches ${x.attr} ohne data-t-${x.attr}: ${JSON.stringify(x.text)}`);
    // Inline-Skripte laufen vor den Modulen: deutsche Literale nur mit ALLOW-Eintrag (englisches Gegenstück, Test H)
    for (const m of read('index.html').matchAll(/<script>([\s\S]*?)<\/script>/g)) {
      for (const l of literals(m[1])) {
        if (looksGerman(l.text) && !ALLOW.some(a => a.file === 'index.html' && a.text === l.text)) fehler.push(`index.html: deutsches Literal im Inline-Skript: ${JSON.stringify(l.text)}`);
      }
    }
    for (const x of h.gemischt) fehler.push(`index.html:${x.line}: data-t-Element <${x.text}> enthält Kindelemente (Text in eigenes <span data-t> auslagern)`);
  }
  // en.js ist die Übersetzungstabelle: ihre Schlüssel sind absichtlich deutsch
  for (const f of jsFiles.filter(f => !PENDING.includes(f) && f !== 'js/i18n/en.js')) {
    const src = read(f);
    for (const l of literals(src)) {
      if (l.inT || ALLOW.some(a => a.file === f && a.text === l.text)) continue;
      if (looksGerman(l.text)) fehler.push(`${f}:${l.line}: deutsches Literal außerhalb von t(): ${JSON.stringify(l.text)}`);
      else if (bekannt.has(l.text)) fehler.push(`${f}:${l.line}: Literal entspricht einem en.js-Schlüssel, steht aber außerhalb von t(): ${JSON.stringify(l.text)}`);
    }
    // i18n.js und dom.js sind der Übersetzungsmechanismus selbst: dort ist t(<Variable>) gewollt
    if (f !== 'js/i18n/i18n.js' && f !== 'js/i18n/dom.js') {
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

test('F: der HTML-Scan findet unmarkierte Texte und liest die Marker', () => {
  const h = htmlScan('<title>Truckload</title><script>var x = "Löschen";</script><button title="Hinweis schließen" data-t-title>×</button>'
    + '<p>Lösche   alles</p><span data-t>Alles\n neu</span><b aria-label="Schließen">x</b><i data-t><u>Kind</u></i>');
  assert.deepEqual(h.texte.filter(x => !x.marked && looksGerman(x.text)).map(x => x.text), ['Lösche alles']);
  assert.deepEqual(h.attribute.filter(x => !x.marked && looksGerman(x.text)).map(x => x.text), ['Schließen']);
  assert.deepEqual(h.markiert.map(x => x.text).sort(), ['Alles neu', 'Hinweis schließen', 'Kind']);
  assert.deepEqual(h.gemischt.map(x => x.text), ['i']);
  for (const s of ['Truckload', 'V 0.20.0', '×', '↶', '↷', '−', '+', '2D', '3D']) assert.equal(looksGerman(s), false, s);
});

// Minimales DOM-Double: nur die API, die translateDom benutzt.
function el(attrs, textContent = '') {
  const a = { ...attrs };
  return { textContent, getAttribute: n => (n in a ? a[n] : null), setAttribute: (n, v) => { a[n] = v; } };
}

test('G: translateDom setzt lang, übersetzt nur auf Englisch und lässt Deutsch unverändert', () => {
  EN['Neu laden'] = 'Reload';
  EN['Hinweis schließen'] = 'Dismiss';
  const mk = () => ({
    btn: el({ 'data-t': '' }, '\n   Neu  laden '),
    x: el({ 'data-t-aria-label': '', 'aria-label': 'Hinweis schließen', title: 'Bleibt' }, '×'),
    fremd: el({ 'data-t': '' }, 'Ohne Eintrag'),
  });
  const root = els => ({ querySelectorAll: () => Object.values(els) });
  globalThis.document = { documentElement: { lang: 'de' } };
  try {
    const de = mk();
    setLang('de'); translateDom(root(de));
    assert.equal(document.documentElement.lang, 'de');
    assert.equal(de.btn.textContent, '\n   Neu  laden ');
    assert.equal(de.x.getAttribute('aria-label'), 'Hinweis schließen');
    const en = mk();
    setLang('en'); translateDom(root(en));
    assert.equal(document.documentElement.lang, 'en');
    assert.equal(en.btn.textContent, 'Reload');
    assert.equal(en.x.getAttribute('aria-label'), 'Dismiss');
    assert.equal(en.x.getAttribute('title'), 'Bleibt');
    assert.equal(en.x.textContent, '×');
    assert.equal(en.fremd.textContent, 'Ohne Eintrag');
  } finally {
    setLang('de'); delete globalThis.document;
    delete EN['Neu laden']; delete EN['Hinweis schließen'];
  }
});

test('H: Inline-Notfallmeldung liefert mit ?lang=en englische Texte, ohne Parameter die deutschen', () => {
  const src = read('index.html').match(/<script>([\s\S]*?)<\/script>/)[1];
  const lauf = search => {
    const win = { addEventListener() {}, location: { search } };
    new Function('window', 'document', src)(win, {});
    return [win.tlLadefehlerText(new SyntaxError('Unexpected token')), win.tlLadefehlerText(null)];
  };
  const en = lauf('?lang=en');
  assert.deepEqual(en.map(r => r.neuLaden), [false, true]);
  for (const r of en) assert.equal(looksGerman(r.text), false, r.text);
  assert.match(en[0].text, /too old/);
  assert.match(en[1].text, /reload/i);
  for (const search of ['', '?lang=de', '?lang=fr']) {
    const de = lauf(search);
    assert.match(de[0].text, /^Dieser Browser ist zu alt/);
    assert.match(de[1].text, /^Die App konnte nicht vollständig geladen werden\. Bitte neu laden\. $/);
  }
});

test('E: PENDING enthält nur existierende Dateien', () => {
  assert.deepEqual(PENDING.filter(f => !fs.existsSync(path.join(ROOT, f))), []);
});
