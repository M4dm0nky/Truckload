// Alle Grenzwerte der Modellschicht an einem Ort. Import-Prüfung (js/store/io.js), Aktionen
// (js/model/actions.js) und Oberfläche (`max`/`maxlength`-Attribute) lesen dieselben Zahlen,
// damit die App nichts erzeugt, was ihr eigener Import ablehnt. Importiert nichts.

// Obergrenzen für Case-Werte aus fremden Dateien. Großzügig, aber so, dass Unsinn
// (ein 100 m langes, 100 t schweres Case) auffällt. Auch für die `max=`-Attribute
// im Case-Editor benutzt, damit Oberfläche und Import nicht auseinanderlaufen.
export const CASE_LIMITS = {
  l: 2000, w: 2000, h: 2000, // cm
  weight: 50000, // kg
  wheelH: 200, // cm
  maxTopLoad: 50000, // kg
  stock: 9999, // Stück
};

// Traversenwagen-Werte (cm bzw. Stück). `width` ist die Grenze der klassischen, stapelnden
// Wagen-Variante und gleich MAX_TRUSS_WIDTH in truss.js (Test in tests/limits.test.js);
// `standingWidth` gilt für stehende Pre-Rig-Traversen (Standfläche).
export const TRUSS_LIMITS = { length: 1000, width: 40, standingWidth: 200, count: 12, wagonW: 200 };

// Höchstlänge einer Beschriftung oder Gruppe (Platzierung oder Ablage-Eintrag).
export const MAX_LABEL = 40;
// Firmenname: ein längerer Name machte die eigene Sicherung unimportierbar
// (parseBundle ist alles oder nichts).
export const MAX_FIRM = 80;
// Name eines Regelsets (Pack-Regeln). Zufällig ebenfalls 80, aber eine eigene Bedeutung.
export const MAX_RULESET_NAME = 80;

// Gültig: Array, nicht leer, nur Ganzzahlen 1–4, keine Duplikate. Die Oberfläche verhindert das
// bereits selbst (Checkboxen 1–4), Import und Aktion schützen sich trotzdem gegen fremde Daten.
export const layersValid = layers =>
  Array.isArray(layers) && layers.length > 0
  && layers.every(n => Number.isInteger(n) && n >= 1 && n <= 4)
  && new Set(layers).size === layers.length;
