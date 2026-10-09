import { boxOf, effectiveDims, gravityZ, snap, snapToEdges, stackAbove, rotForWheelFace, archBoxes, nextTip, layersOf, canTip } from './geometry.js';
import { MAX_LABEL, layersValid } from './limits.js';
import { buildItems } from './items.js';
import { pickPieceFields, cleanGroup } from './pieceFields.js';
import { autoPack } from './packer.js';
import { rulesFor, normalizeRules, mixTopFor } from './packRules.js';

const touch = plan => ({ ...plan, updatedAt: new Date().toISOString() });

export const emptyPlan = (id, name, truckId) =>
  touch({ id, name, truckId, placements: [], unplaced: [], notes: '' });

// Nimmt schon aufgelöste `items` statt (plan, ctx): Aufrufer haben sie meist bereits gebaut,
// ein erneutes buildItems() pro Maus-Bewegung wäre doppelte Arbeit.
function otherBoxes(items, truck, excludeIds) {
  return [...items.filter(it => !excludeIds.includes(it.id)).map(it => it.box), ...archBoxes(truck)];
}

function settle(p, c, others) {
  return { ...p, z: gravityZ(boxOf(c, { ...p, z: 0 }), others) };
}

export function addUnplaced(plan, caseId, n, newId, { labels = [], color = null, layers = null, tipped = null, group = null } = {}) {
  const extra = Array.from({ length: n }, (_, i) => ({
    id: newId(), caseId,
    // Das Label kommt gekürzt aus der Namensliste, der Rest aus den Sammelvorgaben.
    ...pickPieceFields({ label: labels[i] ? labels[i].slice(0, MAX_LABEL) : undefined, color, layers, tipped, group }),
  }));
  return touch({ ...plan, unplaced: [...plan.unplaced, ...extra] });
}

// Entfernt genau EIN Stück aus der Ablage, über seine eigene `id` (nicht `caseId`, der nur den
// Typ trifft): „−“ muss die angeklickte Beschriftung treffen, nicht irgendein Stück des Typs.
export function removeUnplaced(plan, id) {
  const next = plan.unplaced.filter(u => u.id !== id);
  if (next.length === plan.unplaced.length) return plan;
  return touch({ ...plan, unplaced: next });
}

// Raster plus Einrasten an Truckwänden und Kanten der anderen Boxen – gemeinsam für das Absetzen
// aus der Liste (placeCase) und das Verschieben im Truck (moveGroup). `w`/`d` = Grundfläche.
function snapPos(x, y, w, d, others, truck, { grid = 5, edges = true } = {}) {
  let nx = snap(x, grid), ny = snap(y, grid);
  if (edges) {
    nx = snapToEdges(nx, w, [0, truck.l, ...others.flatMap(b => [b.x0, b.x1])]);
    ny = snapToEdges(ny, d, [0, truck.w, ...others.flatMap(b => [b.y0, b.y1])]);
  }
  return { nx, ny };
}

export function placeCase(plan, caseId, { x, y }, ctx, { fromUnplacedId = null } = {}) {
  const c = ctx.caseById.get(caseId);
  if (!c) return plan;
  const src = fromUnplacedId ? plan.unplaced.find(u => u.id === fromUnplacedId) : null;
  // Nur die bekannten Stück-Felder übernehmen, nicht das Objekt spreaden: ein Ablage-Eintrag aus
  // einer fremden Importdatei könnte x/y/z tragen und die Mausposition überschreiben.
  const srcExtra = pickPieceFields(src);
  const orientation = srcExtra.tipped === true && canTip(c) ? 'tipLong' : 'standing';
  // Kanten-Einrasten wie beim Verschieben (moveGroup), nicht nur Raster: sonst landet z. B. ein
  // 62 cm breiter Wagen bei y = 60, ragt 2 cm hinein und wird von settle() obenauf gestellt
  // (Nutzer-Befund 2026-09-26: vier MLT-Wagen passten nicht nebeneinander in 248 cm).
  const others = otherBoxes(buildItems(plan, ctx.caseById).items, ctx.truck, []);
  const draft = { id: fromUnplacedId ?? ctx.newId(), caseId, x, y, z: 0, orientation, rot: 0, ...srcExtra };
  const fb = boxOf(c, draft);
  const { nx, ny } = snapPos(x, y, fb.x1 - fb.x0, fb.y1 - fb.y0, others, ctx.truck);
  const p = settle({ ...draft, x: nx, y: ny }, c, others);
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
  const others = otherBoxes(items, ctx.truck, group);
  const w = root.box.x1 - root.box.x0, d = root.box.y1 - root.box.y0;
  const { nx, ny } = snapPos(x, y, w, d, others, ctx.truck, { grid, edges });
  const nz = gravityZ({ x0: nx, y0: ny, x1: nx + w, y1: ny + d }, others);
  const ddx = nx - root.p.x, ddy = ny - root.p.y, ddz = nz - root.p.z;
  if (!ddx && !ddy && !ddz) return plan;
  const set = new Set(group);
  return touch({
    ...plan,
    placements: plan.placements.map(p => set.has(p.id) ? { ...p, x: p.x + ddx, y: p.y + ddy, z: p.z + ddz } : p),
  });
}

