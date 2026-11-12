import { test } from 'node:test';
import { readFileSync } from 'node:fs';
import assert from 'node:assert/strict';
import { SPALTEN, erkenneReiter, werteZeilen, pruefeEintrag } from '../js/model/ladeliste.js';
import { stockTargetHtml, readStockTarget } from '../js/ui/stock-target.js';
import { zusammenfassung, auffaelligkeiten, uebersichtHtml, listeHtml, zeilenStatus, hilfeHtml, vorlageDatei, entwuerfeAus, filterNachHinzufuegen, schritte, bauSchrittHtml, setSchrittHtml, lkwSchrittHtml, nichtGeladenText } from '../js/ui/tabellen-import.js';

const XSS = '<img src=x onerror=alert(1)>';
const kopf = reiter => SPALTEN[reiter].map(s => s.de);
const lies = (reiter, zeilen) => {
  const rows = [['Hinweis'], kopf(reiter), ...zeilen];
  return werteZeilen(reiter, rows, erkenneReiter(rows));
};

// 350 Cases aus Code erzeugt: Gewerk und Menge reihum, Stückzahl je Gewerk unabhängig mitgezählt.
function fixture() {
  const gewerke = ['Licht', 'Ton', 'Video', 'Backline', 'Strom'];
  const erwartet = {};
  const zeilen = [];
  for (let i = 0; i < 350; i++) {
    const gewerk = gewerke[i % gewerke.length];
    const menge = 1 + (i % 3);
    erwartet[gewerk] = (erwartet[gewerk] ?? 0) + menge;
    // Spalten: Name, Menge, Breite, Tiefe, Höhe, Rollen, Gewicht, Lage, Tippen, Gewerk, Farbe
    zeilen.push([`Case ${i}`, String(menge), '60', '40', '50', 'nein', '20', '2', 'nein', gewerk, '']);
  }
  return { zeilen, erwartet, gesamt: Object.values(erwartet).reduce((a, b) => a + b, 0) };
}

