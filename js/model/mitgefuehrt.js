// Ein Ladeplan führt die Cases und Fahrzeuge mit, auf die er verweist (`plan.mitgefuehrt`), damit
// eine Projektdatei bzw. Sicherung auf einem anderen Rechner vollständig ist (Spec
// 2026-10-14-truckload-projektdatei-vollstaendig-design.md im NYX-Repo).
// Regel: die Bibliothek gewinnt immer, die Kopie füllt nur fehlende IDs. Rein, ohne DOM und Store.

export const MITGEFUEHRT_VERSION = 1;

const gueltig = x => x && typeof x === 'object' && typeof x.id === 'string' && x.id !== '';
const liste = x => (Array.isArray(x) ? x : []);

export function referenzen(plan) {
  const caseIds = new Set();
  for (const x of [...liste(plan?.placements), ...liste(plan?.unplaced)]) if (typeof x?.caseId === 'string') caseIds.add(x.caseId);
  const truckIds = new Set();
  if (typeof plan?.truckId === 'string') truckIds.add(plan.truckId);
  for (const l of liste(plan?.lkws)) if (typeof l?.truckId === 'string') truckIds.add(l.truckId);
  return { caseIds, truckIds };
}

const ergaenze = (bibliothek, kopie, gewollt) => {
  const bekannt = new Set(bibliothek.map(x => x.id));
  const dazu = liste(kopie).filter(x => gueltig(x) && !bekannt.has(x.id) && gewollt.has(x.id));
  return { liste: dazu.length ? [...bibliothek, ...dazu] : bibliothek, ids: new Set(dazu.map(x => x.id)) };
};

export function bestandFuer(cases, trucks, plan) {
  const m = plan?.mitgefuehrt;
  if (!m) return { cases, trucks, ausProjekt: { cases: new Set(), trucks: new Set() } };
  const r = referenzen(plan);
  const c = ergaenze(cases, m.cases, r.caseIds);
  const t = ergaenze(trucks, m.trucks, r.truckIds);
  return { cases: c.liste, trucks: t.liste, ausProjekt: { cases: c.ids, trucks: t.ids } };
}

const ohneSammlung = c => { const { collectionId, ...rest } = c; return rest; };

export function mitfuehren(plan, cases, trucks) {
  const b = bestandFuer(cases, trucks, plan);
  const r = referenzen(plan);
  const caseById = new Map(b.cases.map(c => [c.id, c]));
  const truckById = new Map(b.trucks.map(t => [t.id, t]));
  const neu = {
    version: MITGEFUEHRT_VERSION,
    cases: [...r.caseIds].sort().map(id => caseById.get(id)).filter(Boolean).map(ohneSammlung),
    trucks: [...r.truckIds].sort().map(id => truckById.get(id)).filter(Boolean),
  };
  if (plan.mitgefuehrt && JSON.stringify(plan.mitgefuehrt) === JSON.stringify(neu)) return plan;
  return { ...plan, mitgefuehrt: neu };
}
