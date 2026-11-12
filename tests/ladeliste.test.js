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

// ---------------------------------------------------------------------------------------------
// Task 3: Zeilen auswerten
import { FARBEN, zahl, werteZeilen, pruefeEintrag, entwurfAus, farbAuffaelligkeiten } from '../js/model/ladeliste.js';

const KOPF_CASES = kopf('cases');
const TAB = (ueber = {}) => ({ name: 'Case A', menge: '2', breite: '60', tiefe: '80', hoehe: '100', rollen: 'ja', gewicht: '40', lage: '2', tippen: 'nein', gewerk: 'Licht', farbe: '', ...ueber });
const zeileAus = (obj, reiter = 'cases') => SPALTEN[reiter].map(s => obj[s.key] ?? '');
const eintrag = (ueber, reiter = 'cases') => {
  const rows = [kopf(reiter), zeileAus(TAB(ueber), reiter)];
  return werteZeilen(reiter, rows, erkenneReiter(rows))[0];
};
const befund = (e, feld, stufe) => e.befunde.filter(b => b.feld === feld && (!stufe || b.stufe === stufe));
const rot = (e, feld) => assert.equal(befund(e, feld, 'rot').length, 1, `${feld}: ${JSON.stringify(e.befunde)}`);
const gelb = (e, feld) => assert.equal(befund(e, feld, 'gelb').length, 1, `${feld}: ${JSON.stringify(e.befunde)}`);

test('Sauberer Case-Eintrag: keine Befunde, Entwurf mit Spezifikationsfeldern, keine ID', () => {
  const e = eintrag({});
  assert.deepEqual(e.befunde, []);
  assert.equal(e.zeile, 2);
  assert.equal(e.reiter, 'cases');
  const d = entwurfAus(e);
  assert.equal(d.menge, 2);
  assert.equal(d.tipped, false);
  assert.deepEqual(d.case, {
    name: 'Case A', l: 80, w: 60, h: 100, weight: 40, category: 'Licht', color: '#e8b10c', layers: [1, 2],
    wheels: true, wheelH: 13, dimsInclWheels: true, tippable: false, herkunft: 'import', stackable: true, maxTopLoad: null,
  });
  assert.equal('id' in d.case, false);
});

test('Name leer und zu lang: rot, kein Entwurf', () => {
  const a = eintrag({ name: '  ' }); rot(a, 'name'); assert.equal(entwurfAus(a), null);
  rot(eintrag({ name: 'x'.repeat(81) }), 'name');
  assert.deepEqual(eintrag({ name: 'x'.repeat(80) }).befunde, []);
});

test('Breite/Tiefe/Höhe: fehlt, ≤ 0, > 2000, keine Zahl: rot', () => {
  for (const feld of ['breite', 'tiefe', 'hoehe']) {
    for (const wert of ['', '0', '-5', '2001', 'abc']) rot(eintrag({ [feld]: wert }), feld);
    assert.deepEqual(eintrag({ [feld]: '2000' }).befunde, []);
  }
});

test('„60 cm“: Einheit entfernt, gelb, Wert gilt', () => {
  const e = eintrag({ breite: '60 cm' });
  gelb(e, 'breite');
  assert.equal(entwurfAus(e).case.w, 60);
});

test('zahl: Dezimalkomma, Dezimalpunkt, Einheit, Tausenderpunkt unklar', () => {
  assert.deepEqual(zahl('60,5'), { wert: 60.5, einheitEntfernt: false });
  assert.deepEqual(zahl(' 60.5 '), { wert: 60.5, einheitEntfernt: false });
  assert.deepEqual(zahl('12 KG'), { wert: 12, einheitEntfernt: true });
  assert.deepEqual(zahl('60cm'), { wert: 60, einheitEntfernt: true });
  assert.deepEqual(zahl('0.125'), { wert: 0.125, einheitEntfernt: false });
  assert.equal(zahl('1.200').wert, null);
  assert.equal(zahl('1.200,5').wert, null);
  assert.equal(zahl('1,2,3').wert, null);
  assert.equal(zahl('60 mm').wert, null);
  assert.equal(zahl('').wert, null);
});

