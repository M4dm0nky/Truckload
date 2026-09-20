import { ORIENTATIONS, effectiveDims, overlaps, layersOf, wheelFace, DOOR_FACE } from './geometry.js';
import { archBoxes } from './validate.js';

export function chooseOrientation(c, truck) {
  const opts = [];
  for (const orientation of c.tippable ? ORIENTATIONS : ['standing']) {
    for (const rot of [0, 90, 180, 270]) {
      const d = effectiveDims(c, { orientation, rot });
      if (d.dx > truck.l || d.dy > truck.w || d.dz > truck.h) continue;
      const layers = c.stackable ? Math.floor(truck.h / d.dz) : 1;
      const cols = Math.floor(truck.w / d.dy);
      const score = (cols * d.dy / truck.w) * (layers * d.dz / truck.h);
      opts.push({ orientation, rot, d, score });
    }
  }
  // Bei gleichem Score gewinnt zuerst „standing“, dann die Variante mit
  // Rollen zur Tür, dann rot === 0.
  const pref = o => {
    if (o.orientation === 'standing') return 0;
    if (wheelFace({ orientation: o.orientation, rot: o.rot }) === DOOR_FACE) return 1;
    if (o.rot === 0) return 2;
    return 3;
  };
  opts.sort((p, q) => q.score - p.score || pref(p) - pref(q));
  return opts[0] ?? null;
}

function canAddToStack(stack, c, dz, truck) {
  if (stack.height + dz > truck.h + 1e-6) return false;
  if (!stack.items.at(-1).c.stackable) return false;
  if (stack.items.at(-1).c.weight < c.weight) return false;
  let above = c.weight;
  for (let i = stack.items.length - 1; i >= 0; i--) {
    const s = stack.items[i].c;
    if (s.maxTopLoad != null && above > s.maxTopLoad) return false;
    above += s.weight;
  }
  return true;
}

// itemList: Stücke { id, caseId, c, label?, color? } mit bereits aufgelöstem Case `c`.
export function buildStacks(itemList, truck) {
  const stacks = [], unplaced = [];
  const entries = itemList.map(it => ({ it, c: it.c, o: chooseOrientation(it.c, truck) }));
  for (const e of entries) if (!e.o) unplaced.push(e.it);
  const maxLayer = c => Math.max(...layersOf(c));
  const minLayer = c => Math.min(...layersOf(c));
  const ready = entries.filter(e => e.o);
  const withFloor = ready.filter(e => layersOf(e.c).includes(1)).sort((a, b) =>
    maxLayer(a.c) - maxLayer(b.c) || b.c.weight - a.c.weight || b.o.d.dx * b.o.d.dy - a.o.d.dx * a.o.d.dy);
  const withoutFloor = ready.filter(e => !layersOf(e.c).includes(1)).sort((a, b) =>
    minLayer(a.c) - minLayer(b.c) || b.c.weight - a.c.weight || b.o.d.dx * b.o.d.dy - a.o.d.dx * a.o.d.dy);

  for (const { it, c, o } of withFloor) {
    const key = `${o.d.dx}x${o.d.dy}`;
    const allowed = layersOf(c);
    const target = stacks.find(s => s.key === key && s.items.length < 4
      && allowed.includes(s.items.length + 1) && canAddToStack(s, c, o.d.dz, truck));
    if (target) {
      target.items.push({ it, c, o, z: target.height });
      target.height += o.d.dz;
      target.weight += c.weight;
    } else {
      stacks.push({ key, dx: o.d.dx, dy: o.d.dy, height: o.d.dz, weight: c.weight, items: [{ it, c, o, z: 0 }] });
    }
  }
  for (const { it, c, o } of withoutFloor) {
    const key = `${o.d.dx}x${o.d.dy}`;
    const allowed = layersOf(c);
    const target = stacks.find(s => s.key === key && s.items.length < 4
      && allowed.includes(s.items.length + 1) && canAddToStack(s, c, o.d.dz, truck));
    if (target) {
      target.items.push({ it, c, o, z: target.height });
      target.height += o.d.dz;
      target.weight += c.weight;
    } else {
      unplaced.push(it);
    }
  }
  return { stacks, unplaced };
}

export function placeStacks(stacks, truck, obstacles = []) {
  const blocked = [...archBoxes(truck), ...obstacles];
  const points = [{ x: 0, y: 0 }, ...blocked.flatMap(b => [
    { x: b.x1, y: b.y0 }, { x: b.x0, y: b.y1 }, { x: b.x1, y: 0 }, { x: 0, y: b.y1 },
  ])];
  const placed = [], failed = [];
  for (const s of [...stacks].sort((a, b) => b.weight - a.weight)) {
    points.sort((p, q) => p.x - q.x || p.y - q.y);
    let hit = null;
    for (const pt of points) {
      for (const swap of s.dx === s.dy ? [false] : [false, true]) {
        const dx = swap ? s.dy : s.dx, dy = swap ? s.dx : s.dy;
        const box = { x0: pt.x, y0: pt.y, z0: 0, x1: pt.x + dx, y1: pt.y + dy, z1: s.height };
        if (box.x1 > truck.l + 1e-6 || box.y1 > truck.w + 1e-6) continue;
        if (blocked.some(b => overlaps(b, box))) continue;
        hit = { box, swap };
        break;
      }
      if (hit) break;
    }
    if (!hit) { failed.push(s); continue; }
    blocked.push(hit.box);
    placed.push({ stack: s, ...hit });
    points.push({ x: hit.box.x1, y: hit.box.y0 }, { x: hit.box.x0, y: hit.box.y1 });
  }
  return { placed, failed };
}

// items: Stücke { id, caseId, c, label?, color? } mit bereits aufgelöstem Case `c`.
// Die erzeugten Placements übernehmen id/label/color des Stücks statt eine neue ID zu vergeben.
export function autoPack(items, truck, { obstacles = [] } = {}) {
  const { stacks, unplaced } = buildStacks(items, truck);
  const { placed, failed } = placeStacks(stacks, truck, obstacles);
  const placements = [];
  for (const { stack, box, swap } of placed) {
    for (const { it, o, z } of stack.items) {
      placements.push({
        id: it.id, caseId: it.caseId, x: box.x0, y: box.y0, z,
        orientation: o.orientation, rot: swap ? (o.rot + 90) % 360 : o.rot,
        ...(it.label ? { label: it.label } : {}),
        ...(it.color ? { color: it.color } : {}),
      });
    }
  }
  const stripCase = ({ c, ...rest }) => rest;
  const left = [...unplaced, ...failed.flatMap(s => s.items.map(i => i.it))];
  return { placements, unplaced: left.map(stripCase) };
}
