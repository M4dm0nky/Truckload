// Farben eines Cases je nach Anzeigemodus – einzige Quelle für 2D, 3D und Druck.
export const CASE_BLACK = '#1c1d20';
export const COLOR_MODES = ['black', 'trade'];
export function caseColors(c, mode) {
  return mode === 'trade' ? { body: c.color, stripe: null } : { body: CASE_BLACK, stripe: c.color };
}
