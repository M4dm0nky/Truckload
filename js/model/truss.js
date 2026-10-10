import { cornerBoxes } from './geometry.js';

export const DOLLY_WHEEL_H = 12; // Rollenbereich: 100-mm-Lenkrolle + Anschraubplatte (cm)
export const DOLLY_BOARD_H = 3;  // Plattenstärke des Rollbretts (cm, entspricht 20–25 mm real)
export const DOLLY_RAIL_H = 2;   // Höhe der Auflageleisten obenauf der Platte (cm)
export const DOLLY_H = DOLLY_WHEEL_H + DOLLY_BOARD_H + DOLLY_RAIL_H; // Wagen inkl. Rollen (cm)
export const DOLLY_WIDTHS = [60, 80];
export const TRUSS_PROFILES = [
  { name: '34er (F34)', width: 29 },
  { name: '40er (F44)', width: 40 },
];

// Breitengrenze, die trussDims voraussetzt: 2 Stück nebeneinander müssen auf den breiteren
// Wagen (DOLLY_WIDTHS.at(-1)) passen, sonst ragen die Traversenstücke aus dem Wagen.
export const MAX_TRUSS_WIDTH = DOLLY_WIDTHS.at(-1) / 2;

// Pre-Rig-Traversen (H.O.F. MLT/Prolyte S36PR, standing:true): EIN Stück ist IMMER EINE stehende
// Traverse auf Beinen bzw. Rollwagen, keine gestapelten Stücke wie beim F34/F40-Wagen – width/
// height sind hier direkt die Außenmaße (Standfläche/Standhöhe). MAX_TRUSS_WIDTH gilt nur für die
// stapelnde Wagen-Variante.
//
// `wagonW` (optional): Wagenbreite der jeweiligen Firma. Ohne sie gilt die Automatik 60/80 cm,
// alte Daten laden also unverändert. Eine eigene Breite muss die zwei Stück nebeneinander
// aufnehmen, sonst ragen sie heraus.
export function trussDims({ length, width, count, standing, height, wagonW }) {
  if (standing) return { l: length, w: width, h: height };
  if (width > MAX_TRUSS_WIDTH)
    throw new Error(`Traversenbreite ${width} cm überschreitet die Grenze von ${MAX_TRUSS_WIDTH} cm.`);
  const perRow = 2;
  if (wagonW != null && wagonW < perRow * width)
    throw new Error(`Wagenbreite ${wagonW} cm ist schmaler als zwei Traversenstücke (${perRow * width} cm).`);
  const w = wagonW ?? (perRow * width <= DOLLY_WIDTHS[0] ? DOLLY_WIDTHS[0] : DOLLY_WIDTHS[1]);
  const h = DOLLY_H + Math.ceil(count / perRow) * width;
  return { l: length, w, h };
}

// Sucht einen vorhandenen Traversenwagen-Case-Typ, der zu `spec` passt, damit der Dialog keinen
// zweiten gleichen anlegt. spec: { width (Profil), length, count (Stück je Wagen), wagonW?,
// company, inStock }. Eigene Entscheidung zur Wiederverwendung:
// - Ein Treffer ist immer ein Wagen (kind 'truss', nicht standing), nie `legacy`, mit gleichem
//   Profil, gleicher Länge, gleicher Stückzahl und gleicher Wagenbreite (wie trussDims sie ergäbe).
// - Mit Häkchen „im Materialbestand“ (spec.inStock): nur Bestandsfälle (nicht onlyInPlan) derselben
//   Firma; fehlende Firma = Standardliste und passt nur zu einer Spec ohne Firma.
// - Ohne Häkchen (nur für diesen Load): nur vorhandene onlyInPlan-Wagen (die ohnehin keine Firma
//   tragen); Bestandsfälle fremder Firmen werden nie genommen – sonst stünde ein Fremdbestand im Load.
export function findMatchingWagon(cases, spec) {
  const w = trussDims({ length: spec.length, width: spec.width, count: spec.count, wagonW: spec.wagonW }).w;
  const company = spec.company || '';
  return cases.find(c => {
    if (c.kind !== 'truss' || !c.truss || c.truss.standing || c.legacy) return false;
    if (c.truss.width !== spec.width || c.truss.length !== spec.length || c.truss.count !== spec.count || c.w !== w) return false;
    return spec.inStock ? !c.onlyInPlan && (c.company || '') === company : c.onlyInPlan === true && !c.company;
  });
}

