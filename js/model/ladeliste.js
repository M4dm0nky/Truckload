// Ladeliste (Tabellen-Import, Stufe 1): reine Logik ohne DOM. Erkennt den Reiter einer Tabelle an
// der Kopfzeile (Task 2) und wertet die Zeilen aus (Task 3). Die Kopfzeilen und Farbwörter in
// beiden Sprachen sind Erkennungsdaten, keine Anzeigetexte (ALLOW in tests/i18n.test.js).

import { t, lang, GEWERKE_EN } from '../i18n/i18n.js';
import { CATEGORIES, colorFor } from '../data/categories.js';
import { CASE_LIMITS, NAME_MAX } from './limits.js';

export const REITER = ['cases', 'traversen', 'boxen', 'set'];

const sp = (key, de, en, pflicht = false) => ({ key, de, en, pflicht });

const GEMEINSAM = [
  sp('name', 'Name', 'Name', true),
  sp('menge', 'Menge', 'Quantity'),
  sp('breite', 'Breite (cm)', 'Width (cm)', true),
  sp('tiefe', 'Tiefe (cm)', 'Depth (cm)', true),
];
const HINTEN = [
  sp('gewicht', 'Gewicht (kg)', 'Weight (kg)'),
  sp('lage', 'Höchste Lage (1/2/3)', 'Highest layer (1/2/3)'),
];
const GEWERK = sp('gewerk', 'Gewerk', 'Department');
const FARBE = sp('farbe', 'Farbe', 'Colour');
const NOTIZ = sp('notiz', 'Notiz', 'Note');

// Die einzige Liste der Kopfzeilen.
export const SPALTEN = {
  cases: [
    ...GEMEINSAM,
    sp('hoehe', 'Höhe inkl. Rollen (cm)', 'Height incl. wheels (cm)', true),
    sp('rollen', 'Rollen (ja/nein)', 'Wheels (yes/no)'),
    ...HINTEN,
    sp('tippen', 'Tippen', 'Tip'),
    GEWERK, FARBE,
  ],
  traversen: [
    sp('profil', 'Profil', 'Profile', true),
    sp('laenge', 'Länge (cm)', 'Length (cm)', true),
    sp('stueck', 'Stückzahl', 'Pieces', true),
    GEWERK, NOTIZ,
  ],
  boxen: [
    sp('typ', 'Typ', 'Type', true),
    sp('anzahl', 'Anzahl', 'Count', true),
    GEWERK, NOTIZ,
  ],
  set: [
    ...GEMEINSAM,
    sp('hoehe', 'Höhe (cm)', 'Height (cm)', true),
    ...HINTEN,
    GEWERK, FARBE,
  ],
};

const norm = s => String(s ?? '').trim().toLowerCase().replace(/\s+/g, ' ');

// Spaltenindizes je Schlüssel für einen Reiter; erste gleichnamige Spalte gewinnt.
function spaltenFuer(reiter, zelle) {
  const spalten = {};
  for (const sg of SPALTEN[reiter]) {
    const i = zelle.findIndex(z => z === norm(sg.de) || z === norm(sg.en));
    if (i >= 0) spalten[sg.key] = i;
  }
  // Cases mit „Höhe (cm)“ plus Rollen-Spalte: eindeutig Cases (sonst wäre es ein Set)
  if (reiter === 'cases' && spalten.hoehe === undefined && spalten.rollen !== undefined) {
    const h = SPALTEN.set.find(x => x.key === 'hoehe');
    const i = zelle.findIndex(z => z === norm(h.de) || z === norm(h.en));
    if (i >= 0) spalten.hoehe = i;
  }
  return spalten;
}

const vollstaendig = (reiter, spalten) => SPALTEN[reiter].every(sg => !sg.pflicht || spalten[sg.key] !== undefined);

// Kopfzeile = erste der ersten 5 Zeilen, in der ein Reiter alle Pflichtspalten findet (Hinweiszeilen
// davor sind erlaubt). Ohne Treffer: reiter null, kopfzeile = erste nichtleere Zeile (sonst 0).
export function erkenneReiter(rows) {
  const kopf = rows.slice(0, 5);
  for (let z = 0; z < kopf.length; z++) {
    const zelle = kopf[z].map(norm);
    for (const reiter of REITER) {
      const spalten = spaltenFuer(reiter, zelle);
      if (vollstaendig(reiter, spalten)) return { reiter, kopfzeile: z, spalten };
    }
  }
  const erste = kopf.findIndex(r => r.some(c => norm(c) !== ''));
  return { reiter: null, kopfzeile: Math.max(erste, 0), spalten: {} };
}

