// Farben eines Cases je nach Anzeigemodus – einzige Quelle für 2D, 3D und Druck.
export const CASE_BLACK = '#1c1d20';
// cm, ab dieser kleinsten Korpus-Kantenlänge zeichnen 2D und 3D Flightcase-Details
// (Profile, Kugelecken, Deckelfuge, Griffe) statt eines einfachen Kastens.
export const DETAIL_MIN = 40;
export const COLOR_MODES = ['black', 'trade'];
// `itemColor ?? c.color` sieht wie die dritte Kopie derselben toten Rückfallkette aus, die N5
// (docs/code-review-2026-09-21.md, Nachtrag Controller) an view2d.js/view3d.js bemängelt hat –
// beide heutigen Aufrufer übergeben bereits `it.color`, das den Rückfall auf die Gewerkfarbe
// über `buildItems()` (js/model/validate.js: `p.color ?? c.color`) schon trägt. Anders als dort
// ist der Rückfall HIER aber Teil der öffentlichen Signatur dieser Funktion, nicht eine
// zusätzliche Kopie einer fremden Regel: `caseColors(c, mode)` ohne dritten Parameter ist ein
// eigenständig getesteter, gültiger Aufruf (tests/caseStyle.test.js, „ohne itemColor bleibt es
// beim bisherigen Verhalten“) – ein Entfernen würde diesen Vertrag brechen, nicht nur doppelten
// Code beseitigen. Bewusst NICHT zusammengeführt.
export function caseColors(c, mode, itemColor) {
  const color = itemColor ?? c.color;
  return mode === 'trade' ? { body: color, stripe: null } : { body: CASE_BLACK, stripe: color };
}
