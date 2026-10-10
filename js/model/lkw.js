// Mehrere LKW in einem Plan (Spec 2026-10-10). Reine Funktionen auf dem Plan; nichts davon kennt
// Packer oder Oberfläche.
//
// Datenmodell: `plan.lkws?: [{ id, name, truckId, categories }]`. Fehlt das Feld oder ist die Liste
// leer, ist der Plan ein gewöhnlicher Ein-LKW-Plan (`plan.truckId`) – es gibt keine Migration. Mit
// `lkws` trägt jedes Stück (Platzierung und Ablage-Eintrag) optional `lkw: <lkw.id>`; ohne oder mit
// unbekannter ID ist es nicht zugeordnet. `lkw` gehört NICHT zu PIECE_FIELDS: Aktionen und Packer
// arbeiten auf einer Ansicht (lkwView) ohne das Feld, mergeLkwView setzt es beim Zurückschreiben.
//
// `plan.truckId` bleibt solange `lkws` existieren das Fahrzeug des ERSTEN LKW (Rückfallwert für
// alte Programmstände); jede Funktion hier hält das ein. Eine Platzierung gehört immer einem LKW –
// Platzierungen ohne gültigen Verweis gibt es nur in fremden Altdaten, sie zählen als nicht
// zugeordnet und liegen dann in der Ablage (unassignedView, Import).
import { stamp } from './stamp.js';
import { placementToUnplaced } from './actions.js';
import { MAX_LKW, NAME_MAX } from './limits.js';
import { CATEGORIES } from '../data/categories.js';

// Pseudo-ID des Reiters „Ohne LKW“ (nicht zugeordnete Stücke); nie eine echte LKW-ID (UUIDs).
export const NO_LKW = '__ohne-lkw';
// Alles, was ein Plan an Stücken führt: platzierte und Ablage.
export const piecesOf = plan => [...plan.placements, ...plan.unplaced];

export const lkwsOf = plan => (Array.isArray(plan?.lkws) ? plan.lkws : []);
export const isMultiLkw = plan => lkwsOf(plan).length > 0;

const knownIds = plan => new Set(lkwsOf(plan).map(l => l.id));
const findLkw = (plan, id) => lkwsOf(plan).find(l => l.id === id);
// Auflösung einer LKW-ID für Aufrufer mit einer möglicherweise veralteten ID (gewählter Reiter nach
// Rückgängig oder Löschen): bekannte ID bleibt, sonst der ERSTE LKW, ohne LKW null. So stürzt nichts
// ab und keine Bearbeitung geht still verloren; sie landet im ersten LKW. Gilt für lkwView,
// mergeLkwView, updateLkw und das Ziel (NICHT removeLkw: destruktiv, unbekannte ID = No-Op) von moveToLkw.
export function resolveLkwId(plan, id) {
  const list = lkwsOf(plan);
  return list.some(l => l.id === id) ? id : (list[0]?.id ?? null);
}
const withLkw = (x, id) => ({ ...x, lkw: id });
const withoutLkw = x => { const { lkw: _drop, ...rest } = x; return rest; };
const validTruck = t => typeof t === 'string' && t !== '';
const defaultId = () => crypto.randomUUID();

// Gewerke: nur bekannte Namen aus CATEGORIES, ohne Duplikate, in Eingabereihenfolge.
const CATEGORY_NAMES = new Set(CATEGORIES.map(c => c.name));
const cleanCategories = list =>
  [...new Set((Array.isArray(list) ? list : []).filter(n => CATEGORY_NAMES.has(n)))];
const cleanName = (name, fallback) => {
  const n = typeof name === 'string' ? name.trim().slice(0, NAME_MAX) : '';
  return n || fallback;
};

// Hält plan.truckId am Fahrzeug des ersten LKW.
const syncTruck = plan => (isMultiLkw(plan) ? { ...plan, truckId: plan.lkws[0].truckId } : plan);

// ---- Ansichten ----------------------------------------------------------------------

