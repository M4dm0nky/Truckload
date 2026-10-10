// Verteilung der Stücke auf die LKW eines Plans und Packen je LKW (Spec 2026-10-10, „Verteilung“).
// Reine Funktionen. ctx wie bei den Aktionen ({ caseById, truck, newId }) plus – nur hier – eine
// Fahrzeugsuche `truckById` (Map); ein LKW, dessen Fahrzeug fehlt, nimmt ctx.truck (Standardfahrzeug).
import { stamp } from './stamp.js';
import { packAll, packRest, placementToUnplaced } from './actions.js';
import { chooseOrientation } from './packer.js';
import { volumeOf } from './packRules.js';
import { CATEGORIES } from '../data/categories.js';
import { lkwsOf, isMultiLkw, lkwView, mergeLkwView } from './lkw.js';

const truckOf = (lkw, ctx) => ctx.truckById?.get(lkw.truckId) ?? ctx.truck;
const withLkw = (x, id) => ({ ...x, lkw: id });
const withoutLkw = x => { const { lkw: _d, ...rest } = x; return rest; };
const weightOf = c => (typeof c.weight === 'number' && Number.isFinite(c.weight) && c.weight > 0 ? c.weight : 0);
// Case ohne Gewerk gilt als „Sonstiges“ (Vorgabe im Case-Editor).
const catOf = c => c.category || 'Sonstiges';
const catRank = name => { const i = CATEGORIES.findIndex(c => c.name === name); return i < 0 ? CATEGORIES.length : i; };

// Zulässige LKW eines Stücks in Listenreihenfolge: die LKW mit angehaktem Gewerk, sonst die
// Rest-LKW (ohne Haken). Ein LKW zählt nur, wenn sein Fahrzeug das Stück in irgendeiner
// Orientierung aufnehmen kann; ist keiner der Gewerk-LKW tauglich, bleiben die tauglichen Rest-LKW.
// `orient` = Orientierung je LKW-ID (für die Fläche), nur für taugliche LKW.
function eligibleFor(piece, c, lkws, ctx) {
  const fits = new Map();
  for (const l of lkws) {
    const truck = truckOf(l, ctx);
    const o = truck ? chooseOrientation(c, truck, piece) : null;
    if (o) fits.set(l.id, o);
  }
  const byCat = lkws.filter(l => l.categories.includes(catOf(c)) && fits.has(l.id));
  const list = byCat.length ? byCat : lkws.filter(l => l.categories.length === 0 && fits.has(l.id));
  return { list, fits };
}

// Verteilt ALLE Stücke (Platzierungen und Ablage) neu. Ergebnis: jedes Stück liegt in der Ablage
// (`placements: []`), mit `lkw` oder – ohne zulässigen LKW – ohne Feld. Eigene Entscheidungen:
// Gewerke werden in CATEGORIES-Reihenfolge abgearbeitet (unbekannte danach); die Auslastung zählt
// über alle Gewerke hinweg; Stücke ohne bekannten Case bleiben nicht zugeordnet.
// Die Hilfsfunktionen vertragen ein fehlendes Fahrzeug (kein ctx.truck, kein Treffer in truckById).
export function distributeLkws(plan, ctx) {
  const lkws = lkwsOf(plan);
  const pieces = [...plan.placements.map(placementToUnplaced), ...plan.unplaced.map(withoutLkw)];
  if (lkws.length === 0) return plan;
  const use = new Map(lkws.map(l => [l.id, { area: 0, weight: 0 }]));
  const util = l => {
    const truck = truckOf(l, ctx), u = use.get(l.id);
    return Math.max(u.area / (truck.l * truck.w), truck.payload > 0 ? u.weight / truck.payload : 0);
  };
  const assigned = new Map();
  const order = pieces.map((x, i) => ({ x, i, c: ctx.caseById.get(x.caseId) })).filter(e => e.c);
  const cats = [...new Set(order.map(e => catOf(e.c)))].sort((a, b) => catRank(a) - catRank(b) || order.findIndex(e => catOf(e.c) === a) - order.findIndex(e => catOf(e.c) === b));
  for (const category of cats) {
    const group = order.filter(e => catOf(e.c) === category).sort((a, b) => volumeOf(b.c) - volumeOf(a.c) || a.i - b.i);
    for (const { x, c } of group) {
      const { list, fits } = eligibleFor(x, c, lkws, ctx);
      if (!list.length) continue;
      let best = list[0], bestU = util(best);
      for (const l of list.slice(1)) { const u = util(l); if (u < bestU) { best = l; bestU = u; } }
      const o = fits.get(best.id), u = use.get(best.id);
      u.area += o.d.dx * o.d.dy;
      u.weight += weightOf(c);
      assigned.set(x.id, best.id);
    }
  }
  return stamp({
    ...plan,
    placements: [],
    unplaced: pieces.map(x => (assigned.has(x.id) ? withLkw(x, assigned.get(x.id)) : x)),
  });
}

