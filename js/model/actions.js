import { ORIENTATIONS, boxOf, effectiveDims, gravityZ, snap, snapToEdges, stackAbove, rotForWheelFace, DOOR_FACE, MAX_LABEL } from './geometry.js';
import { archBoxes, buildItems } from './validate.js';
import { autoPack } from './packer.js';
import { canTip } from './truss.js';

const touch = plan => ({ ...plan, updatedAt: new Date().toISOString() });

export const emptyPlan = (id, name, truckId) =>
  touch({ id, name, truckId, placements: [], unplaced: [], notes: '' });

// Nimmt schon aufgelöste `items` statt (plan, ctx) entgegen: moveGroup und reorient bauen die
// Items für die eigene Stapel-/Gruppenlogik ohnehin schon selbst und riefen otherBoxes bisher mit
// (plan, ctx) auf, das intern ein zweites Mal buildItems() über alle Placements laufen ließ — bei
// jeder Maus-Bewegung eines Stapels doppelt (docs/code-review-2026-09-21.md, „actions.js:10-13“).
function otherBoxes(items, truck, excludeIds) {
  return [...items.filter(it => !excludeIds.includes(it.id)).map(it => it.box), ...archBoxes(truck)];
}

function settle(p, c, others) {
  return { ...p, z: gravityZ(boxOf(c, { ...p, z: 0 }), others) };
}

export function addUnplaced(plan, caseId, n, newId, { labels = [], color = null } = {}) {
  const extra = Array.from({ length: n }, (_, i) => ({
    id: newId(), caseId,
    ...(labels[i] ? { label: labels[i].slice(0, MAX_LABEL) } : {}),
    ...(color ? { color } : {}),
  }));
  return touch({ ...plan, unplaced: [...plan.unplaced, ...extra] });
}

// Entfernt EIN bestimmtes Stück aus der Ablage, exakt über seine eigene `id` – nicht mehr über
// `caseId` (der nur den Case-Typ trifft, nicht ein bestimmtes Exemplar). Vorher traf das erste
// Vorkommen dieses Typs, unabhängig davon, welche Beschriftung der Nutzer eigentlich anklickte
// (docs/code-review-2026-09-21.md, „actions.js:28-32“) – seit die Ablage die einzelnen
// Beschriftungen zeigt, muss „−“ gezielt das angeklickte Stück treffen, nicht irgendeins seines Typs.
export function removeUnplaced(plan, id) {
  const next = plan.unplaced.filter(u => u.id !== id);
  if (next.length === plan.unplaced.length) return plan;
  return touch({ ...plan, unplaced: next });
}

export function placeCase(plan, caseId, { x, y }, ctx, { fromUnplacedId = null } = {}) {
  const c = ctx.caseById.get(caseId);
  if (!c) return plan;
  const src = fromUnplacedId ? plan.unplaced.find(u => u.id === fromUnplacedId) : null;
  // Nur die bekannten Stück-Felder aus der Ablage übernehmen (label/color), nicht das ganze
  // Objekt spreaden: ein Ablage-Eintrag aus einer fremden Importdatei könnte ein eigenes x/y/z
  // tragen (io.js verbietet in `unplaced` keine Zusatzfelder) und würde die gerade gewählte
  // Mausposition sonst stillschweigend überschreiben (docs/code-review-2026-09-21.md,
  // „actions.js:38-39 — srcExtra überschreibt x/y/z/orientation/rot“).
  const { label, color } = src ?? {};
  const srcExtra = { ...(label ? { label } : {}), ...(color ? { color } : {}) };
  const base = { id: fromUnplacedId ?? ctx.newId(), caseId, x: snap(x), y: snap(y), z: 0, orientation: 'standing', rot: 0, ...srcExtra };
  const p = settle(base, c, otherBoxes(buildItems(plan, ctx.caseById).items, ctx.truck, []));
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

// Bewusst entschieden (docs/code-review-2026-09-21.md, „actions.js:70-79 — reorient lässt den
// Stapel über dem gedrehten Case stehen“): `stackAbove(id, items)` wird nur berechnet, um den
// eigenen Stapel aus den Hindernissen auszuschließen (sonst kollidiert das Case beim Drehen mit
// sich selbst). Er wird NICHT nachgezogen, wenn sich dadurch die Höhe des Cases ändert (z. B.
// beim Tippen) – ein „unsupported“ erscheint dann sofort in der Warnliste, und der Nutzer sieht
// unmittelbar, dass er den Stapel selbst nachziehen muss. Automatisches Nachziehen (wie es
// `moveGroup` für den bewegten Stapel selbst tut) würde hier zusätzlich JEDES Case über dem
// gedrehten mitbewegen, ohne dass der Nutzer das angestoßen hat – eine Nebenwirkung, die beim
// bloßen Drehen/Tippen eines einzelnen Cases nicht erwartbar ist.
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
    const next = ORIENTATIONS[(ORIENTATIONS.indexOf(p.orientation) + 1) % ORIENTATIONS.length];
    // Jeder Übergang in eine getippte Lage setzt die Rollen zur Trucktür (auch
    // tipLong → tipShort); die freie Wahl der Richtung danach läuft über setWheelFace.
    return next === 'standing'
      ? { orientation: next }
      : { orientation: next, rot: rotForWheelFace(next, DOOR_FACE) };
  });