// Normaler Ein-LKW-Plan dieses LKW: Fahrzeug des LKW, nur seine Stücke, ohne `lkws` und ohne
// `lkw`-Felder. Alle bestehenden Funktionen arbeiten darauf unverändert.
export function lkwView(plan, lkwId) {
  const id = resolveLkwId(plan, lkwId);
  if (id === null) return plan; // Ein-LKW-Plan: die Ansicht ist der Plan selbst
  const lkw = findLkw(plan, id);
  const { lkws: _l, ...rest } = plan;
  return {
    ...rest,
    truckId: lkw.truckId,
    placements: plan.placements.filter(p => p.lkw === id).map(withoutLkw),
    unplaced: plan.unplaced.filter(u => u.lkw === id).map(withoutLkw),
  };
}

// Die nicht zugeordneten Stücke als Ablage-Ansicht (keine Platzierungen): Ablage-Einträge ohne
// gültigen `lkw`, dazu Platzierungen ohne gültigen `lkw` als Ablage-Einträge.
export function unassignedView(plan) {
  const known = knownIds(plan);
  const free = x => !known.has(x.lkw);
  const { lkws: _l, ...rest } = plan;
  return {
    ...rest,
    placements: [],
    unplaced: [
      ...plan.unplaced.filter(free).map(withoutLkw),
      ...plan.placements.filter(free).map(placementToUnplaced),
    ],
  };
}

// Ersetzt in `list` die Stücke des LKW durch `viewItems`. Eigene Reihenfolge-Regel (eigene
// Entscheidung, deterministisch): die Plätze der bisherigen Stücke des LKW werden der Reihe nach mit
// den Stücken der Ansicht belegt (in Ansichts-Reihenfolge); überzählige Ansichts-Stücke kommen ans
// Ende, übrige Plätze entfallen. Fremde und nicht zugeordnete Stücke behalten Platz und Inhalt; mit
// der Identität als Ansicht kommt die Liste unverändert zurück.
function spliceOwn(list, lkwId, viewItems) {
  const mine = viewItems.map(x => withLkw(x, lkwId));
  let i = 0;
  const out = [];
  for (const x of list) {
    if (x.lkw !== lkwId) out.push(x);
    else if (i < mine.length) out.push(mine[i++]);
  }
  out.push(...mine.slice(i));
  return out;
}

// Schreibt das Ergebnis einer Ansicht zurück. Plan-Felder der Ansicht (Notizen, Pack-Regeln …)
// gelten; `lkws` und `truckId` bleiben die des Plans – ein Fahrzeugwechsel im LKW läuft über
// updateLkw. Veraltete LKW-ID: erster LKW (resolveLkwId). Ein-LKW-Plan: die Ansicht ist das Ergebnis.
export function mergeLkwView(plan, lkwId, view) {
  const id = resolveLkwId(plan, lkwId);
  if (id === null) return view;
  return stamp({
    ...view,
    truckId: plan.truckId,
    lkws: plan.lkws,
    placements: spliceOwn(plan.placements, id, view.placements),
    unplaced: spliceOwn(plan.unplaced, id, view.unplaced),
  });
}

// ---- Bearbeiten ---------------------------------------------------------------------

// Ein-LKW-Plan -> Mehr-LKW-Plan mit einem LKW „LKW 1“ (bisheriges Fahrzeug, alle Gewerke = Rest-LKW),
// dem alle Stücke zugeordnet sind. Schon ein Mehr-LKW-Plan: unverändert.
export function convertToMulti(plan, newId = defaultId) {
  if (isMultiLkw(plan)) return plan;
  const id = newId();
  return stamp({
    ...plan,
    lkws: [{ id, name: 'LKW 1', truckId: plan.truckId, categories: [] }],
    placements: plan.placements.map(p => withLkw(p, id)),
    unplaced: plan.unplaced.map(u => withLkw(u, id)),
  });
}

