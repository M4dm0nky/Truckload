// Reine Zustandshelfer von app.js: Zustand rein, Ergebnis raus. Kein DOM, kein Store, kein
// Import von js/app.js (sonst Zyklus).
import { memoLast } from '../model/memo.js';
import { validatePlan } from '../model/validate.js';
import { DEFAULT_TRUCK_ID } from '../data/preset-trucks.js';
import { stamp } from '../model/stamp.js';
import { lkwsOf, isMultiLkw, resolveLkwId, lkwView, unassignedView, mergeLkwView } from '../model/lkw.js';
import { packAllLkws, unassignedByCategory } from '../model/lkw-distribute.js';
import { packAll, placementToUnplaced } from '../model/actions.js';

export const caseByIdOf = memoLast(cases => new Map(cases.map(c => [c.id, c])));

// ---- Mehrere LKW: gewählter Reiter -------------------------------------------------------

// Pseudo-ID des Reiters „Ohne LKW“ (nicht zugeordnete Stücke). Nie eine echte LKW-ID (UUIDs).
export const NO_LKW = '__ohne-lkw';
const knownLkwIds = plan => new Set(lkwsOf(plan).map(l => l.id));
export const hasUnassigned = plan => {
  const known = knownLkwIds(plan);
  return [...plan.placements, ...plan.unplaced].some(x => !known.has(x.lkw));
};

// Der gültige gewählte Reiter: null bei Ein-LKW-Plänen; sonst die gewählte LKW-ID, NO_LKW (solange
// es nicht zugeordnete Stücke gibt) oder – bei veraltetem Wert (Rückgängig, gelöschter LKW) – der
// erste LKW. Rein; der Store hält nur den rohen Wert.
export function activeLkwOf(plan, activeLkw) {
  if (!isMultiLkw(plan)) return null;
  if (activeLkw === NO_LKW && hasUnassigned(plan)) return NO_LKW;
  return resolveLkwId(plan, activeLkw === NO_LKW ? null : activeLkw);
}

// Der Plan, auf dem Aktionen und Ansichten arbeiten: bei Ein-LKW-Plänen der Plan selbst, sonst die
// Ansicht des gewählten Reiters (lkwView bzw. die Ablage der nicht zugeordneten Stücke).
export function activeViewOf(plan, activeLkw) {
  const id = activeLkwOf(plan, activeLkw);
  if (id === null) return plan;
  return id === NO_LKW ? unassignedView(plan) : lkwView(plan, id);
}

const truckFinder = trucks => id =>
  trucks.find(t => t.id === id) ?? trucks.find(t => t.id === DEFAULT_TRUCK_ID);

// Kontext für Aktionen: Case-Index, Fahrzeug des Plans bzw. des gewählten LKW (Standardfahrzeug als
// Rückfall), ID-Quelle. Setzt einen aktiven Plan voraus. Ein-LKW-Plan: genau {caseById, truck, newId}
// wie bisher; Mehr-LKW-Plan zusätzlich `truckById` (für die Verteilung über alle LKW).
export function ctxOf(s, newId) {
  const find = truckFinder(s.trucks);
  const caseById = caseByIdOf(s.cases);
  if (!isMultiLkw(s.plan)) return { caseById, truck: find(s.plan.truckId), newId };
  const id = activeLkwOf(s.plan, s.activeLkw);
  const lkw = lkwsOf(s.plan).find(l => l.id === id);
  return {
    caseById, truck: find(lkw ? lkw.truckId : s.plan.truckId), newId,
    truckById: new Map(s.trucks.map(t => [t.id, t])),
  };
}
// Kontext für planweite Aktionen (alle LKW): Rückfallfahrzeug ist das des Plans (= erster LKW).
export function wholeCtxOf(s, newId) {
  return { ...ctxOf(s, newId), truck: truckFinder(s.trucks)(s.plan.truckId) };
}

// Schreibt die Ansicht der nicht zugeordneten Stücke zurück (Gegenstück zu mergeLkwView): die
// Stücke der LKW bleiben, die nicht zugeordneten werden durch die Ansicht ersetzt.
export function mergeUnassignedView(plan, view) {
  const known = knownLkwIds(plan);
  return stamp({
    ...view,
    truckId: plan.truckId,
    lkws: plan.lkws,
    placements: plan.placements.filter(p => known.has(p.lkw)),
    // Platzierungen der Ansicht (kommen nur von einer fremden Aktion) gehen in die Ablage, nie verloren.
    unplaced: [...plan.unplaced.filter(u => known.has(u.lkw)), ...view.unplaced, ...view.placements.map(placementToUnplaced)],
  });
}