// Dreht ein bereits getipptes Case so, dass die Rollen zur gewünschten Seite zeigen.
// Ist die Richtung für die aktuelle Lage nicht erreichbar (z. B. „standing“, Traverse), passiert nichts.
export const setWheelFace = (plan, id, face, ctx) =>
  reorient(plan, id, ctx, (p, c) => {
    if (!canTip(c)) return {};
    const rot = rotForWheelFace(p.orientation, face);
    return rot == null ? {} : { rot };
  });

// Zählt die letzte Zahl im Label hoch (z. B. für "duplicate()"). Nur wenn die Zahl ganz am Ende
// steht wird hochgezählt ("Case 3 von 8" -> "Case 3 von 9", so wie es in der Praxis benutzt wird,
// docs/code-review-2026-09-21.md, „actions.js:104-108“) – steht danach noch Text, greift die
// Regex nicht und das Label bleibt unverändert. `padStart` erhält dabei die Stellenzahl der
// ursprünglichen Zahl ("Case 09" -> "Case 10", nicht "Case 010"; "Case 9" -> "Case 10" bleibt vom
// Auffüllen unberührt) – ohne das würde eine führende Null beim Hochzählen stillschweigend
// verschwinden. Die hochgezählte Zahl kann trotzdem ein Zeichen länger sein als die ursprüngliche
// (9 -> 10) – ohne Kürzung entstünde so aus einem legalen 40-Zeichen-Label eins mit 41 Zeichen,
// das der eigene Import ablehnt (Befund B4).
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
  // Die Kopie zuerst hinter dem Original versuchen (wie bisher), bei Überstand über die
  // Heckkante stattdessen davor, sonst seitlich daneben (y) – erst wenn auch das nicht in den
  // Laderaum passt, landet die Kopie in der Ablage statt an einer Position, die sofort zwei
  // "outOfBounds"-Meldungen erzeugt (docs/code-review-2026-09-21.md, „actions.js:110-118“).
  // Kollisionen MIT ANDEREN Cases prüft das bewusst nicht (das behandelt `validatePlan` wie bei
  // jeder Platzierung) – hier geht es nur um den Fall, dass der Truck an der Stelle zu Ende ist.
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
  const trayEntry = { id: ctx.newId(), caseId: p.caseId, ...(label ? { label } : {}), ...(p.color ? { color: p.color } : {}) };
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

export const removePlacement = (plan, id) =>
  touch({ ...plan, placements: plan.placements.filter(p => p.id !== id) });

// Placement -> Ablage-Eintrag (nur id/caseId/label?/color?, keine Positions-/Lagefelder).
const placementToUnplaced = p =>
  ({ id: p.id, caseId: p.caseId, ...(p.label ? { label: p.label } : {}), ...(p.color ? { color: p.color } : {}) });

export function toTray(plan, id) {
  const p = plan.placements.find(q => q.id === id);
  if (!p) return plan;
  return touch({
    ...plan,
    placements: plan.placements.filter(q => q.id !== id),
    unplaced: [...plan.unplaced, placementToUnplaced(p)],
  });
}

const orphans = (plan, ctx) => plan.unplaced.filter(u => !ctx.caseById.has(u.caseId));

// Wandelt ein Placement/Unplaced-Eintrag in ein Packer-Stück mit aufgelöstem Case um.
// Case nicht (mehr) in der Bibliothek → null (siehe orphans).
function toPiece(x, ctx) {
  const c = ctx.caseById.get(x.caseId);
  if (!c) return null;
  return { id: x.id, caseId: x.caseId, c, ...(x.label ? { label: x.label } : {}), ...(x.color ? { color: x.color } : {}) };
}

// Placements, deren Case-Typ nicht mehr in der Bibliothek steht. Sie haben keine bekannten
// Maße (ein Placement speichert nur x/y/z, keine l/w/h – die kommen ausschließlich vom
// Case-Typ) und können deshalb nicht als Box-Hindernis an autoPack übergeben werden. Statt
// sie unverändert an ihrer alten Position zu belassen – wo ein frisch gepacktes Case sie
// geometrisch überdecken könnte, ohne dass das irgendwo sichtbar würde (Befund „packAll
// packt in sie hinein“) – werden sie beim Neupacken sichtbar in die Ablage verschoben. Der
// Nutzer sieht sie dort (statt zweier Cases im selben Raum) und kann reagieren.
const missingCasePlacements = (plan, ctx) => plan.placements.filter(p => !ctx.caseById.has(p.caseId));

export function packAll(plan, ctx) {
  const list = [...plan.placements, ...plan.unplaced].map(x => toPiece(x, ctx)).filter(Boolean);
  const { placements, unplaced } = autoPack(list, ctx.truck);
  return touch({
    ...plan,
    placements,
    unplaced: [...unplaced, ...orphans(plan, ctx), ...missingCasePlacements(plan, ctx).map(placementToUnplaced)],
  });
}

export function packRest(plan, ctx) {
  const { items } = buildItems(plan, ctx.caseById);
  const list = plan.unplaced.map(u => toPiece(u, ctx)).filter(Boolean);
  const missing = missingCasePlacements(plan, ctx);
  if (!list.length && !missing.length) return plan;
  const { placements, unplaced } = list.length
    ? autoPack(list, ctx.truck, { obstacles: items.map(it => it.box) })
    : { placements: [], unplaced: [] };
  return touch({
    ...plan,
    placements: [...plan.placements.filter(p => ctx.caseById.has(p.caseId)), ...placements],
    unplaced: [...unplaced, ...orphans(plan, ctx), ...missing.map(placementToUnplaced)],
  });
}