// Der Stapel über dem gedrehten Case wird bewusst NICHT nachgezogen: `stackAbove` dient nur dazu,
// ihn aus den Hindernissen auszuschließen (sonst kollidiert das Case mit sich selbst). Ändert sich
// die Höhe (z. B. beim Tippen), meldet die Warnliste sofort „unsupported“; automatisches
// Mitbewegen wäre eine nicht angestoßene Nebenwirkung.
function reorient(plan, id, ctx, change) {
  const p = plan.placements.find(q => q.id === id);
  const c = p && ctx.caseById.get(p.caseId);
  if (!c) return plan;
  const patch = change(p, c);
  if (!Object.keys(patch).length) return plan;
  const { items } = buildItems(plan, ctx.caseById);
  const next = settle({ ...p, ...patch }, c, otherBoxes(items, ctx.truck, stackAbove(id, items)));
  return touch({ ...plan, placements: plan.placements.map(q => (q.id === id ? next : q)) });
}

export const rotate = (plan, id, ctx) =>
  reorient(plan, id, ctx, p => ({ rot: ((p.rot ?? 0) + 90) % 360 }));

export const cycleTip = (plan, id, ctx) =>
  reorient(plan, id, ctx, (p, c) => {
    if (!canTip(c)) return {};
    const next = nextTip(p.orientation, p.rot);
    return { ...next, tipped: next.orientation !== 'standing' };
  });

// Dreht ein bereits getipptes Case so, dass die Rollen zur gewünschten Seite zeigen.
// Ist die Richtung für die aktuelle Lage nicht erreichbar (z. B. „standing“, Traverse), passiert nichts.
export const setWheelFace = (plan, id, face, ctx) =>
  reorient(plan, id, ctx, (p, c) => {
    if (!canTip(c)) return {};
    const rot = rotForWheelFace(p.orientation, face);
    return rot == null ? {} : { rot };
  });

// Zählt die letzte Zahl im Label hoch (für duplicate()), nur wenn sie ganz am Ende steht
// („Case 3 von 8“ -> „Case 3 von 9“). `padStart` erhält führende Nullen („Case 09“ -> „Case 10“).
// Gekürzt wird auf MAX_LABEL, weil 9 -> 10 ein Zeichen länger ist und der Import sonst ablehnt.
function nextLabel(label) {
  const m = /^(.*?)(\d+)$/.exec(label);
  if (!m) return label.slice(0, MAX_LABEL);
  const next = String(Number(m[2]) + 1).padStart(m[2].length, '0');
  return `${m[1]}${next}`.slice(0, MAX_LABEL);
}

export function duplicate(plan, id, ctx) {
  const p = plan.placements.find(q => q.id === id);
  const c = p && ctx.caseById.get(p.caseId);
  if (!c) return plan;
  const { dx, dy } = effectiveDims(c, p);
  const label = p.label ? nextLabel(p.label) : undefined;
  // Die Kopie zuerst hinter das Original, bei Überstand über die Heckkante davor, sonst seitlich;
  // passt auch das nicht in den Laderaum, kommt sie in die Ablage. Kollisionen mit anderen Cases
  // prüft das bewusst nicht (das macht `validatePlan`), nur das Ende des Trucks.
  const candidates = [
    { x: p.x + dx, y: p.y }, { x: p.x - dx, y: p.y },
    { x: p.x, y: p.y + dy }, { x: p.x, y: p.y - dy },
  ].filter(pos => pos.x >= 0 && pos.x + dx <= ctx.truck.l && pos.y >= 0 && pos.y + dy <= ctx.truck.w);
  const pos = candidates[0];
  if (pos) {
    const patch = { id: ctx.newId(), ...pos, ...(label ? { label } : {}) };
    const copy = settle({ ...p, ...patch }, c, otherBoxes(buildItems(plan, ctx.caseById).items, ctx.truck, []));
    return touch({ ...plan, placements: [...plan.placements, copy] });
  }
  const trayEntry = {
    id: ctx.newId(), caseId: p.caseId, ...pickPieceFields({ ...p, label }),
  };
  return touch({ ...plan, unplaced: [...plan.unplaced, trayEntry] });
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
  return { ...it, [key]: key === 'label' ? value.slice(0, MAX_LABEL) : value };
}