test('„1.200“ in der Breite: rot (unklar) statt 1,2', () => {
  const e = eintrag({ breite: '1.200' });
  rot(e, 'breite');
  assert.equal(entwurfAus(e), null);
  assert.equal(entwurfAus(eintrag({ breite: '60,5' })).case.w, 60.5);
});

test('Menge: leer → 1 + gelb; keine ganze Zahl ≥ 1 oder > 9999 → rot', () => {
  const e = eintrag({ menge: '' });
  gelb(e, 'menge');
  assert.equal(entwurfAus(e).menge, 1);
  for (const w of ['0', '1,5', 'abc', '-2', '10000']) rot(eintrag({ menge: w }), 'menge');
  assert.equal(entwurfAus(eintrag({ menge: '9999' })).menge, 9999);
});

test('Gewicht: leer → 0 ohne Befund; keine Zahl → rot; negativ oder über Grenze → rot', () => {
  const e = eintrag({ gewicht: '' });
  assert.deepEqual(e.befunde, []);
  assert.equal(entwurfAus(e).case.weight, 0);
  for (const w of ['schwer', '-1', '50001']) rot(eintrag({ gewicht: w }), 'gewicht');
  gelb(eintrag({ gewicht: '40 kg' }), 'gewicht');
});

test('Lage: leer → [1,2] + gelb; 1/2/3 → Liste; sonst rot', () => {
  const e = eintrag({ lage: '' });
  gelb(e, 'lage');
  assert.deepEqual(entwurfAus(e).case.layers, [1, 2]);
  assert.deepEqual(entwurfAus(eintrag({ lage: '1' })).case.layers, [1]);
  assert.deepEqual(entwurfAus(eintrag({ lage: '3' })).case.layers, [1, 2, 3]);
  for (const w of ['0', '4', '1,5', 'viel']) rot(eintrag({ lage: w }), 'lage');
});

test('Rollen: leer → ja; Wörter ja/nein in beiden Sprachen; sonst rot', () => {
  assert.equal(entwurfAus(eintrag({ rollen: '' })).case.wheels, true);
  assert.deepEqual(eintrag({ rollen: '' }).befunde, []);
  for (const w of ['ja', 'Yes', 'X', '1', 'wahr', 'TRUE']) assert.equal(entwurfAus(eintrag({ rollen: w })).case.wheels, true, w);
  for (const w of ['nein', 'No', '0', 'falsch', 'false']) {
    const d = entwurfAus(eintrag({ rollen: w }));
    assert.equal(d.case.wheels, false, w);
    assert.equal(d.case.wheelH, 0);
  }
  rot(eintrag({ rollen: 'vielleicht' }), 'rollen');
});

test('Rollen bei Höhe ≤ Rollenhöhe: wheels false + gelb', () => {
  const e = eintrag({ hoehe: '13', rollen: 'ja' });
  gelb(e, 'rollen');
  assert.equal(entwurfAus(e).case.wheels, false);
  assert.equal(entwurfAus(eintrag({ hoehe: '14', rollen: 'ja' })).case.wheels, true);
  assert.deepEqual(eintrag({ hoehe: '13', rollen: 'nein' }).befunde, []);
});

test('Tippen: dieselben Wörter, leer = nein, sonst rot; tipped im Entwurf', () => {
  assert.equal(entwurfAus(eintrag({ tippen: '' })).tipped, false);
  const d = entwurfAus(eintrag({ tippen: 'ja' }));
  assert.equal(d.tipped, true);
  assert.equal(d.case.tippable, true);
  assert.equal(entwurfAus(eintrag({ tippen: 'no' })).case.tippable, false);
  rot(eintrag({ tippen: 'eher' }), 'tippen');
});

test('Gewerk: leer → Sonstiges; Groß/Klein und Englisch erkannt; unbekannt gelb als freier Name', () => {
  assert.equal(entwurfAus(eintrag({ gewerk: '' })).case.category, 'Sonstiges');
  assert.deepEqual(eintrag({ gewerk: '' }).befunde, []);
  assert.equal(entwurfAus(eintrag({ gewerk: 'ton' })).case.category, 'Ton');
  assert.equal(entwurfAus(eintrag({ gewerk: 'Lighting' })).case.category, 'Licht');
  const e = eintrag({ gewerk: 'Pyro' });
  gelb(e, 'gewerk');
  const d = entwurfAus(e);
  assert.equal(d.case.category, 'Pyro');
  assert.equal(d.case.color, '#9aa3ad');
});

