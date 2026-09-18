export const EPS = 0.5;
export const ORIENTATIONS = ['standing', 'tipLong', 'tipShort'];
const FACE_CYCLE = ['+x', '+y', '-x', '-y'];
const BASE_WHEEL_FACE = { standing: 'bottom', tipLong: '+y', tipShort: '+x' };

export function localDims(c, orientation) {
  switch (orientation) {
    case 'standing': return { a: c.l, b: c.w, c: c.h };
    case 'tipLong':  return { a: c.l, b: c.h, c: c.w };
    case 'tipShort': return { a: c.h, b: c.w, c: c.l };
    default: throw new Error(`Unbekannte Lage: ${orientation}`);
  }
}

export function effectiveDims(c, p) {
  const { a, b, c: h } = localDims(c, p.orientation);
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
  return FACE_CYCLE[(i + (p.rot ?? 0) / 90) % 4];
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

export function stackAbove(rootId, items) {
  const set = new Set([rootId]);
  for (const it of [...items].sort((a, b) => a.box.z0 - b.box.z0)) {
    if (set.has(it.id) || it.box.z0 <= EPS) continue;
    const sup = supportersOf(it, items);
    if (sup.length && sup.every(s => set.has(s.id))) set.add(it.id);
  }
  return [...set];
}

export function faceSlab(b, face, t) {
  switch (face) {
    case '+x': return { ...b, x0: b.x1 - t };
    case '-x': return { ...b, x1: b.x0 + t };
    case '+y': return { ...b, y0: b.y1 - t };
    case '-y': return { ...b, y1: b.y0 + t };
    case 'bottom': return { ...b, z1: b.z0 + t };
    default: throw new Error(`Unbekannte Seite: ${face}`);
  }
}
