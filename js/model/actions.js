import { ORIENTATIONS, boxOf, effectiveDims, gravityZ, snap, snapToEdges, stackAbove } from './geometry.js';
import { archBoxes, buildItems } from './validate.js';
import { autoPack } from './packer.js';

const touch = plan => ({ ...plan, updatedAt: new Date().toISOString() });

export const emptyPlan = (id, name, truckId) =>
  touch({ id, name, truckId, placements: [], unplaced: [], notes: '' });

function otherBoxes(plan, ctx, excludeIds) {
  const { items } = buildItems(plan, ctx.caseById);
  return [...items.filter(it => !excludeIds.includes(it.id)).map(it => it.box), ...archBoxes(ctx.truck)];
}

function settle(p, c, others) {
  return { ...p, z: gravityZ(boxOf(c, { ...p, z: 0 }), others) };
}

export function addUnplaced(plan, caseId, n, newId, { labels = [], color = null } = {}) {
  const extra = Array.from({ length: n }, (_, i) => ({
    id: newId(), caseId,
    ...(labels[i] ? { label: labels[i] } : {}),
    ...(color ? { color } : {}),
  }));
  return touch({ ...plan, unplaced: [...plan.unplaced, ...extra] });
}

export function removeUnplaced(plan, caseId) {
  const i = plan.unplaced.findIndex(u => u.caseId === caseId);
  if (i < 0) return plan;
  return touch({ ...plan, unplaced: plan.unplaced.filter((_, k) => k !== i) });
}

export function placeCase(plan, caseId, x, y, ctx, fromUnplacedId = null) {
  const c = ctx.caseById.get(caseId);
  if (!c) return plan;
  const src = fromUnplacedId ? plan.unplaced.find(u => u.id === fromUnplacedId) : null;
  const { id: _srcId, caseId: _srcCaseId, ...srcExtra } = src ?? {};
  const base = { id: fromUnplacedId ?? ctx.newId(), caseId, x: snap(x), y: snap(y), z: 0, orientation: 'standing', rot: 0, ...srcExtra };
  const p = settle(base, c, otherBoxes(plan, ctx, []));
  return touch({
    ...plan,
    placements: [...plan.placements, p],
    unplaced: plan.unplaced.filter(u => u.id !== fromUnplacedId),
  });
}

export function moveGroup(plan, id, x, y, ctx, { grid = 5, edges = true } = {}) {
  const { items } = buildItems(plan, ctx.caseById);
  const root = items.find(it => it.id === id);
  if (!root) return plan;
  const group = stackAbove(id, items);
  const others = otherBoxes(plan, ctx, group);
  const w = root.box.x1 - root.box.x0, d = root.box.y1 - root.box.y0;
  let nx = snap(x, grid), ny = snap(y, grid);
  if (edges) {
    nx = snapToEdges(nx, w, [0, ctx.truck.l, ...others.flatMap(b => [b.x0, b.x1])]);
    ny = snapToEdges(ny, d, [0, ctx.truck.w, ...others.flatMap(b => [b.y0, b.y1])]);
  }
  const nz = gravityZ({ x0: nx, y0: ny, x1: nx + w, y1: ny + d }, others);
  const ddx = nx - root.p.x, ddy = ny - root.p.y, ddz = nz - root.p.z;
  if (!ddx && !ddy && !ddz) return plan;
  const set = new Set(group);
  return touch({
    ...plan,
    placements: plan.placements.map(p => set.has(p.id) ? { ...p, x: p.x + ddx, y: p.y + ddy, z: p.z + ddz } : p),
  });
}

function reorient(plan, id, ctx, change) {
  const p = plan.placements.find(q => q.id === id);
  const c = p && ctx.caseById.get(p.caseId);
  if (!c) return plan;
  const patch = change(p, c);
  if (!Object.keys(patch).length) return plan;
  const { items } = buildItems(plan, ctx.caseById);
  const next = settle({ ...p, ...patch }, c, otherBoxes(plan, ctx, stackAbove(id, items)));
  return touch({ ...plan, placements: plan.placements.map(q => (q.id === id ? next : q)) });
}