export const DOLLY_L = 60;         // Länge eines Rollwagens (cm)
const DOLLY_WHEEL_D = 10;   // Rollen-Durchmesser am Wagen (cm)
export const TUBE_R_RATIO = 0.085; // Gurtrohr-Radius = Traversenbreite × Faktor (F34: 50 mm Ø / 29 cm)
export const DIAG_R_RATIO = 0.035; // Diagonalen-Radius (F34: 20 mm Ø / 29 cm)

// Gewichtsformel für Traversenwagen: kg pro Meter je Profilbreite + Wagen-Grundgewicht (Paar Dollies)
export const TRUSS_KG_PER_M = { 29: 6, 40: 8 };
export const TRUSS_DOLLY_KG = 2 * 12;

export function wagonWeight(length, width, count) {
  return Math.round((length / 100) * count * TRUSS_KG_PER_M[width] + TRUSS_DOLLY_KG);
}

// Teilt eine Gesamtstückzahl auf Wägen mit maximal `perWagon` Stück auf: volle Wägen zuerst, ein
// letzter Restwagen falls nötig. splitWagons(16, 8) → [8, 8]; splitWagons(17, 8) → [8, 8, 1].
// Wirft bei ungültigen Eingaben (≤ 0), damit ein Tippfehler nicht zu einem Wagen mit 0 Stück führt.
export function splitWagons(total, perWagon) {
  if (!(total > 0) || !(perWagon > 0)) throw new Error('Stückzahl und Stück je Wagen müssen größer als 0 sein.');
  const full = Math.floor(total / perWagon);
  const rest = total % perWagon;
  return [...Array(full).fill(perWagon), ...(rest ? [rest] : [])];
}

const PER_ROW = 2;                 // Traversenstücke nebeneinander pro Lage
const RAIL_W = 3;                  // Nenn-Breite einer Auflageleiste (cm), bei schmalen Spuren begrenzt

// Maße für stehende Pre-Rig-Traversen (standing:true), recherchiert an Herstellerfotos/
// -bemaßungszeichnungen (docs/mlt-truss-gewichte.md): Rechteck-Querschnitt statt Quadratrohr
// (H.O.F. 608×356 mm, Prolyte S36PR 610×360 mm – beide praktisch gleich), auf 4 Eckbeinen über
// einer schmalen Grundplatte mit Rollen. STAND_FOOTPRINT_W ist die Bein-/Rollen-Spurbreite, nicht
// der Traversenquerschnitt. Nutzerangabe: genau 4 Stück passen nebeneinander in einen normalen
// 40-Tonner (Sattelauflieger, 248 cm Innenbreite, s. preset-trucks.js) -> 248 / 4 = 62 cm.
export const STAND_FOOTPRINT_W = 62; // Standfläche (cm) – Case-Breite `w`
export const STAND_TRUSS_W = 60;     // sichtbare Traversenbreite (cm)
export const STAND_TRUSS_H = 35;     // sichtbare Traversenhöhe (cm)
const STAND_BASE_H = 7;              // Holmhöhe (cm) – mit STAND_WHEEL_D zusammen 17 cm
                                      // Boden bis Unterkante Dolly (Bemaßungszeichnung „Pos. 1“)
const STAND_RAIL_W = 10;             // Holmbreite (cm) – zwei schmale Holme statt Rollbrett
const STAND_LEG_D = 6;               // Beindicke (cm)
const STAND_WHEEL_D = 10;            // Rollendurchmesser (cm)
// Die Traverse ist immer das breiteste Teil, der Dolly etwas schmaler (Nutzerangabe 2026-09-26).
// Um wie viel, ist nicht bekannt – 2 cm je Seite ist eine eigene, rein optische Annahme; das
// Packen rechnet weiter mit der Standfläche STAND_FOOTPRINT_W.
const STAND_DOLLY_INSET = 2;         // Einzug des Dollys gegenüber der Traverse je Seite (cm)

