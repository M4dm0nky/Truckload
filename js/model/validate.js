import { EPS, boxOf, overlaps, footprintOverlapArea, footprintArea, supportersOf, layersOf } from './geometry.js';
import { isTruss } from './truss.js';

export const SUPPORT_MIN = 0.8;
export const IMBALANCE_RATIO = 0.1;

export function archBoxes(truck) {
  return (truck.wheelArches ?? []).flatMap(a => {
    const sides = a.side === 'both' ? ['left', 'right'] : [a.side];
    return sides.map(s => ({
      x0: a.x, x1: a.x + a.l,
      y0: s === 'left' ? 0 : truck.w - a.w,
      y1: s === 'left' ? a.w : truck.w,
      z0: 0, z1: a.h,
    }));
  });
}

export function buildItems(plan, caseById) {
  const items = [], missing = [];
  for (const p of plan.placements) {
    const c = caseById.get(p.caseId);
    if (!c) { missing.push(p); continue; }
    items.push({ id: p.id, p, c, box: boxOf(c, p), label: p.label ?? c.name, color: p.color ?? c.color });
  }
  return { items, missing };
}

export function loadSequence(items) {
  const sorted = [...items].sort((a, b) =>
    a.box.x0 - b.box.x0 || a.box.y0 - b.box.y0 || a.box.z0 - b.box.z0);
  return new Map(sorted.map((it, i) => [it.id, i + 1]));
}

export function layerMap(items) {
  const layers = new Map();
  const sorted = [...items].sort((a, b) => a.box.z0 - b.box.z0);
  for (const it of sorted) {
    if (it.box.z0 <= EPS) { layers.set(it.id, 1); continue; }
    const sup = supportersOf(it, items);
    const maxSup = sup.length ? Math.max(...sup.map(s => layers.get(s.id) ?? 1)) : 0;
    layers.set(it.id, 1 + maxSup);
  }
  return layers;
}