test('zusammenfassung: Stückzahlen je Gewerk bei 350 Zeilen', () => {
  const { zeilen, erwartet, gesamt } = fixture();
  const z = zusammenfassung(lies('cases', zeilen));
  assert.equal(z.cases, gesamt);
  assert.equal(z.rot, 0);
  assert.equal(z.jeGewerk.length, 5);
  for (const g of z.jeGewerk) assert.equal(g.anzahl, erwartet[g.gewerk], g.gewerk);
  assert.equal(z.jeGewerk.reduce((a, g) => a + g.anzahl, 0), gesamt);
  assert.match(z.jeGewerk[0].farbe, /^#[0-9a-f]{6}$/i);
});

test('zusammenfassung: rot und gelb zählen Zeilen, rote Zeilen zählen keine Stücke, Traversen/Boxen/Set getrennt', () => {
  const cases = lies('cases', [
    ['A', '2', '60', '40', '50', 'nein', '', '', '', 'Ton', ''],        // gelb (Lage fehlt)
    ['B', '1', '60', '40', '', 'nein', '', '2', '', 'Ton', ''],         // rot (Höhe fehlt)
    ['C', '3', '60', '40', '50', 'nein', '5', '2', '', 'Ton', ''],       // ok
  ]);
  const trav = lies('traversen', [['Box 40', '300', '4', 'Rigging', '']]);
  const boxen = lies('boxen', [['Sub', '34', '', '', '', '', 'Ton', '']]);
  const set = lies('set', [['Podest', '2', '200', '100', '30', '', '1', 'Bühne', '']]);
  const z = zusammenfassung([...cases, ...trav, ...boxen, ...set]);
  assert.deepEqual([z.cases, z.rot, z.gelb, z.traversen, z.boxen, z.set], [5, 1, 1, 4, 34, 2]);
  assert.deepEqual(z.jeGewerk.map(g => g.gewerk).sort(), ['Bühne', 'Ton']);
});

test('uebersichtHtml: Name mit HTML wird maskiert (Gewerk, Merkliste, Projektname)', () => {
  const eintraege = [
    ...lies('cases', [[XSS, '1', '60', '40', '50', 'nein', '', '2', '', XSS, ''], ['kaputt', '1', '60', '40', '', '', '', '', '', '', '']]),
    ...lies('traversen', [[XSS, '300', '2', '', XSS]]),
    ...lies('boxen', [[XSS, '3', '', '', '', '', '', '']]),
  ];
  const html = uebersichtHtml(zusammenfassung(eintraege), auffaelligkeiten(eintraege), { zielAktuell: XSS, merkliste: eintraege, dateiname: XSS });
  assert.ok(!html.includes('<img'), html);
  assert.ok(html.includes('&lt;img'));
});

test('uebersichtHtml: Übernehmen gesperrt bei roten Zeilen, frei mit „rote nicht übernehmen“; Ziel nur mit offenem Plan; keine LKW-Spalte', () => {
  const e = lies('cases', [['kaputt', '1', '60', '40', '', '', '', '', '', '', '']]);
  const z = zusammenfassung(e);
  const gesperrt = uebersichtHtml(z, [], { zielAktuell: 'Tour' });
  assert.match(gesperrt, /data-act="only" disabled/);
  assert.match(gesperrt, /data-act="load" disabled/);
  assert.match(gesperrt, /value="current" checked/);
  const frei = uebersichtHtml(z, [], { ohneRot: true });
  assert.doesNotMatch(frei, /data-act="(only|load)" disabled/);
  assert.doesNotMatch(frei, /value="current"/);
  assert.doesNotMatch(frei, /LKW/);
  const sauber = uebersichtHtml(zusammenfassung(lies('cases', [['ok', '1', '60', '40', '50', 'nein', '5', '2', '', '', '']])), []);
  assert.doesNotMatch(sauber, /data-act="only" disabled/);
  assert.doesNotMatch(sauber, /skipred/);
});

test('uebersichtHtml: Farb-Auffälligkeit und Merkliste erscheinen', () => {
  const zeilen = [];
  for (let i = 0; i < 8; i++) zeilen.push([`L${i}`, '1', '60', '40', '50', 'nein', '5', '2', '', 'Licht', 'Orange']);
  zeilen.push(['Amp', '1', '60', '40', '50', 'nein', '5', '2', '', 'Ton', 'Orange']);
  const e = [...lies('cases', zeilen), ...lies('traversen', [['Box 40', '300', '4', '', '']])];
  const auf = auffaelligkeiten(e);
  assert.equal(auf.length, 1);
  const html = uebersichtHtml(zusammenfassung(e), auf, { merkliste: e });
  assert.match(html, /data-rows="11"/); // Zeile 3 + 8 = Excel-Zeile 11
  assert.match(html, /4 × Box 40/);
});

test('listeHtml: Filter „fehler“ zeigt nur rote und gelbe Einträge, keine LKW-Spalte', () => {
  const e = lies('cases', [
    ['ok', '1', '60', '40', '50', 'nein', '5', '2', '', 'Ton', ''],
    ['gelb', '1', '60', '40', '50', 'nein', '5', '', '', 'Ton', ''],
    ['rot', '1', '60', '40', '', 'nein', '5', '2', '', 'Ton', ''],
  ]);
  const alle = listeHtml(e, { filter: 'alle', reiter: 'cases', suche: '' });
  assert.equal((alle.match(/<tr data-i/g) ?? []).length, 3);
  const nur = listeHtml(e, { filter: 'fehler', reiter: 'cases', suche: '' });
  assert.equal((nur.match(/<tr data-i/g) ?? []).length, 2);
  assert.ok(!nur.includes('value="ok"'));
  assert.match(nur, /<tr data-i="1" class="gelb">/);
  assert.match(nur, /<tr data-i="2" class="rot">/);
  assert.doesNotMatch(alle, /LKW/);
  assert.match(nur, /data-k="hoehe" value="" class="rot"/);
  // Reiter und Suche
  assert.ok(!listeHtml(e, { filter: 'alle', reiter: 'set', suche: '' }).includes('<tr data-i'));
  assert.equal((listeHtml(e, { filter: 'alle', reiter: 'cases', suche: 'GELB' }).match(/<tr data-i/g) ?? []).length, 1);
});

test('listeHtml: HTML im Namen und im Befund wird maskiert', () => {
  const e = lies('cases', [[XSS, '1', '60', '40', 'abc"><b>', 'nein', '5', '2', '', XSS, '']]);
  const html = listeHtml(e, { filter: 'alle', reiter: 'cases', suche: '' });
  assert.ok(!html.includes('<img'), html);
  assert.ok(!html.includes('<b>'), html);
});

test('zeilenStatus: Feld- und Zeilenstufe, rot schlägt gelb', () => {
  const [e] = lies('cases', [['x', '', '60', '40', '', 'nein', '', '', '', '', '']]);
  const s = zeilenStatus(e);
  assert.equal(s.zeile, 'rot');
  assert.equal(s.felder.hoehe, 'rot');
  assert.equal(s.felder.menge, 'gelb');
  assert.equal(zeilenStatus({ befunde: [] }).zeile, '');
});

test('Hilfe nennt den Google-Export je Reiter; Vorlage folgt der Sprache', () => {
  const h = hilfeHtml();
  assert.match(h, /CSV/);
  assert.match(h, /vier/);
  assert.equal(vorlageDatei('de'), 'data/Truckload-Ladeliste.xlsx');
  assert.equal(vorlageDatei('en'), 'data/Truckload-Loadlist.xlsx');
});

test('ordneBlaetter: zwei Quellen für einen Reiter → Fehler; unbekanntes Blatt wird genannt und ignoriert', async () => {
  const { ordneBlaetter } = await import('../js/app/tabellenImport.js');
  const cases = [kopf('cases'), ['A', '1', '60', '40', '50', 'nein', '5', '2', '', 'Ton', '']];
  const ok = ordneBlaetter([{ datei: 'a.csv', blatt: '', rows: cases }, { datei: 'x.xlsx', blatt: 'Notizen', rows: [['irgendwas']] }]);
  assert.equal(ok.fehler, null);
  assert.deepEqual(ok.ignoriert, ['x.xlsx (Notizen)']);
  assert.equal(ok.eintraege.length, 1);
  const doppelt = ordneBlaetter([{ datei: 'a.csv', blatt: '', rows: cases }, { datei: 'b.csv', blatt: '', rows: cases }]);
  assert.match(doppelt.fehler, /a\.csv/);
  assert.match(doppelt.fehler, /b\.csv/);
  assert.equal(doppelt.eintraege.length, 0);
});

test('listeHtml: alle 350 Zeilen werden gezeichnet, auch die letzten, jede mit Eingabefeldern', () => {
  const { zeilen } = fixture();
  const e = lies('cases', zeilen);
  const h = listeHtml(e, { filter: 'alle', reiter: 'cases', suche: '' });
  assert.equal((h.match(/<tr data-i/g) ?? []).length, 350);
  assert.ok(h.includes('value="Case 349"'));
  assert.equal((h.match(/<tr data-i="349"[^]*?<\/tr>/)[0].match(/<input/g) ?? []).length, SPALTEN.cases.length);
});

test('entwuerfeAus: rote Zeilen landen in ausgelassen, Traversen/Boxen nie in den Entwürfen', () => {
  const e = [
    ...lies('cases', [
      ['ok', '2', '60', '40', '50', 'nein', '5', '2', '', 'Ton', ''],
      ['rot', '1', '60', '40', '', 'nein', '5', '2', '', 'Ton', ''],
    ]),
    ...lies('traversen', [['Box 40', '300', '4', '', '']]),
  ];
  const { entwuerfe, ausgelassen } = entwuerfeAus(e);
  assert.equal(entwuerfe.length, 1);
  assert.equal(entwuerfe[0].menge, 2);
  assert.deepEqual(ausgelassen.map(x => x.werte.name), ['rot']);
});

test('Esc in der Listenansicht führt zurück zur Übersicht, in der Übersicht bricht es ab', async () => {
  const { escZiel } = await import('../js/ui/tabellen-import.js');
  assert.equal(escZiel('list'), 'overview');
  assert.equal(escZiel('overview'), null);
});

// Zähltexte: Einzahl und Mehrzahl sind getrennte Paare (1 Zeile, nicht „1 Zeilen“).
function zaehlt(rot, gelb) {
  const zeilen = [];
  for (let i = 0; i < rot; i++) zeilen.push(['B' + i, '1', '60', '40', '', 'nein', '', '2', '', 'Ton', '']); // rot (Höhe fehlt)
  for (let i = 0; i < gelb; i++) zeilen.push(['A' + i, '2', '60', '40', '50', 'nein', '', '', '', 'Ton', '']); // gelb (Lage fehlt)
  const e = lies('cases', zeilen);
  return uebersichtHtml(zusammenfassung(e), auffaelligkeiten(e));
}

test('uebersichtHtml: Zähltexte im Plural nur bei 2+, Einzahl bei 1 (Deutsch)', () => {
  const eins = zaehlt(1, 1);
  assert.ok(eins.includes('1 Zeile ist fehlerhaft (rot).'), eins);
  assert.ok(eins.includes('1 Zeile mit Hinweis (gelb)'), eins);
  assert.doesNotMatch(eins, /1 Zeilen/);
  const zwei = zaehlt(2, 2);
  assert.ok(zwei.includes('2 Zeilen sind fehlerhaft (rot).'), zwei);
  assert.ok(zwei.includes('2 Zeilen mit Hinweis (gelb)'), zwei);
});

test('uebersichtHtml: Zähltexte im Plural nur bei 2+, Einzahl bei 1 (Englisch)', async () => {
  const { setLang } = await import('../js/i18n/i18n.js');
  setLang('en');
  try {
    const eins = zaehlt(1, 1);
    assert.ok(eins.includes('1 row is faulty (red).'), eins);
    assert.ok(eins.includes('1 row with a note (yellow)'), eins);
    assert.doesNotMatch(eins, /1 rows/);
    const zwei = zaehlt(2, 2);
    assert.ok(zwei.includes('2 rows are faulty (red).'), zwei);
    assert.ok(zwei.includes('2 rows with a note (yellow)'), zwei);
  } finally { setLang('de'); }
});

test('stock-target: Betriebsart projekt', () => {
  assert.equal(stockTargetHtml({ mode: 'projekt' }), '');
  assert.deepEqual(readStockTarget(null, { mode: 'projekt' }), { inStock: false, company: '' });
});

// Task 1b: lose Boxen aus dem Reiter Boxen
// Spalten: Typ, Anzahl, Breite, Tiefe, Höhe, Gewicht, Gewerk, Notiz
test('Boxen: Zeilen mit Maßen zählen als Boxen und Gewerk, ohne Maße bleiben sie Merkliste', () => {
  const b = lies('boxen', [
    ['Kiste', '3', '40', '50', '60', '12', 'Ton', ''],   // lose Box
    ['Sub', '34', '', '', '', '', 'Ton', ''],             // Merkliste
    ['Halb', '2', '40', '', '', '', 'Ton', ''],           // rot
  ]);
  const z = zusammenfassung(b);
  assert.deepEqual([z.boxen, z.rot, z.gelb], [37, 1, 0]);
  assert.deepEqual(z.jeGewerk.map(g => [g.gewerk, g.anzahl]), [['Ton', 3]]);
  const html = uebersichtHtml(z, [], { merkliste: b });
  assert.match(html, /34 × Sub/);
  assert.doesNotMatch(html, /3 × Kiste/);
  assert.doesNotMatch(html, /2 × Halb/);
});

test('entwuerfeAus: lose Boxen sind Entwürfe, rote Boxen-Zeilen landen in ausgelassen, Merkliste nicht', () => {
  const b = lies('boxen', [
    ['Kiste', '3', '40', '50', '60', '', 'Ton', ''],
    ['Sub', '34', '', '', '', '', 'Ton', ''],
    ['Halb', '2', '40', '', '', '', 'Ton', ''],
  ]);
  const { entwuerfe, ausgelassen } = entwuerfeAus(b);
  assert.equal(entwuerfe.length, 1);
  assert.equal(entwuerfe[0].menge, 3);
  assert.equal(entwuerfe[0].case.name, 'Kiste');
  assert.deepEqual(ausgelassen.map(x => x.werte.typ), ['Halb']);
});

test('listeHtml: Reiter Boxen zeigt Zeilen mit Eingabefeldern; Merkliste-Zeile hat keinen roten Befund', () => {
  const b = lies('boxen', [['Sub', '34', '', '', '', '', 'Ton', ''], ['Halb', '2', '40', '', '', '', 'Ton', '']]);
  const h = listeHtml(b, { filter: 'alle', reiter: 'boxen', suche: '' });
  assert.equal((h.match(/<tr data-i/g) ?? []).length, 2);
  assert.equal((h.match(/<tr data-i="0"[^]*?<\/tr>/)[0].match(/<input/g) ?? []).length, SPALTEN.boxen.length);
  assert.match(h, /<tr data-i="1" class="rot"/);
  assert.match(h, /<tr data-i="0" class=""/);
});

test('Zeile hinzufügen: die neue Zeile ist auf jedem Reiter sichtbar (leere Boxen-Zeile hat keinen Befund)', () => {
  for (const reiter of ['cases', 'set', 'boxen', 'traversen']) {
    const neu = pruefeEintrag({ zeile: null, reiter, werte: Object.fromEntries(SPALTEN[reiter].map(sg => [sg.key, ''])), befunde: [] });
    const filter = filterNachHinzufuegen(neu);
    const h = listeHtml([neu], { filter: filter === 'fehler' ? 'fehler' : 'alle', reiter, suche: '' });
    assert.equal((h.match(/<tr data-i/g) ?? []).length, 1, reiter);
  }
  assert.equal(filterNachHinzufuegen({ befunde: [] }), 'alle');
});

test('Struktursperre: der add-Zweig setzt den Filter über filterNachHinzufuegen, nie fest auf „fehler“', () => {
  const src = readFileSync(new URL('../js/ui/tabellen-import.js', import.meta.url), 'utf8');
  const start = src.indexOf("act === 'add'");
  const ende = src.indexOf("act === 'del'", start);
  assert.ok(start > 0 && ende > start, 'add-Zweig gefunden');
  const zweig = src.slice(start, ende);
  assert.match(zweig, /st\.filter\s*=\s*filterNachHinzufuegen\(/);
  assert.doesNotMatch(zweig, /st\.filter\s*=\s*'fehler'/);
});

// Task 2: Schritte Traversen, Boxen und Set
const casesZ = () => lies('cases', [['ok', '1', '60', '40', '50', 'nein', '5', '2', '', 'Ton', '']]);
const travZ = () => lies('traversen', [['Box 40', '300', '4', '', '']]);
const boxZ = () => lies('boxen', [['Sub', '34', '', '', '', '', 'Ton', ''], ['Kiste', '3', '40', '50', '60', '', 'Ton', '']]);
const setZ = (...z) => lies('set', z);
const LEER = { cases: [], stuecke: [] };

test('schritte: nur Reiter mit Zeilen, lkws nur beim Laden, feste Reihenfolge', () => {
  assert.deepEqual(schritte(casesZ(), false), []);
  assert.deepEqual(schritte(casesZ(), true), ['lkws']);
  assert.equal(schritte(casesZ(), true).at(-1), 'lkws');
  assert.deepEqual(schritte([...casesZ(), ...travZ()], false), ['traversen']);
  const alle = [...boxZ(), ...setZ(['Teil', '1', '10', '10', '10', '1', '1', 'Ton', '']), ...travZ()];
  assert.deepEqual(schritte(alle, true), ['traversen', 'boxen', 'set', 'lkws']);
  assert.deepEqual(schritte(alle, false), ['traversen', 'boxen', 'set']);
});

test('setSchrittHtml: rote Set-Zeile sperrt Weiter, „rote nicht übernehmen“ gibt frei, Cases erscheinen nicht', () => {
  const e = [...casesZ(), ...setZ(['kaputt', '1', '60', '40', '', '', '', '', ''])];
  const gesperrt = setSchrittHtml(e, { ohneRot: false });
  assert.match(gesperrt, /data-act="next"[^>]*disabled/);
  assert.match(gesperrt, /name="skipredset"/);
  assert.doesNotMatch(gesperrt, />ok</);
  assert.doesNotMatch(gesperrt, /value="ok"/);
  assert.match(gesperrt, /value="kaputt"/);
  assert.match(gesperrt, /data-act="add"/);
  assert.doesNotMatch(setSchrittHtml(e, { ohneRot: true }), /data-act="next"[^>]*disabled/);
  const sauber = [...setZ(['gut', '1', '10', '10', '10', '1', '1', 'Ton', ''])];
  assert.doesNotMatch(setSchrittHtml(sauber, { ohneRot: false }), /disabled/);
});

test('setSchrittHtml: Zähler rot/gelb nur über Set-Zeilen; letzter Schritt zeigt Übernehmen statt Weiter', () => {
  const e = [...lies('cases', [['kaputt', '1', '60', '40', '', '', '', '', '', '', '']]), ...setZ(['gut', '1', '10', '10', '10', '1', '1', 'Ton', ''])];
  assert.match(setSchrittHtml(e, { ohneRot: false }), /data-role="count"[^>]*>0 [^<]*0 /);
  assert.match(setSchrittHtml(e, { ohneRot: false, letzter: true, laden: true }), /data-act="finish"/);
  assert.doesNotMatch(setSchrittHtml(e, { ohneRot: false, letzter: true }), /data-act="next"/);
});

test('bauSchrittHtml boxen: Grundbox-Auswahl mit Lose/Dolly, lose Box mit Maßen nicht in der Merkliste', () => {
  const basis = { id: 'preset-k2', name: 'K2', dollyPrompt: true };
  const html = bauSchrittHtml('boxen', boxZ(), LEER, { dollyBasen: [basis] });
  assert.match(html, /data-act="loose"/);
  assert.match(html, /data-act="dolly"/);
  assert.match(html, /<select[^>]*data-role="basis"/);
  const memo = html.match(/<div class="ti-memo">[^]*?<\/div>/)[0];
  assert.match(memo, /34 × Sub/);
  assert.doesNotMatch(memo, /Kiste/);
  assert.match(html, /Kiste/); // aber als Zeile „kommt aus der Tabelle“ sichtbar
  assert.match(html, /data-act="next"/);
});

test('bauSchrittHtml boxen ohne Grundboxen: Hinweis statt Auswahl, Weiter bleibt frei', () => {
  const html = bauSchrittHtml('boxen', [], LEER, { dollyBasen: [] });
  assert.match(html, /Keine Grundboxen/);
  assert.doesNotMatch(html, /<select/);
  assert.match(html, /data-act="next"/);
  assert.doesNotMatch(html, /data-act="next"[^>]*disabled/);
});

test('bauSchrittHtml traversen: Fremdtext maskiert, Knopf Traverse hinzufügen, Gebautes mit Anzahl', () => {
  const e = lies('traversen', [[XSS, '300', '2', '', XSS]]);
  const gebaut = { cases: [{ id: 'w1', name: XSS, kind: 'truss', herkunft: 'import' }], stuecke: [{ caseId: 'w1', n: 3 }] };
  const html = bauSchrittHtml('traversen', e, gebaut, { dollyBasen: [] });
  assert.ok(!html.includes('<img'), html);
  assert.ok(html.includes('&lt;img'));
  assert.match(html, /data-act="truss"/);
  assert.match(html, /data-k="n"[^>]*value="3"|value="3"[^>]*data-k="n"/);
  assert.match(html, /min="1" max="500"|max="500"[^>]*min="1"/);
  assert.match(html, /data-act="rm"/);
});

test('bauSchrittHtml: jeder Schritt zeigt nur seine Stücke; Dolly und lose sind benannt', () => {
  const gebaut = {
    cases: [{ id: 'w1', name: 'Wagen', kind: 'truss' }, { id: 'd1', name: 'K2 2er', kind: 'speaker', unitH: 40 }],
    stuecke: [{ caseId: 'w1', n: 2 }, { caseId: 'd1', n: 1 }, { caseId: 'preset-k2', n: 4 }],
  };
  const opts = { dollyBasen: [{ id: 'preset-k2', name: 'K2', dollyPrompt: true }], bibliothekCases: [{ id: 'preset-k2', name: 'K2' }] };
  const t1 = bauSchrittHtml('traversen', [], gebaut, opts);
  assert.match(t1, /Wagen/);
  assert.doesNotMatch(t1, /K2/);
  const b1 = bauSchrittHtml('boxen', [], gebaut, opts);
  assert.doesNotMatch(b1, /Wagen/);
  assert.match(b1, /K2 2er/);
  assert.match(b1, /ti-tag dolly/);
  assert.match(b1, /ti-tag loose/);
});

test('Merkliste in der Übersicht verweist nicht mehr auf eine spätere Version', () => {
  const e = [...travZ(), ...boxZ()];
  const html = uebersichtHtml(zusammenfassung(e), [], { merkliste: e });
  assert.doesNotMatch(html, /späteren Version|later version/);
  assert.match(html, /34 × Sub/);
});

test('Struktursperre: Wizard-Dialoge laufen mit stock „projekt“ und speichern nichts; gebaut geht in beide uebernimmTabelle-Aufrufe', () => {
  const ui = readFileSync(new URL('../js/ui/tabellen-import.js', import.meta.url), 'utf8');
  for (const fn of ['openTrussDialog', 'openDollyDialog']) {
    const i = ui.indexOf(`await ${fn}(`);
    assert.ok(i > 0, fn);
    assert.match(ui.slice(i, ui.indexOf('});', i)), /stock:\s*\{\s*mode:\s*'projekt'\s*\}/, fn);
  }
  assert.doesNotMatch(ui, /saveCase/);
  const app = readFileSync(new URL('../js/app/tabellenImport.js', import.meta.url), 'utf8');
  // Trockenlauf, Vorschau (rechneLkwImport) und Übernahme: jeder Aufruf reicht gebaut durch
  const aufrufe = (app.match(/uebernimmTabelle\(/g) ?? []).length;
  assert.equal(aufrufe, 3);
  assert.equal((app.match(/uebernimmTabelle\([^;]*gebaut\)/g) ?? []).length, aufrufe);
});

test('uebersichtHtml: rote Set-Zeile sperrt die Übersicht nicht (eigenes Band), rote Cases-Zeile weiterhin', () => {
  const rotSet = setZ(['kaputt', '1', '60', '40', '', '', '', '', '']);
  const z = zusammenfassung(rotSet);
  assert.equal(z.rotSet, 1);
  const html = uebersichtHtml(z, [], {});
  assert.doesNotMatch(html, /data-act="(only|load)" disabled/);
  assert.match(html, /1 Set-Teil ist fehlerhaft/);
  assert.doesNotMatch(html, /name="skipredset"/);
  const mehr = uebersichtHtml(zusammenfassung([...rotSet, ...setZ(['k2', '1', '60', '40', '', '', '', '', ''])]), [], {});
  assert.match(mehr, /2 Set-Teile sind fehlerhaft/);
  const rotCases = lies('cases', [['kaputt', '1', '60', '40', '', '', '', '', '', '', '']]);
  const h2 = uebersichtHtml(zusammenfassung([...rotCases, ...rotSet]), [], {});
  assert.match(h2, /data-act="only" disabled/);
  assert.match(h2, /1 Zeile ist fehlerhaft/);
});

test('Struktursperre: Set-Schritt und Übersicht haben getrennte Häkchen, Aktionen sind gegen Doppelklick gesperrt', () => {
  const src = readFileSync(new URL('../js/ui/tabellen-import.js', import.meta.url), 'utf8');
  assert.match(src, /name === 'skipredset'\) \{ st\.ohneRotSet/);
  assert.match(src, /if \(schrittBusy\) return;/);
});

// Task 5: LKW-Schritt
const FZ = [{ id: 'a', name: 'Sattel 13,6 m' }, { id: 'b', name: 'Koffer 7,5 t' }];
const lkwHtml = (o = {}) => lkwSchrittHtml({ gewerke: ['Licht', 'Ton'], einst: {}, fahrzeuge: FZ, zielHatLkw: false, freieLkw: 12, vorschau: null, ...o });

test('lkwSchrittHtml: Verhaltens-Radios nur, wenn das Ziel schon LKW hat; Vorgabe „neu“', () => {
  assert.doesNotMatch(lkwHtml(), /name="lkwverh"/);
  const h = lkwHtml({ zielHatLkw: true });
  assert.equal((h.match(/name="lkwverh"/g) ?? []).length, 3);
  assert.match(h, /value="neu" checked/);
  assert.match(h, /ersetzt/); // Hinweis zu Entscheidung 2: alte LKW gehen verloren
});

test('lkwSchrittHtml: „hinzu“ blendet Gewerk-Zeilen aus, sonst je Gewerk eine Zeile', () => {
  assert.doesNotMatch(lkwHtml({ zielHatLkw: true, einst: { verhalten: 'hinzu' } }), /data-g=/);
  const h = lkwHtml();
  assert.match(h, /data-role="gmodus" data-g="Licht"/);
  assert.match(h, /data-role="gmodus" data-g="Ton"/);
});

test('lkwSchrittHtml: freies Gewerk aus der Tabelle wird escaped', () => {
  const h = lkwHtml({ gewerke: ['<b>x</b>'], fahrzeuge: [{ id: 'q', name: '<i>y</i>' }] });
  assert.doesNotMatch(h, /<b>x<\/b>/);
  assert.doesNotMatch(h, /<i>y<\/i>/);
  assert.match(h, /&lt;b&gt;x&lt;\/b&gt;/);
});

test('lkwSchrittHtml: N-Feld begrenzt auf die freien LKW', () => {
  const h = lkwHtml({ freieLkw: 3, einst: { gewerke: { Licht: { modus: 'n', n: 2 } } } });
  assert.match(h, /data-role="gn"[^>]*max="3"|max="3"[^>]*data-role="gn"/);
});

test('lkwSchrittHtml: Vorschau, „rechnet …“ und Übernehmen-Knopf', () => {
  const v = { lkws: [{ name: 'LKW 1', gewerke: ['Licht'], stueck: 4 }], nichtGeladen: [{ name: 'Rest', gewerk: 'Ton' }] };
  const h = lkwHtml({ vorschau: v });
  assert.match(h, /LKW 1/);
  assert.match(h, /Rest \(Ton\)/);
  assert.match(h, /data-act="finish"/);
  assert.match(h, /data-act="prev"/);
  assert.match(lkwHtml({ rechnet: true }), /rechnet/);
});

test('nichtGeladenText: leer, Einzahl, Mehrzahl', () => {
  assert.equal(nichtGeladenText([]), '');
  const eins = nichtGeladenText([{ name: 'Sub', gewerk: 'Ton' }]);
  assert.match(eins, /1 Case nicht geladen/);
  assert.match(eins, /Sub \(Ton\)/);
  const zwei = nichtGeladenText([{ name: 'Sub', gewerk: 'Ton' }, { name: 'Par', gewerk: 'Licht' }]);
  assert.match(zwei, /2 Cases nicht geladen/);
  assert.match(zwei, /Sub \(Ton\).*Par \(Licht\)/);
});
