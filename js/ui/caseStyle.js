import { isTruss } from '../model/geometry.js';

// Farben eines Cases je nach Anzeigemodus – einzige Quelle für 2D, 3D und Druck.
export const CASE_BLACK = '#1c1d20';
// cm, ab dieser kleinsten Korpus-Kantenlänge zeichnen 2D und 3D Flightcase-Details
// (Profile, Kugelecken, Deckelfuge, Griffe) statt eines einfachen Kastens.
export const DETAIL_MIN = 40;
export const COLOR_MODES = ['black', 'trade', 'weight'];
// `itemColor ?? c.color`: der Rückfall bleibt bewusst. Die Aufrufer übergeben schon `it.color`
// (buildItems), aber `caseColors(c, mode)` ohne dritten Parameter ist ein getesteter, gültiger Aufruf.
export function caseColors(c, mode, itemColor) {
  const color = itemColor ?? c.color;
  return mode === 'trade' || mode === 'weight' ? { body: color, stripe: null } : { body: CASE_BLACK, stripe: color };
}

// Schriftfarbe zu einem Hintergrund: hell auf dunkel, dunkel auf hell – gemeinsam für die 3D-Beschriftung,
// die 2D-Beschriftung und den Druck.
export function textColorFor(hex) {
  const s = String(hex || CASE_BLACK).replace('#', '');
  const full = s.length === 3 ? s.split('').map(ch => ch + ch).join('') : s.padStart(6, '0').slice(0, 6);
  const r = parseInt(full.slice(0, 2), 16) || 0, g = parseInt(full.slice(2, 4), 16) || 0, b = parseInt(full.slice(4, 6), 16) || 0;
  const lum = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return lum > 0.55 ? '#111214' : '#f5f5f5';
}

// Grauton für „Gewicht unbekannt“ – fest, unabhängig von der Spanne des aktuellen Loads.
const WEIGHT_UNKNOWN = '#8a8f96';
// Leicht → Blau, schwer → Rot (sRGB-Interpolation, reicht für diese Einfärbung).
const WEIGHT_LIGHT = [0x3b, 0x7d, 0xd8]; // Blau, vgl. Stück-Farbe '#3b7dd8' in den Tests
const WEIGHT_HEAVY = [0xd8, 0x3b, 0x3b]; // Rot

// Spanne der Gewichte EINMAL je Render berechnen, nicht je Stück (sonst O(n²) über die Items).
// Nur Stücke MIT Gewicht (> 0) zählen – 0 kg heißt „unbekannt“, nicht „am leichtesten“, dieselbe
// Regel wie bei der Deckschicht (docs/casemasse-gewichte.md).
// Traversenwagen bleiben draußen: drawTruss/addTruss zeichnen sie in ihrer Markenfarbe. Was nicht
// eingefärbt wird, darf die Skala nicht bestimmen – ein 100-kg-Wagen drückte sonst alle Cases von
// 10–30 kg ins untere Drittel.
export function weightRange(items) {
  let min = Infinity, max = -Infinity;
  for (const it of items) {
    if (isTruss(it.c)) continue;
    const w = it.c.weight;
    if (w > 0) { if (w < min) min = w; if (w > max) max = w; }
  }
  return min === Infinity ? null : { min, max };
}

// kg -> Hex-Farbe. 0 kg oder keine Spanne (kein Stück im Load hat ein Gewicht): neutrales Grau,
// damit „unbekannt“ nicht wie „am leichtesten“ aussieht (Regel s. o.).
export function weightColor(kg, range) {
  if (!(kg > 0) || range === null) return WEIGHT_UNKNOWN;
  const t = range.max === range.min ? 0.5 : (kg - range.min) / (range.max - range.min);
  const mix = (a, b) => Math.round(a + (b - a) * t);
  const [r, g, b] = [0, 1, 2].map(i => mix(WEIGHT_LIGHT[i], WEIGHT_HEAVY[i]));
  return '#' + [r, g, b].map(v => v.toString(16).padStart(2, '0')).join('');
}

// Kugelecken, gemeinsam für 2D, 3D und Druck. Das gemessene Außenmaß enthält die Ecken schon, sie
// dürfen also nicht darüber hinausragen: Der Mittelpunkt liegt um r nach innen versetzt, die Kugel
// berührt die Außenkante nur (Nutzer-Feedback 2026-09-28: „in echt stehen die kaum raus“). Die
// Größe ist eine eigene, rein optische Festlegung.
export const CORNER_R = 2;        // cm, Flightcase mit Details
export const CORNER_R_SIMPLE = 1.5; // cm, einfacher Kasten (kleine Cases)

// 3D: Box { x0…z1 } -> 8 Punkte { x, y, z }.
export function cornerCenters3d(b, r) {
  const d = a => Math.min(r, (b[`${a}1`] - b[`${a}0`]) / 2);
  const out = [];
  for (const x of [b.x0 + d('x'), b.x1 - d('x')])
    for (const y of [b.y0 + d('y'), b.y1 - d('y')])
      for (const z of [b.z0 + d('z'), b.z1 - d('z')]) out.push({ x, y, z });
  return out;
}