export function validatePlan(plan, caseById, truck) {
  const { items, missing } = buildItems(plan, caseById);
  const issues = [];
  const add = (placementId, code, message) => issues.push({ placementId, code, message });
  const arches = archBoxes(truck);

  // Fehlende Case-Typen haben keine bekannten Maße mehr (das Placement speichert nur x/y/z,
  // keine l/w/h) und können deshalb geometrisch nicht in die Kollisionsprüfung einbezogen
  // werden. Die Meldung macht das offen, statt eine geprüfte Position vorzutäuschen
  // (docs/code-review-2026-09-21.md, „validate.js:52,63-67“).
  for (const p of missing)
    add(p.id, 'missingCase',
      `„${p.label ?? p.caseId}“ hat keinen bekannten Case-Typ mehr – die Position wird nicht auf Kollisionen geprüft.`);

  for (const it of items) {
    const b = it.box, n = it.label;
    if (b.x0 < -EPS || b.y0 < -EPS || b.z0 < -EPS
      || b.x1 > truck.l + EPS || b.y1 > truck.w + EPS || b.z1 > truck.h + EPS)
      add(it.id, 'outOfBounds', `„${n}“ ragt über den Laderaum hinaus.`);
    if (arches.some(a => overlaps(a, b))) add(it.id, 'arch', `„${n}“ kollidiert mit einem Radkasten.`);
    // Ein Traversenwagen ist geometrisch immer „standing“ (effectiveDims erzwingt das),
    // p.orientation kann bei importierten Plänen trotzdem andere Werte tragen — die
    // notTippable-Prüfung darf sich davon nicht täuschen lassen.
    if (!isTruss(it.c) && it.p.orientation !== 'standing' && !it.c.tippable)
      add(it.id, 'notTippable', `„${n}“ darf nicht getippt werden.`);
  }

  for (let i = 0; i < items.length; i++) for (let j = i + 1; j < items.length; j++) {
    if (!overlaps(items[i].box, items[j].box)) continue;
    add(items[i].id, 'collision', `„${items[i].label}“ überschneidet sich mit „${items[j].label}“.`);
    add(items[j].id, 'collision', `„${items[j].label}“ überschneidet sich mit „${items[i].label}“.`);
  }

  const supporters = new Map();
  for (const it of items) {
    if (it.box.z0 <= EPS) continue;
    const sup = supportersOf(it, items);
    supporters.set(it.id, sup);
    const archSup = arches.filter(a => Math.abs(a.z1 - it.box.z0) <= EPS);
    const area = [...sup.map(s => s.box), ...archSup]
      .reduce((s, bx) => s + footprintOverlapArea(bx, it.box), 0);
    // fa <= 0 explizit behandeln: area / 0 wäre NaN, und `NaN < SUPPORT_MIN` ist false —
    // ein Case mit Grundfläche 0 würde sonst stillschweigend als „sicher“ durchgehen.
    const fa = footprintArea(it.box);
    if (fa <= 0 || area / fa < SUPPORT_MIN)
      add(it.id, 'unsupported', `„${it.label}“ steht nicht sicher (unter ${SUPPORT_MIN * 100} % Auflage).`);
    for (const s of sup) if (!s.c.stackable)
      add(it.id, 'notStackable', `„${it.label}“ steht auf „${s.label}“, das nicht stapelbar ist.`);
  }

  const load = new Map(items.map(it => [it.id, 0]));
  for (const it of [...items].sort((a, b) => b.box.z0 - a.box.z0)) {
    const sup = supporters.get(it.id) ?? [];
    const areas = sup.map(s => footprintOverlapArea(s.box, it.box));
    const sum = areas.reduce((a, b) => a + b, 0);
    if (!sum) continue;
    const total = it.c.weight + load.get(it.id);
    sup.forEach((s, k) => load.set(s.id, load.get(s.id) + total * areas[k] / sum));
  }
  for (const it of items) {
    const max = it.c.maxTopLoad;
    if (max != null && load.get(it.id) > max + 1e-6)
      add(it.id, 'overload', `Auf „${it.label}“ lasten ${Math.round(load.get(it.id))} kg (max. ${max} kg).`);
  }

  const layers = layerMap(items);
  for (const it of items) {
    const n = layers.get(it.id);
    if (n > 4) add(it.id, 'tooManyLayers', `„${it.label}“ steht in Lage ${n} – mehr als 4 Lagen sind nicht vorgesehen.`);
    else {
      const allowed = layersOf(it.c);
      if (!allowed.includes(n)) add(it.id, 'layer', `„${it.label}“ darf nicht in Lage ${n} stehen (erlaubt: ${[...allowed].sort((a, b) => a - b).join(', ')}).`);
    }
  }

  const weight = items.reduce((s, it) => s + it.c.weight, 0);
  if (weight > truck.payload)
    add(null, 'tooHeavy', `Gesamtgewicht ${Math.round(weight)} kg überschreitet die Nutzlast von ${truck.payload} kg.`);

  const cog = weight ? {
    x: items.reduce((s, it) => s + it.c.weight * (it.box.x0 + it.box.x1) / 2, 0) / weight,
    y: items.reduce((s, it) => s + it.c.weight * (it.box.y0 + it.box.y1) / 2, 0) / weight,
  } : null;
  if (cog && Math.abs(cog.y - truck.w / 2) > IMBALANCE_RATIO * truck.w)
    add(null, 'imbalance', `Ladung ist einseitig: Schwerpunkt ${Math.round(Math.abs(cog.y - truck.w / 2))} cm aus der Mitte.`);

  const volume = items.reduce((s, { box: b }) => s + (b.x1 - b.x0) * (b.y1 - b.y0) * (b.z1 - b.z0), 0);

  const byPlacement = new Map();
  for (const is of issues) if (is.placementId) {
    if (!byPlacement.has(is.placementId)) byPlacement.set(is.placementId, []);
    byPlacement.get(is.placementId).push(is);
  }

  return {
    issues, byPlacement, load, items, layers, sequence: loadSequence(items),
    totals: {
      weight, payload: truck.payload, cog,
      loadMeters: items.length ? Math.max(...items.map(it => it.box.x1)) / 100 : 0,
      volumeRatio: truck.l > 0 && truck.w > 0 && truck.h > 0 ? volume / (truck.l * truck.w * truck.h) : 0,
      count: items.length,
    },
  };
}