// ---------------------------------------------------------------------------------------------
// Zeilen auswerten

// Feste Farbliste (eigene Entscheidung); de/en/key werden in der Farbspalte erkannt.
export const FARBEN = [
  { key: 'rot', de: 'Rot', en: 'Red', hex: '#e5484d' },
  { key: 'orange', de: 'Orange', en: 'Orange', hex: '#f28c28' },
  { key: 'gelb', de: 'Gelb', en: 'Yellow', hex: '#eab308' },
  { key: 'gruen', de: 'Grün', en: 'Green', hex: '#22c55e' },
  { key: 'tuerkis', de: 'Türkis', en: 'Teal', hex: '#14b8a6' },
  { key: 'blau', de: 'Blau', en: 'Blue', hex: '#3b82f6' },
  { key: 'lila', de: 'Lila', en: 'Purple', hex: '#a855f7' },
  { key: 'pink', de: 'Pink', en: 'Pink', hex: '#ec4899' },
  { key: 'braun', de: 'Braun', en: 'Brown', hex: '#a07845' },
  { key: 'grau', de: 'Grau', en: 'Grey', hex: '#9aa3ad' },
  { key: 'schwarz', de: 'Schwarz', en: 'Black', hex: '#1c1d20' },
  { key: 'weiss', de: 'Weiß', en: 'White', hex: '#f5f5f5' },
];

const MAX_ZEILEN = 2000;
const ROLLEN_H = 13; // cm, wie die Vorlagen (Blue Wheel Ø 100 mm)
const JA = ['ja', 'yes', 'x', '1', 'wahr', 'true'];
const NEIN = ['nein', 'no', '0', 'falsch', 'false'];

// „1.200“ oder „1.200,5“: deutscher Tausenderpunkt oder englische Dezimalzahl? Unklar, also keine Zahl
// (eigene Entscheidung: lieber rot als stillschweigend 1,2 statt 1200).
const TAUSENDER = /^[+-]?[1-9]\d{0,2}(\.\d{3})+(,\d+)?$/;
const ZAHL = /^[+-]?\d+([.,]\d+)?$/;

// einheit = die für das Feld erwartete Einheit ('cm', 'kg'); '' = keine erlaubt. Ohne Angabe gelten
// cm und kg. Eine andere Einheit macht den Wert zur Nicht-Zahl (nicht raten).
export function zahl(s, einheit) {
  let x = String(s ?? '').trim();
  const re = new RegExp(`\\s*(${einheit === undefined ? 'cm|kg' : einheit})$`, 'i');
  const einheitEntfernt = (einheit !== '') && re.test(x);
  if (einheitEntfernt) x = x.replace(re, '');
  if (TAUSENDER.test(x) || !ZAHL.test(x)) return { wert: null, einheitEntfernt };
  return { wert: Number(x.replace(',', '.')), einheitEntfernt };
}

const label = (reiter, key) => {
  const sg = SPALTEN[reiter].find(x => x.key === key);
  return lang === 'en' ? sg.en : sg.de;
};

function gewerkVon(roh) {
  const x = norm(roh);
  if (x === '') return { name: 'Sonstiges', bekannt: true };
  const hit = CATEGORIES.find(c => norm(c.name) === x || norm(GEWERKE_EN[c.name]) === x);
  return hit ? { name: hit.name, bekannt: true } : { name: String(roh).trim(), bekannt: false };
}