// Hängt einen LKW an (Ein-LKW-Pläne werden vorher umgewandelt). Über MAX_LKW: unverändert.
export function addLkw(plan, { name, truckId, categories } = {}, newId = defaultId) {
  const base = convertToMulti(plan, newId);
  if (base.lkws.length >= MAX_LKW) return plan;
  const lkw = {
    id: newId(),
    name: cleanName(name, `LKW ${base.lkws.length + 1}`),
    // Fahrzeug immer ein nichtleerer String (der Import lehnt sonst ab): Rückfall erster LKW.
    truckId: validTruck(truckId) ? truckId : base.lkws[0].truckId,
    categories: cleanCategories(categories),
  };
  return stamp(syncTruck({ ...base, lkws: [...base.lkws, lkw] }));
}

// Ändert Name, Fahrzeug oder Gewerke; die ID bleibt.
export function updateLkw(plan, lkwId, patch = {}) {
  const id = resolveLkwId(plan, lkwId);
  if (id === null) return plan;
  const cur = findLkw(plan, id);
  const next = {
    ...cur,
    ...(patch.name !== undefined ? { name: cleanName(patch.name, cur.name) } : {}),
    ...(validTruck(patch.truckId) ? { truckId: patch.truckId } : {}),
    ...(patch.categories !== undefined ? { categories: cleanCategories(patch.categories) } : {}),
  };
  return stamp(syncTruck({ ...plan, lkws: plan.lkws.map(l => (l.id === id ? next : l)) }));
}

// Entfernt einen LKW. Seine Stücke werden NICHT einem anderen zugeordnet: `lkw` entfällt,
// Platzierungen wandern in die Ablage. Der letzte LKW verschwindet samt `lkws` – der Plan ist dann
// wieder ein Ein-LKW-Plan (mit dem Fahrzeug des gelöschten LKW in `truckId`, alle Stücke ohne
// Feld `lkw`, Platzierungen in der Ablage).
export function removeLkw(plan, id) {
  // Destruktiv: unbekannte (veraltete) ID ist ein No-Op, kein Rückfall auf den ersten LKW.
  if (!findLkw(plan, id)) return plan;
  const rest = plan.lkws.filter(l => l.id !== id);
  const mineP = p => p.lkw === id;
  const base = {
    ...plan,
    placements: plan.placements.filter(p => !mineP(p)),
    unplaced: [
      ...plan.unplaced.map(u => (mineP(u) ? withoutLkw(u) : u)),
      ...plan.placements.filter(mineP).map(placementToUnplaced),
    ],
  };
  if (rest.length > 0) return stamp(syncTruck({ ...base, lkws: rest }));
  const { lkws: _l, ...single } = base;
  return stamp({
    ...single,
    placements: single.placements.map(withoutLkw),
    unplaced: single.unplaced.map(withoutLkw),
  });
}

// Verschiebt ein Stück zu einem LKW (oder mit `null` zu „ohne LKW“). Eine Platzierung wandert in
// die Ablage des Ziels, eine Ablage-Zeile bleibt in der Ablage. Gleicher LKW oder unbekanntes Stück:
// Plan unverändert; ein veraltetes Ziel fällt auf den ersten LKW (resolveLkwId).
export function moveToLkw(plan, pieceId, lkwIdOrNull) {
  if (!isMultiLkw(plan)) return plan;
  const target = lkwIdOrNull == null ? null : resolveLkwId(plan, lkwIdOrNull);
  const place = plan.placements.find(p => p.id === pieceId);
  const tray = place ? null : plan.unplaced.find(u => u.id === pieceId);
  const piece = place ?? tray;
  if (!piece) return plan;
  // „gleicher LKW“: undefined (nicht zugeordnet) gilt gleich null, auch bei unbekannter Alt-ID.
  const cur = knownIds(plan).has(piece.lkw) ? piece.lkw : null;
  if (cur === target) return plan;
  const row = place ? placementToUnplaced(place) : tray;
  const moved = target === null ? withoutLkw(row) : withLkw(row, target);
  return stamp(place
    ? { ...plan, placements: plan.placements.filter(p => p.id !== pieceId), unplaced: [...plan.unplaced, moved] }
    : { ...plan, unplaced: plan.unplaced.map(u => (u.id === pieceId ? moved : u)) });
}