export function setItemLabel(plan, id, { label, color } = {}) {
  const patch = it => it.id === id ? applyField(applyField(it, 'label', label), 'color', color) : it;
  return touch({
    ...plan,
    placements: plan.placements.map(patch),
    unplaced: plan.unplaced.map(patch),
  });
}

// Sucht ein Stück per id in Placements ODER Ablage – gemeinsamer Fundort für Aktionen, die ein
// einzelnes Stück unabhängig davon patchen, in welcher der beiden Listen es gerade liegt.
function findPiece(plan, id) {
  const placement = plan.placements.find(p => p.id === id);
  if (placement) return { list: 'placements', item: placement };
  const unplaced = plan.unplaced.find(u => u.id === id);
  if (unplaced) return { list: 'unplaced', item: unplaced };
  return null;
}

export function setPieceLayers(plan, id, layers, ctx) {
  const found = findPiece(plan, id);
  if (!found) return plan;
  const c = ctx.caseById.get(found.item.caseId);
  if (!c) return plan;
  if (!layersValid(layers)) return plan;
  const allowed = layersOf(c);
  const filtered = layers.filter(n => allowed.includes(n));
  if (!filtered.length) return plan;
  const sorted = [...filtered].sort((a, b) => a - b);
  // Entspricht die gefilterte Menge genau layersOf(c) (unabhängig von der Reihenfolge dort),
  // ist das Feld überflüssig – dann fehlendes Feld statt eines redundanten.
  const allowedSet = new Set(allowed);
  const isDefault = sorted.length === allowedSet.size && sorted.every(n => allowedSet.has(n));
  const orig = found.item;
  const unchanged = isDefault
    ? !('layers' in orig)
    : Array.isArray(orig.layers) && orig.layers.length === sorted.length && orig.layers.every((n, i) => n === sorted[i]);
  if (unchanged) return plan;
  const patch = it => {
    if (it.id !== id) return it;
    if (isDefault) {
      const { layers: _drop, ...rest } = it;
      return rest;
    }
    return { ...it, layers: sorted };
  };
  return touch({ ...plan, placements: plan.placements.map(patch), unplaced: plan.unplaced.map(patch) });
}

export function setPieceTipped(plan, id, tipped, ctx) {
  const found = findPiece(plan, id);
  if (!found) return plan;
  const c = ctx.caseById.get(found.item.caseId);
  if (!c || !canTip(c)) return plan;
  if (found.list === 'unplaced') {
    if (found.item.tipped === tipped) return plan;
    const patch = it => (it.id === id ? { ...it, tipped } : it);
    return touch({ ...plan, unplaced: plan.unplaced.map(patch) });
  }
  const p = found.item;
  const isTippedNow = p.orientation !== 'standing';
  if (tipped && !isTippedNow) return cycleTip(plan, id, ctx);
  // Aufstellen NICHT über cycleTip: das tippt gerichtet „einmal weiter“ (nextTip() in geometry.js)
  // und kann je nach rot in einer ANDEREN getippten Lage landen statt auf standing.
  if (!tipped && isTippedNow) return reorient(plan, id, ctx, () => ({ orientation: 'standing', tipped: false }));
  if (p.tipped === tipped) return plan;
  const patch = it => (it.id === id ? { ...it, tipped } : it);
  return touch({ ...plan, placements: plan.placements.map(patch) });
}

export function setPieceGroup(plan, id, group) {
  const found = findPiece(plan, id);
  if (!found) return plan;
  const next = cleanGroup(group);
  if ((found.item.group ?? '') === next) return plan;
  const patch = it => {
    if (it.id !== id) return it;
    const { group: _drop, ...rest } = it;
    return next ? { ...rest, group: next } : rest;
  };
  return touch({ ...plan, placements: plan.placements.map(patch), unplaced: plan.unplaced.map(patch) });
}

// Rangliste der Pack-Regeln je Load (Spec 2026-09-30). Einmal gesetzt, wird packOrder nicht mehr
// gelesen (rulesFor). Unveränderte Regeln = gleiche Referenz, damit kein leerer Undo-Schritt entsteht.
export function setPackRules(plan, rules) {
  const next = normalizeRules(rules);
  if (Array.isArray(plan.packRules) && JSON.stringify(plan.packRules) === JSON.stringify(next)) return plan;
  return touch({ ...plan, packRules: next });
}

