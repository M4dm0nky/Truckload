export const EPS = 0.5;
export const ORIENTATIONS = ['standing', 'tipLong', 'tipShort'];
// Die vier gültigen Rotationen; einzige Quelle für packer.js und io.js.
export const ROTATIONS = [0, 90, 180, 270];
export const DEFAULT_WHEEL_H = 12;   // Altdaten ohne Angabe
export const NEW_CASE_WHEEL_H = 16;  // Blue Wheel Ø125 mm + Rollenbrett
export const WHEEL_PRESETS = [
  { name: 'Blue Wheel Ø 125 mm', h: 16 },
  { name: 'Blue Wheel Ø 100 mm', h: 13 },
];
const wheelHRaw = c => (Number.isFinite(c.wheelH) ? c.wheelH : DEFAULT_WHEEL_H);
export const hasWheels = c => c.wheels !== false && wheelHRaw(c) > 0;
export const wheelHOf = c => (hasWheels(c) ? wheelHRaw(c) : 0);
// Außenmaße inkl. Rollen: nur wenn das eingetragene Maß sie NICHT schon enthält.
export function outerDims(c) {
  const add = c.dimsInclWheels === false ? wheelHOf(c) : 0;
  return { l: c.l, w: c.w, h: c.h + add };
}
export const DEFAULT_LAYERS = [1, 2, 3, 4];
export const layersOf = c => (Array.isArray(c.layers) && c.layers.length ? c.layers : DEFAULT_LAYERS);

// Lagen eines einzelnen STÜCKS (nicht des Case-Typs): Schnittmenge aus piece.layers und
// layersOf(c) – ein Stück darf die Case-Typ-Lagen nur einschränken, nie erweitern. Fehlt
// piece.layers oder ist die Schnittmenge leer (z. B. weil der Case-Typ seither weniger Lagen
// erlaubt), gilt layersOf(c); Altdaten ohne das Feld packen dadurch unverändert.
export function pieceLayers(piece, c) {
  const base = layersOf(c);
  if (!Array.isArray(piece?.layers) || !piece.layers.length) return base;
  const allowed = piece.layers.filter(n => base.includes(n));
  return allowed.length ? allowed : base;
}

export const isTruss = c => c.kind === 'truss';
// Die eine Tipp-Regel: Traversenwagen werden nie getippt, auch wenn `tippable` (Altdaten) true wäre.
export const canTip = c => c.tippable === true && !isTruss(c);

// Erlaubte Ausrichtungen eines einzelnen STÜCKS. Ein nicht tippbarer Case-Typ lässt sich vom
// Stück nicht überstimmen (immer „standing“). Bei tippbarem Typ entscheidet piece.tipped: true
// zwingt aufs Tippen, false verbietet es, fehlt es (Altdaten), wählt der Packer frei
// (ORIENTATIONS, chooseOrientation).
export function pieceOrientations(piece, c) {
  if (!canTip(c)) return ['standing'];
  if (piece?.tipped === true) return ['tipLong', 'tipShort'];
  if (piece?.tipped === false) return ['standing'];
  return ORIENTATIONS;
}
export const WHEEL_FACES = ['+x', '+y', '-x', '-y'];   // +x = Trucktür/Heck
export const DOOR_FACE = '+x';
const FACE_CYCLE = WHEEL_FACES;
const BASE_WHEEL_FACE = { standing: 'bottom', tipLong: '+y', tipShort: '+x' };

export function localDims(c, orientation) {
  const { l, w, h } = outerDims(c);
  switch (orientation) {
    case 'standing': return { a: l, b: w, c: h };
    case 'tipLong':  return { a: l, b: h, c: w };
    case 'tipShort': return { a: h, b: w, c: l };
    default: throw new Error(`Unbekannte Lage: ${orientation}`);
  }
}

// Welche Case-Dimension (Länge/Breite/Höhe) bei welcher Ausrichtung auf a/b/c (= x/y-Achse bei
// rot 0 bzw. z-Achse) liegt — dieselbe Zuordnung wie in localDims(), aber als Dimensions-NAME statt
// -Wert, damit nextTip() unten symbolisch rechnen kann (funktioniert dadurch auch bei l=w=h &c.).
const ORIENT_AXES = { standing: ['l', 'w'], tipLong: ['l', 'h'], tipShort: ['h', 'w'] };
// Umkehrung von localDims()' c (die jeweils vertikale Dimension): welche Ausrichtung hat welche
// Dimension oben.
const ORIENT_BY_VERTICAL = { h: 'standing', w: 'tipLong', l: 'tipShort' };

// Tippt relativ zur aktuellen Lage „nach vorn/hinten“: die Case-Kante, die gerade in
// Fahrtrichtung (x-Achse) liegt, geht nach oben bzw. unten; die Seitenkante (y-Achse) bleibt.
// Eine absolute „Rollen immer zur Tür“-Regel würde ein Case mit der langen Seite in Fahrtrichtung
// seitlich statt nach vorn tippen (Nutzer-Feedback 2026-09-23). Die Türseiten-Präferenz des
// Packers beim Auto-Packen (`packer.js`) ist davon unabhängig.
export function nextTip(orientation, rot) {
  const [aDim, bDim] = ORIENT_AXES[orientation];
  const rot90 = ((rot ?? 0) % 180) === 90;
  const dxDim = rot90 ? bDim : aDim;
  const dyDim = rot90 ? aDim : bDim;
  const next = ORIENT_BY_VERTICAL[dxDim];
  const [nA, nB] = ORIENT_AXES[next];
  return { orientation: next, rot: dyDim === nB ? 0 : 90 };
}

