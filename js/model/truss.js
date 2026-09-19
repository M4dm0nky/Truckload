export const DOLLY_H = 22;       // Wagen inkl. Rollen (cm)
export const DOLLY_WIDTHS = [60, 80];
export const TRUSS_PROFILES = [{ name: '34er (F34)', width: 29 }, { name: '40er (F44)', width: 40 }];

export function trussDims({ length, width, count }) {
  const perRow = 2;
  const w = perRow * width <= DOLLY_WIDTHS[0] ? DOLLY_WIDTHS[0] : DOLLY_WIDTHS[1];
  const h = DOLLY_H + Math.ceil(count / perRow) * width;
  return { l: length, w, h };
}

export const isTruss = c => c.kind === 'truss';

export const DOLLY_L = 60;         // Länge eines Rollwagens (cm)
export const DOLLY_WHEEL_D = 10;   // Rollen-Durchmesser am Wagen (cm)
export const TUBE_R_RATIO = 0.085; // Gurtrohr-Radius = Traversenbreite × Faktor (F34: 50 mm Ø / 29 cm)
export const DIAG_R_RATIO = 0.035; // Diagonalen-Radius (F34: 20 mm Ø / 29 cm)
const PER_ROW = 2;                 // Traversenstücke nebeneinander pro Lage

// Reine Geometrie eines platzierten Traversenwagens: zwei Rollwagen an den Enden (über die volle
// Wagenbreite, mit je 4 Rollen), darauf `count` Traversenstücke – 2 nebeneinander, Lagen übereinander,
// jedes Stück über die volle Länge (liegt auf beiden Wagen auf). `box` ist die platzierte Box
// (x0…z1, Truck-Koordinaten); `p.rot` bestimmt, ob die Traversenlänge entlang x oder y verläuft.
export function trussShape(c, p, box) {
  const { width, count } = c.truss;
  const rot90 = ((p.rot ?? 0) % 180) === 90;
  const lenAxis = rot90 ? 'y' : 'x';
  const widAxis = rot90 ? 'x' : 'y';

  const len0 = box[`${lenAxis}0`], len1 = box[`${lenAxis}1`];
  const wid0 = box[`${widAxis}0`], wid1 = box[`${widAxis}1`];
  const dollyW = wid1 - wid0;
  const z0 = box.z0, dollyZ1 = z0 + DOLLY_H;

  const mk = (lenR, widR, zR) => ({
    [`${lenAxis}0`]: lenR[0], [`${lenAxis}1`]: lenR[1],
    [`${widAxis}0`]: widR[0], [`${widAxis}1`]: widR[1],
    z0: zR[0], z1: zR[1],
  });

  const dollyLen = Math.min(DOLLY_L, (len1 - len0) / 2);
  const dollies = [
    mk([len0, len0 + dollyLen], [wid0, wid1], [z0, dollyZ1]),
    mk([len1 - dollyLen, len1], [wid0, wid1], [z0, dollyZ1]),
  ];

  // Bei sehr kurzen Wagen (kurze Traverse -> kurzer dollyLen, s. o.) Rollen-Durchmesser und
  // -Abstand so begrenzen, dass die 2 Rollen je Kante nie überlappen oder über den Wagen hinausragen.
  const wheelD = Math.min(DOLLY_WHEEL_D, dollyLen / 3, dollyW / 3);
  const inset = Math.max(0, Math.min(DOLLY_WHEEL_D * 0.3, (Math.min(dollyLen, dollyW) - 2 * wheelD) / 2));
  const wheels = [];
  for (const d of dollies) {
    const dLen0 = d[`${lenAxis}0`], dLen1 = d[`${lenAxis}1`];
    for (const le of [0, 1]) for (const wi of [0, 1]) {
      const l0 = le ? dLen1 - inset - wheelD : dLen0 + inset;
      const w0 = wi ? wid1 - inset - wheelD : wid0 + inset;
      wheels.push(mk([l0, l0 + wheelD], [w0, w0 + wheelD], [z0, z0 + wheelD]));
    }
  }

  const rows = Math.max(1, Math.ceil(count / PER_ROW));
  const pieces = [];
  let remaining = count;
  for (let row = 0; row < rows; row++) {
    const inRow = Math.min(PER_ROW, remaining);
    remaining -= inRow;
    const rowZ0 = dollyZ1 + row * width, rowZ1 = rowZ0 + width;
    const total = inRow * width;
    const offset = (dollyW - total) / 2;
    for (let col = 0; col < inRow; col++) {
      const w0 = wid0 + offset + col * width, w1 = w0 + width;
      pieces.push(mk([len0, len1], [w0, w1], [rowZ0, rowZ1]));
    }
  }

  return { lenAxis, widAxis, dollies, wheels, pieces };
}
