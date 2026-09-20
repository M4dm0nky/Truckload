// Farben eines Cases je nach Anzeigemodus – einzige Quelle für 2D, 3D und Druck.
export const CASE_BLACK = '#1c1d20';
export const COLOR_MODES = ['black', 'trade'];
export function caseColors(c, mode, itemColor) {
  const color = itemColor ?? c.color;
  return mode === 'trade' ? { body: color, stripe: null } : { body: CASE_BLACK, stripe: color };
}