function farbeVon(roh, gewerk) {
  const x = norm(roh);
  if (x === '') return { hex: colorFor(gewerk), angegeben: false, bekannt: true };
  if (/^#[0-9a-f]{6}$/.test(x)) return { hex: x, angegeben: true, bekannt: true };
  const f = FARBEN.find(c => [c.key, norm(c.de), norm(c.en)].includes(x));
  return f ? { hex: f.hex, angegeben: true, bekannt: true } : { hex: colorFor(gewerk), angegeben: false, bekannt: false };
}

function ja_nein(roh, leer) {
  const x = norm(roh);
  if (x === '') return leer;
  if (JA.includes(x)) return true;
  if (NEIN.includes(x)) return false;
  return null;
}

// Berechnet Befunde und (ohne rote Befunde) den Entwurf aus den Werten.
function auswerten(e) {
  const { reiter } = e;
  const befunde = [];
  const werte = e.werte;
  const roh = k => String(werte[k] ?? '').trim();
  const rot = (feld, text) => befunde.push({ feld, stufe: 'rot', text });
  const gelb = (feld, text) => befunde.push({ feld, stufe: 'gelb', text });
  const feldName = k => label(reiter, k);
  if (reiter !== 'cases' && reiter !== 'set') return { befunde, entwurf: null };

  const name = roh('name');
  if (name === '') rot('name', t('Name fehlt.'));
  else if (name.length > NAME_MAX) rot('name', t('Name ist länger als {max} Zeichen.', { max: NAME_MAX }));

  // Zahl mit Grenzen; leer → null (Aufrufer entscheidet), Fehler als roter Befund
  const messen = (key, einheit, { min, max, minIncl }) => {
    const s = roh(key);
    const feld = feldName(key);
    const z = zahl(s, einheit);
    if (z.wert === null) {
      rot(key, TAUSENDER.test(s) ? t('„{feld}“ ist unklar: „{wert}“ (Tausenderpunkt oder Dezimalpunkt?). Bitte ohne Punkt schreiben.', { feld, wert: s })
        : t('„{feld}“ ist keine Zahl: „{wert}“.', { feld, wert: s }));
      return null;
    }
    if (minIncl ? z.wert < min : z.wert <= min) {
      rot(key, minIncl ? t('„{feld}“ darf nicht negativ sein.', { feld }) : t('„{feld}“ muss größer als 0 sein.', { feld }));
      return null;
    }
    if (z.wert > max) { rot(key, t('„{feld}“ ist größer als {max}.', { feld, max })); return null; }
    if (z.einheitEntfernt) gelb(key, t('„{feld}“: Einheit entfernt, Wert {wert} übernommen.', { feld, wert: z.wert }));
    return z.wert;
  };
  const mass = (key, max) => {
    if (roh(key) === '') { rot(key, t('„{feld}“ fehlt.', { feld: feldName(key) })); return null; }
    return messen(key, 'cm', { min: 0, max });
  };
  const w = mass('breite', CASE_LIMITS.w);
  const l = mass('tiefe', CASE_LIMITS.l);
  const h = mass('hoehe', CASE_LIMITS.h);

  let menge = 1;
  if (roh('menge') === '') gelb('menge', t('Menge fehlt, 1 angenommen.'));
  else {
    const z = zahl(roh('menge'), '').wert;
    if (z === null || !Number.isInteger(z) || z < 1 || z > CASE_LIMITS.stock) {
      rot('menge', t('Menge muss eine ganze Zahl von 1 bis {max} sein.', { max: CASE_LIMITS.stock }));
      menge = null;
    } else menge = z;
  }

  let weight = 0;
  if (roh('gewicht') !== '') weight = messen('gewicht', 'kg', { min: 0, max: CASE_LIMITS.weight, minIncl: true });

  let layers = [1, 2];
  if (roh('lage') === '') gelb('lage', t('Höchste Lage fehlt, Lage 1 und 2 angenommen.'));
  else {
    const z = zahl(roh('lage'), '').wert;
    if (z === null || ![1, 2, 3].includes(z)) { rot('lage', t('Höchste Lage muss 1, 2 oder 3 sein.')); layers = null; }
    else layers = Array.from({ length: z }, (_, i) => i + 1);
  }

  let wheels = false;
  let tippable = false;
  if (reiter === 'cases') {
    wheels = ja_nein(werte.rollen, true);
    if (wheels === null) rot('rollen', t('„{feld}“ muss ja oder nein sein: „{wert}“.', { feld: feldName('rollen'), wert: roh('rollen') }));
    else if (wheels && h !== null && !(ROLLEN_H < h)) {
      wheels = false;
      gelb('rollen', t('Rollen ignoriert: Die Höhe ({h} cm) ist nicht größer als die Rollenhöhe ({rollen} cm).', { h, rollen: ROLLEN_H }));
    }
    tippable = ja_nein(werte.tippen, false);
    if (tippable === null) rot('tippen', t('„{feld}“ muss ja oder nein sein: „{wert}“.', { feld: feldName('tippen'), wert: roh('tippen') }));
  }

  const gewerk = gewerkVon(roh('gewerk'));
  if (!gewerk.bekannt) gelb('gewerk', t('Gewerk „{wert}“ ist unbekannt und wird als eigener Name übernommen.', { wert: gewerk.name }));
  const farbe = farbeVon(roh('farbe'), gewerk.name);
  if (!farbe.bekannt) gelb('farbe', t('Farbe „{wert}“ nicht erkannt, Gewerkfarbe verwendet.', { wert: roh('farbe') }));

  if (befunde.some(b => b.stufe === 'rot')) return { befunde, entwurf: null };
  const c = {
    name, l, w, h, weight, category: gewerk.name, color: farbe.hex, layers,
    wheels, dimsInclWheels: true, tippable, herkunft: 'import',
  };
  c.wheelH = wheels ? ROLLEN_H : 0;
  if (reiter === 'set') Object.assign(c, { kind: 'set', wheels: false, tippable: false, wheelH: 0 });
  return { befunde, entwurf: { case: c, menge, tipped: reiter === 'cases' && tippable } };
}

// Eintrag mit neu berechneten Befunden (die Liste ruft das nach jeder Zelländerung).
export const pruefeEintrag = e => ({ ...e, befunde: auswerten(e).befunde });

// Case-Entwurf ohne ID (vergibt der Import); null, wenn der Eintrag rote Befunde hat.
export const entwurfAus = e => auswerten(e).entwurf;

// rows = alle Zeilen der Tabelle, kopf = Ergebnis von erkenneReiter. Zeilennummern 1-basiert (Excel).
export function werteZeilen(reiter, rows, kopf) {
  const eintraege = [];
  for (let i = kopf.kopfzeile + 1; i < rows.length; i++) {
    const zellen = rows[i];
    if (zellen.every(c => String(c ?? '').trim() === '')) continue;
    if (eintraege.length >= MAX_ZEILEN) throw new Error(t('Die Tabelle hat mehr als {max} Zeilen.', { max: MAX_ZEILEN }));
    const werte = {};
    for (const sg of SPALTEN[reiter]) {
      const j = kopf.spalten[sg.key];
      werte[sg.key] = j === undefined ? '' : String(zellen[j] ?? '').trim();
    }
    eintraege.push(pruefeEintrag({ zeile: i + 1, reiter, werte, befunde: [] }));
  }
  return eintraege;
}

// Je ausdrücklich angegebener Farbe das Mehrheitsgewerk (ab 60 % und 5 Zeilen, eigene Entscheidung);
// Zeilen mit anderem Gewerk sind auffällig (vermutlich Tippfehler im Gewerk oder in der Farbe).
export function farbAuffaelligkeiten(eintraege) {
  const nachFarbe = new Map();
  for (const e of eintraege) {
    const g = gewerkVon(e.werte.gewerk ?? '').name;
    const f = farbeVon(e.werte.farbe ?? '', g);
    if (!f.angegeben) continue;
    if (!nachFarbe.has(f.hex)) nachFarbe.set(f.hex, []);
    nachFarbe.get(f.hex).push({ zeile: e.zeile, gewerk: g });
  }
  const out = [];
  for (const [farbe, liste] of nachFarbe) {
    const zaehler = new Map();
    for (const x of liste) zaehler.set(x.gewerk, (zaehler.get(x.gewerk) ?? 0) + 1);
    const [mehrheit, n] = [...zaehler].sort((a, b) => b[1] - a[1])[0];
    if (n < 5 || n / liste.length < 0.6) continue;
    const andere = liste.filter(x => x.gewerk !== mehrheit);
    // je abweichendem Gewerk ein Eintrag
    for (const gewerk of new Set(andere.map(x => x.gewerk))) {
      out.push({ farbe, gewerk, mehrheit, zeilen: andere.filter(x => x.gewerk === gewerk).map(x => x.zeile) });
    }
  }
  return out;
}