// „Alles neu packen“ für Mehr-LKW-Pläne: verteilen, jeden LKW mit packAll auf seiner Ansicht packen
// (Pack-Regeln und Deckschicht stammen aus dem Plan und gelten für jeden LKW), danach einmal die
// Reste an die übrigen zulässigen LKW des Gewerks weitergeben (packRest, Listenreihenfolge). Was auch
// dann nicht passt, bleibt in der Ablage seines ersten LKW. Ein-LKW-Plan: exakt packAll.
export function packAllLkws(plan, ctx) {
  if (!isMultiLkw(plan)) return packAll(plan, ctx);
  const lkws = lkwsOf(plan);
  const withTruck = l => ({ ...ctx, truck: truckOf(l, ctx) });
  const packOne = (q, l) => (truckOf(l, ctx) ? mergeLkwView(q, l.id, packAll(lkwView(q, l.id), withTruck(l))) : q);
  // Genau ein LKW: nichts zu verteilen („nur bei ≥ 2 LKW“) – nur dessen Ansicht packen, alle anderen
  // Stücke (nicht zugeordnete) und alle Zuordnungen bleiben unberührt.
  if (lkws.length === 1) return packOne(plan, lkws[0]);
  let p = distributeLkws(plan, ctx);
  // Ein LKW ohne auffindbares Fahrzeug ist nicht packbar: seine Stücke bleiben in der Ablage.
  for (const l of lkws) p = packOne(p, l);
  for (const origin of lkws) {
    for (const other of lkws) {
      if (other.id === origin.id) continue;
      const left = p.unplaced.filter(u => u.lkw === origin.id);
      const offered = left.filter(u => {
        const c = ctx.caseById.get(u.caseId);
        return c && eligibleFor(u, c, lkws, ctx).list.some(l => l.id === other.id);
      });
      if (!offered.length) continue;
      if (!truckOf(other, ctx)) continue;
      const view = lkwView(p, other.id);
      const res = packRest({ ...view, unplaced: offered.map(withoutLkw) }, withTruck(other));
      const before = new Set(view.placements.map(q => q.id));
      const taken = new Set(res.placements.filter(q => !before.has(q.id)).map(q => q.id));
      if (!taken.size) continue;
      p = mergeLkwView({ ...p, unplaced: p.unplaced.filter(u => !taken.has(u.id)) }, other.id, { ...view, placements: res.placements });
    }
  }
  return p;
}

// Nicht zugeordnete Stücke je Gewerk für den Hinweis der Oberfläche („12 Stücke ohne LKW (Strom)“):
// [{ category, count }] in CATEGORIES-Reihenfolge. Case ohne Gewerk zählt als „Sonstiges“, ein
// fehlender Case als { category: null }. Ein-LKW-Plan: leer.
export function unassignedByCategory(plan, caseById) {
  if (!isMultiLkw(plan)) return [];
  const known = new Set(lkwsOf(plan).map(l => l.id));
  const counts = new Map();
  for (const x of [...plan.placements, ...plan.unplaced]) {
    if (known.has(x.lkw)) continue;
    const c = caseById.get(x.caseId);
    const category = c ? catOf(c) : null;
    counts.set(category, (counts.get(category) ?? 0) + 1);
  }
  // `category: null` = Stücke, deren Case nicht (mehr) bekannt ist; steht zuletzt.
  return [...counts].map(([category, count]) => ({ category, count }))
    .sort((a, b) => (a.category === null) - (b.category === null)
      || (a.category === null ? 0 : catRank(a.category) - catRank(b.category)));
}