export function effectiveDims(c, p) {
  const orientation = c.kind === 'truss' ? 'standing' : p.orientation;
  const { a, b, c: h } = localDims(c, orientation);
  return (p.rot ?? 0) % 180 === 90 ? { dx: b, dy: a, dz: h } : { dx: a, dy: b, dz: h };
}

export function boxOf(c, p) {
  const d = effectiveDims(c, p);
  return { x0: p.x, y0: p.y, z0: p.z, x1: p.x + d.dx, y1: p.y + d.dy, z1: p.z + d.dz };
}

export function wheelFace(p) {
  const base = BASE_WHEEL_FACE[p.orientation];
  if (base === 'bottom') return 'bottom';
  const i = FACE_CYCLE.indexOf(base);
  // ((… % 4) + 4) % 4 statt reinem `% 4`: JS liefert bei negativem Operanden ein negatives
  // Ergebnis (z. B. -90 % 4 → -1), das als Array-Index `undefined` ergäbe.
  return FACE_CYCLE[(((i + Math.round((p.rot ?? 0) / 90)) % 4) + 4) % 4];
}

// Umkehrung von wheelFace(): welche Rotation erzeugt für diese Ausrichtung
// die gewünschte Rollenseite? null = unmöglich (z. B. „standing“, Rollen unten).
export function rotForWheelFace(orientation, face) {
  const base = BASE_WHEEL_FACE[orientation];
  if (base === undefined || base === 'bottom') return null;
  const i = FACE_CYCLE.indexOf(base);
  const target = FACE_CYCLE.indexOf(face);
  if (target === -1) return null;
  return ((target - i + 4) % 4) * 90;
}

export function overlaps(A, B) {
  return A.x0 < B.x1 - EPS && B.x0 < A.x1 - EPS
      && A.y0 < B.y1 - EPS && B.y0 < A.y1 - EPS
      && A.z0 < B.z1 - EPS && B.z0 < A.z1 - EPS;
}

export function footprintOverlapArea(A, B) {
  const ox = Math.min(A.x1, B.x1) - Math.max(A.x0, B.x0);
  const oy = Math.min(A.y1, B.y1) - Math.max(A.y0, B.y0);
  return ox > EPS && oy > EPS ? ox * oy : 0;
}

export const footprintArea = B => (B.x1 - B.x0) * (B.y1 - B.y0);

export function gravityZ(foot, boxes) {
  let z = 0;
  for (const b of boxes) if (footprintOverlapArea(foot, b) > 0) z = Math.max(z, b.z1);
  return z;
}

export const snap = (v, grid = 5) => Math.round(v / grid) * grid;

export function snapToEdges(pos, len, edges, tol = 8) {
  let best = pos, bestDist = tol;
  for (const e of edges) {
    const d0 = Math.abs(pos - e);
    if (d0 < bestDist) { best = e; bestDist = d0; }
    const d1 = Math.abs(pos + len - e);
    if (d1 < bestDist) { best = e - len; bestDist = d1; }
  }
  return best;
}

export function supportersOf(item, items) {
  if (item.box.z0 <= EPS) return [];
  return items.filter(o => o.id !== item.id
    && Math.abs(o.box.z1 - item.box.z0) <= EPS
    && footprintOverlapArea(o.box, item.box) > 0);
}

// `supporters` (optional): Map id → Auflage-Stücke, wie validatePlan sie einmal berechnet; ohne sie
// rechnet stackAbove selbst per supportersOf().
export function stackAbove(rootId, items, supporters) {
  const set = new Set([rootId]);
  for (const it of [...items].sort((a, b) => a.box.z0 - b.box.z0)) {
    if (set.has(it.id) || it.box.z0 <= EPS) continue;
    const sup = supporters ? (supporters.get(it.id) ?? []) : supportersOf(it, items);
    if (sup.length && sup.every(s => set.has(s.id))) set.add(it.id);
  }
  return [...set];
}

// Vier quadratische Boxen (Kantenlänge `size`) an den Ecken einer Fläche `faceBox`, in der
// Ebene der Achsen `a1`×`a2`, mit Randabstand `inset` und erstreckt entlang der Normalenachse
// `n` über `nRange` ([n0, n1]). Gemeinsamer Kern von `caseShape()` und `trussShape()`; `size`
// und `inset` bestimmen die Aufrufer (trussShape deckelt auf einen festen Wert, caseShape
// skaliert mit `d`).
export function cornerBoxes(faceBox, [a1, a2, n], size, inset, nRange) {
  const pos = (axis, end) => (end ? faceBox[`${axis}1`] - inset - size : faceBox[`${axis}0`] + inset);
  const boxes = [];
  for (const e1 of [0, 1]) for (const e2 of [0, 1]) {
    const b = {};
    b[`${a1}0`] = pos(a1, e1); b[`${a1}1`] = b[`${a1}0`] + size;
    b[`${a2}0`] = pos(a2, e2); b[`${a2}1`] = b[`${a2}0`] + size;
    b[`${n}0`] = nRange[0]; b[`${n}1`] = nRange[1];
    boxes.push(b);
  }
  return boxes;
}

// Gültige Seitenwerte eines Radkastens (auch für die Import-Prüfung in js/store/io.js).
export const ARCH_SIDES = ['left', 'right', 'both'];
const [ARCH_LEFT, ARCH_RIGHT, ARCH_BOTH] = ARCH_SIDES;

export function archBoxes(truck) {
  return (truck.wheelArches ?? []).flatMap(a => {
    const sides = a.side === ARCH_BOTH ? [ARCH_LEFT, ARCH_RIGHT] : [a.side];
    return sides.map(s => ({
      x0: a.x, x1: a.x + a.l,
      y0: s === ARCH_LEFT ? 0 : truck.w - a.w,
      y1: s === ARCH_LEFT ? a.w : truck.w,
      z0: 0, z1: a.h,
    }));
  });
}
