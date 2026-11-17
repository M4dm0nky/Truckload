// Reihenmodell und Bodenlücken-Messung (rein, ohne DOM/i18n).
// Koordinaten: x = Länge (Stirnwand → Tür), y = Breite. Boxen: { x0, x1, y0, y1 }.
// Eine Reihe ist eine Kette von Boxen, deren x-Bereiche sich überschneiden. Die letzte Reihe
// (größtes x0, an der Tür) ist von Lücken ausgenommen.
import { EPS, pieceOrientations, effectiveDims } from './geometry.js';

export const MIN_GAP = 25;

// Boxen → Reihen, sortiert nach x0. Überlappung muss > EPS sein (reines Anliegen trennt Reihen).
export function groupRows(boxes) {
  const sorted = [...boxes].sort((a, b) => a.x0 - b.x0 || a.x1 - b.x1);
  const rows = [];
  for (const b of sorted) {
    const row = rows[rows.length - 1];
    if (row && b.x0 < row.x1 - EPS) {
      row.boxes.push(b);
      row.x1 = Math.max(row.x1, b.x1);
    } else rows.push({ x0: b.x0, x1: b.x1, boxes: [b] });
  }
  return rows;
}

// Freie Rechtecke im Band [row.x0,row.x1] × [0,w]: y-Streifen an allen Kanten, je Streifen die
// belegten x-Intervalle abziehen, gleich breite Reste benachbarter Streifen zusammenfassen.
function freeRects(row, w, obstacles) {
  const occ = [...row.boxes, ...obstacles].filter(o => o.x1 > row.x0 + EPS && o.x0 < row.x1 - EPS);
  const ys = [...new Set([0, w, ...occ.flatMap(o => [o.y0, o.y1])]
    .map(y => Math.min(w, Math.max(0, y))))].sort((a, b) => a - b);
  const out = [];
  for (let i = 0; i < ys.length - 1; i++) {
    const y0 = ys[i], y1 = ys[i + 1];
    if (y1 - y0 <= EPS) continue;
    const taken = occ.filter(o => o.y0 < y1 - EPS && o.y1 > y0 + EPS)
      .map(o => [Math.max(o.x0, row.x0), Math.min(o.x1, row.x1)])
      .sort((a, b) => a[0] - b[0]);
    let cur = row.x0;
    const free = [];
    for (const [a, b] of taken) {
      if (a > cur + EPS) free.push([cur, a]);
      cur = Math.max(cur, b);
    }
    if (row.x1 > cur + EPS) free.push([cur, row.x1]);
    for (const [x0, x1] of free) {
      const prev = out.find(r => Math.abs(r.y1 - y0) <= EPS
        && Math.abs(r.x0 - x0) <= EPS && Math.abs(r.x1 - x1) <= EPS);
      if (prev) prev.y1 = y1; else out.push({ x0, x1, y0, y1 });
    }
  }
  return out;
}

// Reihen vor der letzten mit ihrer 1-basierten Nummer (von der Stirnwand gezählt).
const inner = boxes => groupRows(boxes).slice(0, -1).map((row, i) => ({ row, n: i + 1 }));

// Lücken vor der letzten Reihe; w = Ausdehnung quer (y), d = längs (x).
export function floorGaps(boxes, truck, { obstacles = [], minSize = MIN_GAP } = {}) {
  const gaps = [];
  for (const { row, n } of inner(boxes))
    for (const r of freeRects(row, truck.w, obstacles)) {
      const w = r.y1 - r.y0, d = r.x1 - r.x0;
      if (w >= minSize && d >= minSize) gaps.push({ row: n, ...r, w, d });
    }
  return gaps;
}

// Summe der freien Bodenfläche (ohne Mindestgröße) über alle Reihen vor der letzten.
export function freeFloorArea(boxes, truck, { obstacles = [] } = {}) {
  let sum = 0;
  for (const { row } of inner(boxes))
    for (const r of freeRects(row, truck.w, obstacles)) sum += (r.y1 - r.y0) * (r.x1 - r.x0);
  return sum;
}

// Kleinste Kante der kleinsten möglichen Grundfläche über alle Stücke, mindestens MIN_GAP.
// Stücke tragen entweder ein aufgelöstes `c` oder eine `caseId` (caseById: Map oder Objekt).
export function minFootprint(pieces, caseById) {
  const lookup = id => (caseById instanceof Map ? caseById.get(id) : caseById?.[id]);
  let best = null;
  for (const p of pieces) {
    const c = p.c ?? lookup(p.caseId);
    if (!c) continue;
    for (const orientation of pieceOrientations(p, c))
      for (const rot of [0, 90]) {
        const { dx, dy } = effectiveDims(c, { orientation, rot });
        if (!best || dx * dy < best.area) best = { area: dx * dy, edge: Math.min(dx, dy) };
      }
  }
  return best ? Math.max(MIN_GAP, best.edge) : MIN_GAP;
}