// Schalter „Deckschicht mischen“ je Load (Spec 2026-09-30-deckschicht-design.md). Aus = Feld fehlt,
// wie bei Altdaten; unverändert = gleiche Referenz (kein leerer Undo-Schritt).
export function setMixTop(plan, on) {
  if (mixTopFor(plan) === (on === true)) return plan;
  if (on === true) return touch({ ...plan, mixTop: true });
  const { mixTop: _drop, ...rest } = plan;
  return touch(rest);
}

export const removePlacement = (plan, id) =>
  touch({ ...plan, placements: plan.placements.filter(p => p.id !== id) });

// Placement -> Ablage-Eintrag (nur id/caseId/label?/color?/layers?/tipped?/group?, keine Positions-/Orientierungsfelder).
const placementToUnplaced = p =>
  ({ id: p.id, caseId: p.caseId, ...pickPieceFields(p) });

export function toTray(plan, id) {
  const p = plan.placements.find(q => q.id === id);
  if (!p) return plan;
  return touch({
    ...plan,
    placements: plan.placements.filter(q => q.id !== id),
    unplaced: [...plan.unplaced, placementToUnplaced(p)],
  });
}

export function unloadAll(plan) {
  if (!plan.placements.length) return plan;
  return touch({ ...plan, placements: [], unplaced: [...plan.unplaced, ...plan.placements.map(placementToUnplaced)] });
}

const orphans = (plan, ctx) => plan.unplaced.filter(u => !ctx.caseById.has(u.caseId));

// Wandelt ein Placement/Unplaced-Eintrag in ein Packer-Stück mit aufgelöstem Case um.
// Case nicht (mehr) in der Bibliothek → null (siehe orphans).
function toPiece(x, ctx) {
  const c = ctx.caseById.get(x.caseId);
  if (!c) return null;
  return {
    id: x.id, caseId: x.caseId, c, ...pickPieceFields(x),
  };
}

// Placements, deren Case-Typ nicht mehr in der Bibliothek steht, haben keine bekannten Maße (ein
// Placement speichert nur x/y/z) und können nicht als Hindernis an autoPack gehen. Statt sie
// unsichtbar unter frisch gepackten Cases liegen zu lassen, wandern sie beim Neupacken in die
// Ablage, wo der Nutzer sie sieht.
const missingCasePlacements = (plan, ctx) => plan.placements.filter(p => !ctx.caseById.has(p.caseId));

export function packAll(plan, ctx) {
  const list = [...plan.placements, ...plan.unplaced].map(x => toPiece(x, ctx)).filter(Boolean);
  const { placements, unplaced } = autoPack(list, ctx.truck, { rules: rulesFor(plan), mixTop: mixTopFor(plan) });
  return touch({
    ...plan,
    placements,
    unplaced: [...unplaced, ...orphans(plan, ctx), ...missingCasePlacements(plan, ctx).map(placementToUnplaced)],
  });
}

// Rest einpacken: neue Sorten schließen sortenrein an die LETZTE REIHE der vorhandenen Ladung an
// (startX = deren x0, nicht die Tür-Kante x1) und füllen so freie Spuren der letzten Reihe
// (Nutzerregel „Lücke auffüllen“), ohne vor dieser Reihe in fremde Blöcke zu geraten.
// Das Anschließen an die letzte Reihe ist eine eigene Entscheidung (Spec 2026-09-28).
export function packRest(plan, ctx) {
  const { items } = buildItems(plan, ctx.caseById);
  const list = plan.unplaced.map(u => toPiece(u, ctx)).filter(Boolean);
  const missing = missingCasePlacements(plan, ctx);
  if (!list.length && !missing.length) return plan;
  // Nur Bodenstücke (z0 ≈ 0) bestimmen die letzte Reihe – ein oben aufgesetztes Stück kann ein
  // größeres/kleineres x0 als sein Bodenstück haben und würde die Reihe sonst verfälschen.
  const floorItems = items.filter(it => Math.abs(it.box.z0) < 1e-6);
  const startX = floorItems.length ? Math.max(...floorItems.map(it => it.box.x0)) : 0;
  const { placements, unplaced } = list.length
    ? autoPack(list, ctx.truck, { obstacles: items.map(it => it.box), rules: rulesFor(plan), mixTop: mixTopFor(plan), startX })
    : { placements: [], unplaced: [] };
  return touch({
    ...plan,
    placements: [...plan.placements.filter(p => ctx.caseById.has(p.caseId)), ...placements],
    unplaced: [...unplaced, ...orphans(plan, ctx), ...missing.map(placementToUnplaced)],
  });
}
