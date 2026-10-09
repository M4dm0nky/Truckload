// Reine Zustandshelfer von app.js: Zustand rein, Ergebnis raus. Kein DOM, kein Store, kein
// Import von js/app.js (sonst Zyklus).
import { memoLast } from '../model/memo.js';
import { validatePlan } from '../model/validate.js';
import { DEFAULT_TRUCK_ID } from '../data/preset-trucks.js';

export const caseByIdOf = memoLast(cases => new Map(cases.map(c => [c.id, c])));

// Kontext für Aktionen: Case-Index, Fahrzeug des Plans (Standardfahrzeug als Rückfall), ID-Quelle.
// Setzt einen aktiven Plan voraus (s.plan.truckId).
export function ctxOf(s, newId) {
  return {
    caseById: caseByIdOf(s.cases),
    truck: s.trucks.find(t => t.id === s.plan.truckId) ?? s.trucks.find(t => t.id === DEFAULT_TRUCK_ID),
    newId,
  };
}

// Der Store liefert bei jeder Änderung neue Objekte; Aufrufer verändern das Ergebnis nicht.
const derived = memoLast((plan, cases, trucks, newId) => {
  const c = ctxOf({ plan, cases, trucks }, newId);
  return { ...c, result: validatePlan(plan, c.caseById, c.truck) };
});
export const deriveOf = (s, newId) => derived(s.plan, s.cases, s.trucks, newId);

// Aktueller Plan (falls vorhanden) plus alle übrigen gespeicherten, ohne Dublette.
export const allPlansOf = s => [s.plan, ...s.plans.filter(p => p.id !== s.plan?.id)].filter(Boolean);

// Alles, was ein Plan an Stücken führt: platzierte und Ablage.
export const piecesOf = plan => [...plan.placements, ...plan.unplaced];

// In wie vielen Plänen kommt der Case / das Fahrzeug vor?
export const usage = (s, caseId) =>
  allPlansOf(s).filter(p => piecesOf(p).some(x => x.caseId === caseId)).length;
export const truckUsage = (s, truckId) => allPlansOf(s).filter(p => p.truckId === truckId).length;