test('Farbe: leer → Gewerkfarbe; #rrggbb direkt; Name de/en; sonst gelb + Gewerkfarbe', () => {
  assert.equal(entwurfAus(eintrag({ farbe: '' })).case.color, '#e8b10c');
  assert.deepEqual(eintrag({ farbe: '' }).befunde, []);
  assert.equal(entwurfAus(eintrag({ farbe: '#AABBCC' })).case.color, '#aabbcc');
  assert.equal(entwurfAus(eintrag({ farbe: 'orange' })).case.color, '#f28c28');
  assert.equal(entwurfAus(eintrag({ farbe: 'GRÜN' })).case.color, '#22c55e');
  assert.equal(entwurfAus(eintrag({ farbe: 'Green' })).case.color, '#22c55e');
  assert.equal(entwurfAus(eintrag({ farbe: 'Grey' })).case.color, '#9aa3ad');
  const e = eintrag({ farbe: 'Magenta' });
  gelb(e, 'farbe');
  assert.equal(entwurfAus(e).case.color, '#e8b10c');
  gelb(eintrag({ farbe: '#12345' }), 'farbe');
});

test('FARBEN: feste Liste mit Hexwerten', () => {
  assert.equal(FARBEN.length, 12);
  assert.deepEqual(FARBEN.find(f => f.key === 'rot'), { key: 'rot', de: 'Rot', en: 'Red', hex: '#e5484d' });
  assert.equal(FARBEN.find(f => f.key === 'weiss').hex, '#f5f5f5');
});

test('Set: kind set, keine Rollen, nicht tippbar; Höhe ohne Rollenhöhe', () => {
  const e = eintrag({ hoehe: '10' }, 'set');
  assert.deepEqual(e.befunde, []);
  const d = entwurfAus(e);
  assert.equal(d.case.kind, 'set');
  assert.equal(d.case.wheels, false);
  assert.equal(d.case.tippable, false);
  assert.equal(d.case.h, 10);
  assert.equal(d.tipped, false);
});

test('pruefeEintrag berechnet Befunde nach Änderung neu; werteZeilen: leere Zeilen entfallen, Zeilennummer 1-basiert', () => {
  const rows = [['Hinweis'], KOPF_CASES, zeileAus(TAB({ breite: 'x' })), [], ['', '  '], zeileAus(TAB())];
  const liste = werteZeilen('cases', rows, erkenneReiter(rows));
  assert.deepEqual(liste.map(e => e.zeile), [3, 6]);
  rot(liste[0], 'breite');
  const korrigiert = pruefeEintrag({ ...liste[0], werte: { ...liste[0].werte, breite: '60' } });
  assert.deepEqual(korrigiert.befunde, []);
  assert.equal(liste[0].befunde.length, 1, 'Original unverändert');
});

test('werteZeilen: kürzere Zeilen als Kopf → fehlende Zellen leer', () => {
  const rows = [KOPF_CASES, ['Nur Name']];
  const [e] = werteZeilen('cases', rows, erkenneReiter(rows));
  assert.equal(e.werte.breite, '');
  rot(e, 'breite');
});

test('werteZeilen: mehr als 2000 Datenzeilen → Error, genau 2000 ok', () => {
  const daten = n => [KOPF_CASES, ...Array.from({ length: n }, (_, i) => zeileAus(TAB({ name: `C${i}` })))];
  assert.equal(werteZeilen('cases', daten(2000), erkenneReiter(daten(2000))).length, 2000);
  assert.throws(() => werteZeilen('cases', daten(2001), erkenneReiter(daten(2001))), Error);
});

