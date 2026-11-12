// Ladeliste (Tabellen-Import, Stufe 1): reine Logik ohne DOM. Erkennt den Reiter einer Tabelle an
// der Kopfzeile (Task 2) und wertet die Zeilen aus (Task 3). Die Kopfzeilen und Farbwörter in
// beiden Sprachen sind Erkennungsdaten, keine Anzeigetexte (ALLOW in tests/i18n.test.js).

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
