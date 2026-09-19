export const DOLLY_H = 22;       // Wagen inkl. Rollen (cm)
export const DOLLY_WIDTHS = [60, 80];
export const TRUSS_PROFILES = [{ name: '34er (F34)', width: 29 }, { name: '40er (F44)', width: 40 }];

export function trussDims({ length, width, count }) {
  const perRow = 2;
  const w = perRow * width <= 60 ? 60 : 80;
  const h = DOLLY_H + Math.ceil(count / perRow) * width;
  return { l: length, w, h };
}

export const isTruss = c => c.kind === 'truss';
