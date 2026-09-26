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

// Breitengrenze, die trussDims stillschweigend voraussetzt: 2 Stück nebeneinander müssen
// auf den breiteren Wagen (DOLLY_WIDTHS.at(-1)) passen. Darüber ragen die Traversenstücke
// aus dem Wagen heraus (docs/code-review-2026-09-21.md, "trussDims erzwingt die
// Breitengrenze nicht, die es selbst voraussetzt").
export const MAX_TRUSS_WIDTH = DOLLY_WIDTHS.at(-1) / 2;

// Pre-Rig-Traversen (H.O.F. MLT/Prolyte S36PR, standing:true): EIN Stück ist IMMER EINE stehende
// Traverse auf Beinen bzw. Rollwagen, keine mehreren gestapelten Stücke wie beim F34/F40-Wagen
// oben – width/height sind hier direkt die Außenmaße (Standfläche/Standhöhe), nicht Eingaben für
// die Wagen-Layout-Formel. Die MAX_TRUSS_WIDTH-Grenze gilt nur für die stapelnde Wagen-Variante
// (2 Stück nebeneinander auf einen Dolly) und ist für stehende Einzelstücke bedeutungslos.
export function trussDims({ length, width, count, standing, height }) {
  if (standing) return { l: length, w: width, h: height };
  if (width > MAX_TRUSS_WIDTH)
    throw new Error(`Traversenbreite ${width} cm überschreitet die Grenze von ${MAX_TRUSS_WIDTH} cm.`);
  const perRow = 2;
  const w = perRow * width <= DOLLY_WIDTHS[0] ? DOLLY_WIDTHS[0] : DOLLY_WIDTHS[1];
  const h = DOLLY_H + Math.ceil(count / perRow) * width;
  return { l: length, w, h };
}

export const isTruss = c => c.kind === 'truss';

// Ob ein Case getippt werden darf: Traversenwagen sind es nie, auch wenn `tippable` an ihnen
// (fehlerhaft) true wäre. `checkCase`/`normalizeCase` (js/store/io.js) und der Case-Editor
// erzwingen `tippable: false` für Traversenwagen bereits an jeder Stelle, an der ein Case
// entsteht oder geladen wird — `canTip` macht dieselbe Regel zusätzlich dort verlässlich, wo
// ein Aufrufer nicht über diese Pfade läuft. Ersetzt das doppelt geschriebene
// `c.tippable && c.kind !== 'truss'` in `actions.js`
// (docs/code-review-2026-09-21.md, „geometry.js:35, actions.js:86,99“). Liegt hier statt in
// geometry.js, weil geometry.js sonst truss.js importieren müsste, während truss.js schon von
// geometry.js benutzte Hilfsfunktionen bräuchte (`cornerBoxes`) — das gäbe einen Zyklus
// zwischen den beiden Modellmodulen.
//
// Strenger als die zwei Ausdrücke, die `canTip` ersetzt (`=== true` statt eines reinen Truthy-
// Checks). Über reguläre Pfade nicht erreichbar: `checkCase`/`normalizeCase` (js/store/io.js)
// erzwingen an jeder Stelle, an der ein Case entsteht oder geladen wird, bereits einen echten
// Boolean. `js/ui/inspector.js` (Tippen-Knopf) und `validate.js` (notTippable-Meldung, s.
// Kommentar dort) prüfen `c.tippable` bewusst weiter truthy statt über `canTip` – nicht aus
// Versehen zwei verschiedene Regeln, sondern weil die Truthy-Prüfung an beiden Stellen schon vor
// `canTip` da war und unter derselben Invariante dasselbe Ergebnis liefert
// (docs/code-review-2026-09-21.md, Nachtrag Controller: „canTip ist strenger als die zwei
// Ausdrücke, die es ersetzt hat“).
export const canTip = c => c.tippable === true && !isTruss(c);

export const DOLLY_L = 60;         // Länge eines Rollwagens (cm)
// Nur in dieser Datei benutzt — nicht mehr exportiert (docs/code-review-2026-09-21.md,
// „zehn zu weit offene Exporte“).
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
// der Traversenquerschnitt selbst – korrigiert nach Nutzerangabe: genau 4 Stück passen nebeneinander
// in einen normalen 40-Tonner (Sattelauflieger, 248 cm Innenbreite, s. preset-trucks.js) ->
// 248 / 4 = 62 cm. Die erste Fassung (80 cm, reine Fotoabschätzung) war zu breit.
export const STAND_FOOTPRINT_W = 62; // Standfläche (cm) – Case-Breite `w`
export const STAND_TRUSS_W = 60;     // sichtbare Traversenbreite (cm)
export const STAND_TRUSS_H = 35;     // sichtbare Traversenhöhe (cm)
const STAND_BASE_H = 7;              // Holmhöhe (cm) – mit STAND_WHEEL_D zusammen 17 cm
                                      // Boden bis Unterkante Dolly (Bemaßungszeichnung „Pos. 1“)
const STAND_RAIL_W = 10;             // Holmbreite (cm) – zwei schmale Holme statt Rollbrett
const STAND_LEG_D = 6;               // Beindicke (cm)
const STAND_WHEEL_D = 10;            // Rollendurchmesser (cm)