// Reine Geometrie eines platzierten Traversenwagens: zwei Rollwagen an den Enden (über die volle
// Wagenbreite, mit je 4 Rollen), darauf `count` Traversenstücke – 2 nebeneinander, Lagen übereinander,
// jedes Stück über die volle Länge (liegt auf beiden Wagen auf). Jeder Rollwagen ist ein flaches
// Rollbrett: unten der Rollenbereich (`DOLLY_WHEEL_H`), darüber die Platte (`DOLLY_BOARD_H`) und
// die Auflageleisten (`DOLLY_RAIL_H`) je Traversenspur. Die Traverse liegt AUF den Leisten (so
// passt ein Gurt darunter); die Leisten sitzen unter den beiden Gurtrohr-Linien, damit sie die
// Rohre sichtbar tragen. `dollies` bleibt das volle Wagenvolumen (Bezugsfläche/Beschriftung).
// `box` ist die platzierte Box (Truck-Koordinaten); `p.rot` bestimmt, ob die Traversenlänge
// entlang x oder y verläuft.
export function trussShape(c, p, box) {
  if (c.truss.standing) return standingTrussShape(c.truss, p, box);
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
  // cornerBoxes() (geometry.js) teilt sich den Kern mit caseShape(); Durchmesser und Randabstand
  // sind hier auf einen festen Wert gedeckelt, in caseShape skalieren sie mit dem Durchmesser.
  const wheels = dollies.flatMap(d => cornerBoxes(d, [lenAxis, widAxis, 'z'], wheelD, inset, [z0, z0 + wheelD]));

  const rows = Math.max(1, Math.ceil(count / PER_ROW));
  const pieces = [];
  const tracks = []; // Spurbreiten [w0, w1] der untersten Lage, für die Auflageleisten
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
      if (row === 0) tracks.push([w0, w1]);
    }
  }

  // Platte (Rollbrett) je Wagen: volle Wagenbreite/-länge, zwischen Rollenbereich und Leisten.
  const boardZ0 = z0 + DOLLY_WHEEL_H, boardZ1 = boardZ0 + DOLLY_BOARD_H; // = dollyZ1 - DOLLY_RAIL_H
  const boards = dollies.map(d => ({ ...d, z0: boardZ0, z1: boardZ1 }));

  // Auflageleisten obenauf der Platte, unter den beiden Gurtrohr-Linien der Spur (um den
  // Gurtrohr-Radius von den Spurkanten nach innen versetzt). Sie tragen die Traverse, die genau auf
  // ihrer Oberkante (`dollyZ1`) beginnt. Breite begrenzt, damit sich die beiden Leisten einer Spur
  // nie überlappen oder über sie hinausragen.
  const chordInset = Math.min(width * TUBE_R_RATIO, width / 2); // Versatz der Gurtrohr-Linie von der Spurkante
  const rails = [];
  for (const d of dollies) {
    const dLen0 = d[`${lenAxis}0`], dLen1 = d[`${lenAxis}1`];
    for (const [tw0, tw1] of tracks) {
      const gap = (tw1 - tw0) - 2 * chordInset; // Abstand zwischen den beiden Gurtrohr-Linien
      const railW = Math.max(0, Math.min(RAIL_W, gap, 2 * chordInset));
      if (railW <= 0) continue;
      const c0 = tw0 + chordInset, c1 = tw1 - chordInset;
      rails.push(mk([dLen0, dLen1], [c0 - railW / 2, c0 + railW / 2], [boardZ1, dollyZ1]));
      rails.push(mk([dLen0, dLen1], [c1 - railW / 2, c1 + railW / 2], [boardZ1, dollyZ1]));
    }
  }

  return { lenAxis, widAxis, dollies, wheels, pieces, boards, rails };
}