export const rotate = (plan, id, ctx) =>
  reorient(plan, id, ctx, p => ({ rot: ((p.rot ?? 0) + 90) % 360 }));

export const cycleTip = (plan, id, ctx) =>
  reorient(plan, id, ctx, (p, c) => (c.tippable && c.kind !== 'truss')
    ? { orientation: ORIENTATIONS[(ORIENTATIONS.indexOf(p.orientation) + 1) % ORIENTATIONS.length] }
    : {});

function nextLabel(label) {
  const m = /^(.*?)(\d+)$/.exec(label);
  if (!m) return label;
  return `${m[1]}${Number(m[2]) + 1}`;
}

export function duplicate(plan, id, ctx) {
  const p = plan.placements.find(q => q.id === id);
  const c = p && ctx.caseById.get(p.caseId);
  if (!c) return plan;
  const patch = { id: ctx.newId(), x: p.x + effectiveDims(c, p).dx };
  if (p.label) patch.label = nextLabel(p.label);
  const copy = settle({ ...p, ...patch }, c, otherBoxes(plan, ctx, []));
  return touch({ ...plan, placements: [...plan.placements, copy] });
}

// Teilweise Änderung mit ausdrücklichem Löschen: ein Feld, das nicht übergeben
// wird (Key fehlt oder `undefined`), bleibt unverändert. `null` oder `''`
// entfernt das Feld ausdrücklich (Fallback auf Case-Name bzw. Gewerkfarbe).
function applyField(it, key, value) {
  if (value === undefined) return it;
  if (value === null || value === '') {
    const { [key]: _drop, ...rest } = it;
    return rest;
  }
  return { ...it, [key]: value };
}

export function setItemLabel(plan, id, { label, color } = {}) {
  const patch = it => it.id === id ? applyField(applyField(it, 'label', label), 'color', color) : it;
  return touch({
    ...plan,
    placements: plan.placements.map(patch),
    unplaced: plan.unplaced.map(patch),
  });
}

export const removePlacement = (plan, id) =>
  touch({ ...plan, placements: plan.placements.filter(p => p.id !== id) });

export function toTray(plan, id) {
  const p = plan.placements.find(q => q.id === id);
  if (!p) return plan;
  const { label, color } = p;
  return touch({
    ...plan,
    placements: plan.placements.filter(q => q.id !== id),
    unplaced: [...plan.unplaced, { id: p.id, caseId: p.caseId, ...(label ? { label } : {}), ...(color ? { color } : {}) }],
  });
}

const orphans = (plan, ctx) => plan.unplaced.filter(u => !ctx.caseById.has(u.caseId));

export function packAll(plan, ctx) {
  const list = [...plan.placements, ...plan.unplaced]
    .map(x => ctx.caseById.get(x.caseId)).filter(Boolean);
  const { placements, unplaced } = autoPack(list, ctx.truck, { newId: ctx.newId });
  return touch({
    ...plan,
    placements: [...placements, ...plan.placements.filter(p => !ctx.caseById.has(p.caseId))],
    unplaced: [...unplaced.map(caseId => ({ id: ctx.newId(), caseId })), ...orphans(plan, ctx)],
  });
}

export function packRest(plan, ctx) {
  const { items } = buildItems(plan, ctx.caseById);
  const list = plan.unplaced.map(u => ctx.caseById.get(u.caseId)).filter(Boolean);
  if (!list.length) return plan;
  const { placements, unplaced } = autoPack(list, ctx.truck, { newId: ctx.newId, obstacles: items.map(it => it.box) });
  return touch({
    ...plan,
    placements: [...plan.placements, ...placements],
    unplaced: [...unplaced.map(caseId => ({ id: ctx.newId(), caseId })), ...orphans(plan, ctx)],
  });
}