// Reine Geometrie eines platzierten Traversenwagens: zwei Rollwagen an den Enden (über die volle
// Wagenbreite, mit je 4 Rollen), darauf `count` Traversenstücke – 2 nebeneinander, Lagen übereinander,
// jedes Stück über die volle Länge (liegt auf beiden Wagen auf). Jeder Rollwagen ist ein flaches
// Rollbrett: unten der Rollenbereich (`DOLLY_WHEEL_H`), darüber die Platte (`DOLLY_BOARD_H`) und
// obenauf die Auflageleisten (`DOLLY_RAIL_H`) je Traversenspur – die Traverse liegt AUF den Leisten
// (nicht zwischen ihnen), die Leisten heben sie von der Platte ab, damit ein Gurt darunterpasst, und
// sitzen unter den beiden Gurtrohr-Linien (nach innen versetzt von den Spurkanten), damit sie die
// Rohre sichtbar tragen statt mit ihnen zu kollidieren. `dollies` bleibt das volle Wagenvolumen
// (Bezugsfläche/Beschriftung). `box` ist die platzierte Box (x0…z1, Truck-Koordinaten); `p.rot`
// bestimmt, ob die Traversenlänge entlang x oder y verläuft.
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
  // cornerBoxes() (geometry.js) ist der mit caseShape() geteilte Kern der Ecken-Platzierung
  // (docs/code-review-2026-09-21.md, „truss.js:59-69 vs. caseShape.js:17-30“); Durchmesser und
  // Randabstand bleiben hier auf einen festen Wert gedeckelt statt wie in caseShape mit dem
  // Durchmesser zu skalieren — das ist der bewusste fachliche Unterschied zwischen beiden.
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

  // Auflageleisten obenauf der Platte, unter den beiden Gurtrohr-Linien der jeweiligen Spur (nach
  // innen versetzt von den Spurkanten um den Gurtrohr-Radius, statt bündig auf den Kanten) – sie
  // tragen die Traverse, die genau auf ihrer Oberkante beginnt (`dollyZ1`), statt in sie hineinzuragen.
  // Breite begrenzt, damit sich die beiden Leisten einer Spur nie überlappen oder über sie hinausragen.
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

// Geometrie einer stehenden Pre-Rig-Traverse (H.O.F. MLT/Prolyte S36PR): eine schmale Grundplatte
// mit Rollen an den 4 Ecken ganz unten, darüber 4 Beine hoch bis zur Traverse, die – schmaler als
// die Standfläche, mittig darüber – den oberen Abschluss bildet. Nutzt denselben Rückgabe-Vertrag
// wie die Wagen-Variante oben (`dollies`/`wheels`/`pieces`/`boards`/`rails`), damit view2d.js/
// view3d.js ohne eigene Fallunterscheidung zeichnen können: `boards`/`dollies` sind hier die eine
// Grundplatte (Bezugsfläche für Beschriftung), `rails` sind hier die 4 Beine (gleiche schlichte
// Balken-Optik wie echte Auflageleisten), `pieces` enthält die eine Traverse (gleiche Gurtrohr-/
// Zickzack-Zeichnung wie beim Wagen, nur ein einziges Stück). `profileWidth` gibt view2d.js/
// view3d.js die sichtbare Traversenbreite für die Rohr-Stärke vor, weil `c.truss.width` bei
// stehenden Traversen die Standfläche meint, nicht den Querschnitt.
// `truss.frame === 'closed'` (ab MLT TWO und Prolyte S36PR, Nutzerangabe 2026-09-25): der Dolly ist
// ein rundum geschlossener Alu-Rahmen – zwei Querholme an den Stirnseiten verbinden die Längsholme,
// `alu: true` lässt view3d.js den Wagen silbern zeichnen. Ohne `frame` (MLT ONE, Altdaten) bleibt es
// beim offenen Rahmen mit zwei Längsholmen.
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
  const wheelZ1 = z0 + STAND_WHEEL_D;
  const footprint = mk([len0, len1], [wid0, wid1], [z0, wheelZ1]);
  const wheels = cornerBoxes(footprint, [lenAxis, widAxis, 'z'], STAND_WHEEL_D, 0, [z0, wheelZ1]);

  // Offener Rahmen statt durchgehendem Rollbrett: der Dolly ist ein Dolly (Füße mit Rollen), kein
  // Rollbrett wie beim F34/F40-Wagen oben (Nutzer-Feedback 2026-09-23, Fotoabgleich H.O.F.-Katalog
  // S. 40/41 – zwei schmale Holme über die volle Länge an den Rändern der Standfläche, dazwischen
  // offen, statt einer massiven Platte).
  const railZ0 = wheelZ1, railZ1 = railZ0 + STAND_BASE_H;
  const rail0 = mk([len0, len1], [wid0, wid0 + STAND_RAIL_W], [railZ0, railZ1]);
  const rail1 = mk([len0, len1], [wid1 - STAND_RAIL_W, wid1], [railZ0, railZ1]);
  const closed = truss.frame === 'closed';
  const cross = closed ? [
    mk([len0, len0 + STAND_RAIL_W], [wid0 + STAND_RAIL_W, wid1 - STAND_RAIL_W], [railZ0, railZ1]),
    mk([len1 - STAND_RAIL_W, len1], [wid0 + STAND_RAIL_W, wid1 - STAND_RAIL_W], [railZ0, railZ1]),
  ] : [];

  const truss0 = wid0 + (wid1 - wid0 - STAND_TRUSS_W) / 2, truss1 = truss0 + STAND_TRUSS_W;
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
