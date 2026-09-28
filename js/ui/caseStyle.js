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

// Kugelecken, gemeinsam für 2D, 3D und Druck. Das gemessene Außenmaß eines Cases enthält die
// Ecken schon – sie dürfen also nicht darüber hinausragen. Bis V0.8.1 saßen sie mittig auf der
// Case-Ecke (2D r = 6 cm, 3D r = 4 cm) und standen als „richtige Bälle“ bis zu 6 cm über
// (Nutzer-Feedback 2026-09-28: „in echt stehen die kaum raus“). Jetzt liegt der Mittelpunkt um r
// nach innen versetzt, die Kugel berührt die Außenkante nur. Die Größe ist eine eigene, rein
// optische Festlegung.
export const CORNER_R = 2;        // cm, Flightcase mit Details
export const CORNER_R_SIMPLE = 1.5; // cm, einfacher Kasten (kleine Cases)

// 2D: Rechteck { u0, v0, u1, v1 } -> [[cx, cy] × 4]; bei sehr kleinen Rechtecken höchstens bis zur Mitte.
export function cornerCenters(rect, r) {
  const du = Math.min(r, (rect.u1 - rect.u0) / 2), dv = Math.min(r, (rect.v1 - rect.v0) / 2);
  return [
    [rect.u0 + du, rect.v0 + dv], [rect.u1 - du, rect.v0 + dv],
    [rect.u0 + du, rect.v1 - dv], [rect.u1 - du, rect.v1 - dv],
  ];
}

// 3D: Box { x0…z1 } -> 8 Punkte { x, y, z }.
export function cornerCenters3d(b, r) {
  const d = a => Math.min(r, (b[`${a}1`] - b[`${a}0`]) / 2);
  const out = [];
  for (const x of [b.x0 + d('x'), b.x1 - d('x')])
    for (const y of [b.y0 + d('y'), b.y1 - d('y')])
      for (const z of [b.z0 + d('z'), b.z1 - d('z')]) out.push({ x, y, z });
  return out;
}