// Eine Bearbeitung des Stores. Ein-LKW-Plan: fn(plan) wie bisher. Mehr-LKW-Plan: fn arbeitet auf der
// Ansicht des gewählten Reiters (mit dessen Fahrzeug) und wird per mergeLkwView zurückgeschrieben –
// ein einziger Plan-Wechsel, also ein Rückgängig-Schritt. Gibt `s` zurück, wenn nichts passiert.
export function applyEdit(s, fn, newId) {
  const plan = s.plan;
  if (!isMultiLkw(plan)) {
    const next = fn(plan, ctxOf(s, newId));
    return next === plan ? s : { ...s, plan: next };
  }
  const id = activeLkwOf(plan, s.activeLkw);
  const view = activeViewOf(plan, s.activeLkw);
  const next = fn(view, ctxOf(s, newId));
  if (next === view) return s;
  const merged = id === NO_LKW ? mergeUnassignedView(plan, next) : mergeLkwView(plan, id, next);
  return merged === plan ? s : { ...s, plan: merged };
}
// Wie applyEdit, aber fn bekommt den ganzen Plan und den planweiten Kontext (Packen aller LKW,
// Zuordnen, Fahrzeug eines LKW, neues Material ohne Zuordnung).
export function applyEditWhole(s, fn, newId) {
  const next = fn(s.plan, wholeCtxOf(s, newId));
  return next === s.plan ? s : { ...s, plan: next };
}

// „Alles neu packen“ für den ganzen Plan: bei Mehr-LKW-Plänen die Verteilung (packAllLkws), sonst
// das bisherige packAll.
export const packAllOf = (plan, ctx) => (isMultiLkw(plan) ? packAllLkws(plan, ctx) : packAll(plan, ctx));

// Fahrzeug ist weg: Plan (und seine LKW) auf das Ersatzfahrzeug umbiegen. Unverändert (dieselbe
// Referenz), wenn nichts auf das Fahrzeug zeigt.
export function repointTruck(plan, truckId, fallbackId = DEFAULT_TRUCK_ID) {
  if (!isMultiLkw(plan)) return plan.truckId === truckId ? stamp({ ...plan, truckId: fallbackId }) : plan;
  if (!plan.lkws.some(l => l.truckId === truckId)) return plan;
  const lkws = plan.lkws.map(l => (l.truckId === truckId ? { ...l, truckId: fallbackId } : l));
  return stamp({ ...plan, lkws, truckId: lkws[0].truckId });
}

// Hinweise nach dem Packen. Einzel-LKW: wie bisher die Ablage. Alle-LKW-Verteilung: Stücke ohne LKW
// (je Gewerk; unbekannter Case eigens) und Stücke, die in ihrem LKW keinen Platz fanden.
const stueck = n => (n === 1 ? '1 Stück' : `${n} Stücke`);
export function distributionNotices(plan, caseById) {
  const lines = unassignedByCategory(plan, caseById).map(({ category, count }) =>
    (category === null ? `${stueck(count)} mit unbekanntem Case` : `${stueck(count)} ohne LKW (${category})`));
  const known = knownLkwIds(plan);
  const left = plan.unplaced.filter(u => known.has(u.lkw)).length;
  if (left) lines.push(`${stueck(left)} ${left === 1 ? 'passt' : 'passen'} nicht in den LKW und ${left === 1 ? 'bleibt' : 'bleiben'} in „Noch nicht geladen“`);
  return lines;
}

// Der Store liefert bei jeder Änderung neue Objekte; Aufrufer verändern das Ergebnis nicht.
// `view` ist der Plan des gewählten Reiters (bei Ein-LKW-Plänen der Plan selbst), `result` seine Prüfung.
const derived = memoLast((plan, cases, trucks, newId, activeLkw) => {
  const c = ctxOf({ plan, cases, trucks, activeLkw }, newId);
  const view = activeViewOf(plan, activeLkw);
  return { ...c, view, activeLkw: activeLkwOf(plan, activeLkw), result: validatePlan(view, c.caseById, c.truck) };
});
export const deriveOf = (s, newId) => derived(s.plan, s.cases, s.trucks, newId, s.activeLkw ?? null);

// Aktueller Plan (falls vorhanden) plus alle übrigen gespeicherten, ohne Dublette.
export const allPlansOf = s => [s.plan, ...s.plans.filter(p => p.id !== s.plan?.id)].filter(Boolean);

// Alles, was ein Plan an Stücken führt: platzierte und Ablage.
export const piecesOf = plan => [...plan.placements, ...plan.unplaced];

// In wie vielen Plänen kommt der Case / das Fahrzeug vor?
export const usage = (s, caseId) =>
  allPlansOf(s).filter(p => piecesOf(p).some(x => x.caseId === caseId)).length;
export const truckUsage = (s, truckId) =>
  allPlansOf(s).filter(p => p.truckId === truckId || lkwsOf(p).some(l => l.truckId === truckId)).length;
