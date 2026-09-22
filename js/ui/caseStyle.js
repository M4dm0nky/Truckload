// Farben eines Cases je nach Anzeigemodus – einzige Quelle für 2D, 3D und Druck.
export const CASE_BLACK = '#1c1d20';
// cm, ab dieser kleinsten Korpus-Kantenlänge zeichnen 2D und 3D Flightcase-Details
// (Profile, Kugelecken, Deckelfuge, Griffe) statt eines einfachen Kastens.
export const DETAIL_MIN = 40;
export const COLOR_MODES = ['black', 'trade'];
export function caseColors(c, mode, itemColor) {
  const color = itemColor ?? c.color;
  return mode === 'trade' ? { body: color, stripe: null } : { body: CASE_BLACK, stripe: color };
}