test('farbAuffaelligkeiten: Mehrheitsgewerk ab 60 % und 5 Zeilen, Ausreißer auffällig', () => {
  const mk = (n, gewerk, start) => Array.from({ length: n }, (_, i) => ({ ...eintrag({ gewerk, farbe: 'Orange' }), zeile: start + i }));
  const e = [...mk(10, 'Licht', 2), ...mk(4, 'Ton', 12)];
  const r = farbAuffaelligkeiten(e);
  assert.equal(r.length, 1);
  assert.equal(r[0].farbe, '#f28c28');
  assert.equal(r[0].mehrheit, 'Licht');
  assert.equal(r[0].gewerk, 'Ton');
  assert.deepEqual(r[0].zeilen, [12, 13, 14, 15]);
  assert.deepEqual(farbAuffaelligkeiten(mk(3, 'Ton', 2)), []);
  assert.deepEqual(farbAuffaelligkeiten(mk(10, 'Licht', 2)), []);
});

test('farbAuffaelligkeiten: ohne Mehrheit (< 60 %) und ohne Farbangabe nichts', () => {
  const mk = (n, gewerk, farbe) => Array.from({ length: n }, () => eintrag({ gewerk, farbe }));
  assert.deepEqual(farbAuffaelligkeiten([...mk(5, 'Licht', 'rot'), ...mk(5, 'Ton', 'rot')]), []);
  assert.deepEqual(farbAuffaelligkeiten([...mk(10, 'Licht', ''), ...mk(4, 'Ton', '')]), []);
});

test('farbAuffaelligkeiten: Grenzen genau bei 5 Zeilen und 60 %', () => {
  const mk = (n, gewerk) => Array.from({ length: n }, () => eintrag({ gewerk, farbe: 'rot' }));
  assert.deepEqual(farbAuffaelligkeiten([...mk(4, 'Licht'), ...mk(1, 'Ton')]), [], '4 Zeilen: zu wenig');
  assert.equal(farbAuffaelligkeiten([...mk(5, 'Licht'), ...mk(3, 'Ton')]).length, 1, '5 von 8 = 62,5 %');
  assert.deepEqual(farbAuffaelligkeiten([...mk(5, 'Licht'), ...mk(4, 'Ton')]), [], '5 von 9 = 55 %');
});

test('Einheit je Feld: Maße nur cm, Gewicht nur kg; falsche Einheit rot', () => {
  gelb(eintrag({ breite: '60 cm' }), 'breite');
  rot(eintrag({ breite: '60 kg' }), 'breite');
  rot(eintrag({ tiefe: '80 kg' }), 'tiefe');
  rot(eintrag({ hoehe: '100 kg' }), 'hoehe');
  gelb(eintrag({ gewicht: '40 kg' }), 'gewicht');
  rot(eintrag({ gewicht: '40 cm' }), 'gewicht');
  assert.equal(entwurfAus(eintrag({ breite: '60 kg' })), null);
  assert.equal(zahl('60 kg', 'cm').wert, null);
  assert.deepEqual(zahl('60 cm', 'cm'), { wert: 60, einheitEntfernt: true });
});

test('Menge und Lage mit Einheit: rot', () => {
  rot(eintrag({ menge: '5 cm' }), 'menge');
  rot(eintrag({ menge: '5 kg' }), 'menge');
  rot(eintrag({ lage: '2 cm' }), 'lage');
  assert.equal(entwurfAus(eintrag({ menge: '5 cm' })), null);
});

test('Entwurf: Cases und Set sind stapelbar ohne Auflastgrenze (wie die Editor-Vorgabe)', () => {
  for (const reiter of ['cases', 'set']) {
    const c = entwurfAus(eintrag({}, reiter)).case;
    assert.equal(c.stackable, true, reiter);
    assert.equal(c.maxTopLoad, null, reiter);
  }
});

test('Gewerk: höchstens 40 Zeichen (lkw.categories-Grenze) – 40 ok, 41 rot', () => {
  const g40 = 'G'.repeat(40);
  const ok = eintrag({ gewerk: g40 });
  assert.equal(befund(ok, 'gewerk', 'rot').length, 0);
  assert.equal(entwurfAus(ok).case.category, g40);
  const zuLang = eintrag({ gewerk: 'G'.repeat(41) });
  rot(zuLang, 'gewerk');
  assert.equal(entwurfAus(zuLang), null);
});