// Geometrie einer stehenden Pre-Rig-Traverse (H.O.F. MLT/Prolyte S36PR): schmale Grundplatte mit
// Rollen an den 4 Ecken ganz unten, darüber 4 Beine bis zur Traverse, die mittig als oberer
// Abschluss das breiteste Teil ist (der Dolly ist um STAND_DOLLY_INSET je Seite schmaler).
// Gleicher Rückgabe-Vertrag wie die Wagen-Variante (`dollies`/`wheels`/`pieces`/`boards`/`rails`),
// damit view2d.js/view3d.js ohne Fallunterscheidung zeichnen: `boards`/`dollies` sind die eine
// Grundplatte (Bezugsfläche für Beschriftung), `rails` die 4 Beine, `pieces` die eine Traverse.
// `profileWidth` gibt die sichtbare Traversenbreite für die Rohr-Stärke vor, weil `c.truss.width`
// hier die Standfläche meint.
// `truss.frame === 'closed'` (MLT TWO und Prolyte S36PR, Nutzerangabe 2026-09-25): rundum
// geschlossener Alu-Rahmen mit zwei Querholmen an den Stirnseiten, `alu: true` lässt view3d.js den
// Wagen silbern zeichnen. Ohne `frame` (MLT ONE, Altdaten) bleibt es beim offenen Rahmen.
function standingTrussShape(truss, p, box) {
  const rot90 = ((p.rot ?? 0) % 180) === 90;
  const lenAxis = rot90 ? 'y' : 'x';
  const widAxis = rot90 ? 'x' : 'y';

  const len0 = box[`${lenAxis}0`], len1 = box[`${lenAxis}1`];
  const wid0 = box[`${widAxis}0`], wid1 = box[`${widAxis}1`];
  const z0 = box.z0, z1 = box.z1;

  const mk = (lenR, widR, zR) => ({
    [`${lenAxis}0`]: lenR[0], [`${lenAxis}1`]: lenR[1],
    [`${widAxis}0`]: widR[0], [`${widAxis}1`]: widR[1],
    z0: zR[0], z1: zR[1],
  });

  // Rollen an den 4 Ecken der Standfläche, ganz unten – wie beim echten Dolly sitzen sie an den
  // Rahmenenden, nicht mittig eingerückt (Referenz: H.O.F.-MLT-Katalog, „MLT TWO Truss and
  // Folding Dolly“, S. 40/41).
  const truss0 = wid0 + (wid1 - wid0 - STAND_TRUSS_W) / 2, truss1 = truss0 + STAND_TRUSS_W;
  const dolly0 = truss0 + STAND_DOLLY_INSET, dolly1 = truss1 - STAND_DOLLY_INSET;
  const wheelZ1 = z0 + STAND_WHEEL_D;
  const footprint = mk([len0, len1], [dolly0, dolly1], [z0, wheelZ1]);
  const wheels = cornerBoxes(footprint, [lenAxis, widAxis, 'z'], STAND_WHEEL_D, 0, [z0, wheelZ1]);

  // Offener Rahmen statt durchgehendem Rollbrett: der Dolly ist ein Dolly (Füße mit Rollen), kein
  // Rollbrett wie beim F34/F40-Wagen oben (Nutzer-Feedback 2026-09-23, Fotoabgleich H.O.F.-Katalog
  // S. 40/41 – zwei schmale Holme über die volle Länge an den Rändern des Dollys, dazwischen
  // offen, statt einer massiven Platte).
  const railZ0 = wheelZ1, railZ1 = railZ0 + STAND_BASE_H;
  const rail0 = mk([len0, len1], [dolly0, dolly0 + STAND_RAIL_W], [railZ0, railZ1]);
  const rail1 = mk([len0, len1], [dolly1 - STAND_RAIL_W, dolly1], [railZ0, railZ1]);
  const closed = truss.frame === 'closed';
  const cross = closed ? [
    mk([len0, len0 + STAND_RAIL_W], [dolly0 + STAND_RAIL_W, dolly1 - STAND_RAIL_W], [railZ0, railZ1]),
    mk([len1 - STAND_RAIL_W, len1], [dolly0 + STAND_RAIL_W, dolly1 - STAND_RAIL_W], [railZ0, railZ1]),
  ] : [];

  const trussZ0 = Math.max(railZ1, z1 - STAND_TRUSS_H);
  const trussBox = mk([len0, len1], [truss0, truss1], [trussZ0, z1]);
  const legFace = mk([len0, len1], [truss0, truss1], [railZ1, trussZ0]);
  const legs = cornerBoxes(legFace, [lenAxis, widAxis, 'z'], STAND_LEG_D, STAND_LEG_D * 0.5, [railZ1, trussZ0]);

  // `dollies`/`boards` bleibt ein einzelner Holm (rail0) – Bezugsfläche für die Beschriftung, wie
  // bei der Wagen-Variante oben. Der zweite Holm (rail1) ist rein optisch, deshalb bei den Beinen
  // in `rails` mit untergebracht statt einen zweiten, unbeschrifteten Bezugskörper einzuführen.
  return {
    lenAxis, widAxis, dollies: [rail0], wheels, pieces: [trussBox], boards: [rail0],
    rails: [...legs, rail1, ...cross], profileWidth: STAND_TRUSS_W, ...(closed ? { alu: true } : {}),
  };
}
