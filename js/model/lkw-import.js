// LKW aus dem Tabellen-Import planen (Plan „Tabellen-Import, Stufe 2 und 3“, Task 3). Reine
// Funktionen; packen tut actions.packAll / lkw-distribute.packAllLkws, hier wird nur gruppiert,
// angelegt und nacheinander gefüllt. Stufe 3 (Task 4) setzt auf `fuelleNacheinander` und `gruppenAus` auf.
import { stamp } from './stamp.js';
import { packAll, placementToUnplaced } from './actions.js';
import { packAllLkws, catOf, catRank } from './lkw-distribute.js';
import { MAX_LKW } from './limits.js';
import { t } from '../i18n/i18n.js';

const withoutLkw = x => { const { lkw: _d, ...rest } = x; return rest; };
const byRank = (a, b) => catRank(a) - catRank(b) || (a < b ? -1 : a > b ? 1 : 0);

// Gewerke -> Gruppen. „mit“ folgt bis zur Wurzel; ein Kreis (samt allem, was in ihn führt) bildet eine
// Gruppe mit `modus: 'offen'`. Fehlender Eintrag oder Ziel nicht in der Liste -> Wurzel, offen.
// Gruppen nach CATEGORIES der Wurzel (unbekannte danach alphabetisch), in der Gruppe zuerst die Wurzel.
export function gruppenAus(gewerke, einst) {
  const list = [...new Set(gewerke)];
  const inList = new Set(list);
  const cfg = g => einst?.gewerke?.[g];
  const next = g => (cfg(g)?.modus === 'mit' && inList.has(cfg(g).mit) ? cfg(g).mit : null);
  const rootOf = new Map(); // gewerk -> { root, cycle }
  for (const g of list) {
    const path = [];
    let cur = g;
    while (cur !== null && !path.includes(cur)) { path.push(cur); cur = next(cur); }
    if (cur === null) { rootOf.set(g, { root: path[path.length - 1], cycle: false }); continue; }
    const members = path.slice(path.indexOf(cur)).sort(byRank);
    rootOf.set(g, { root: members[0], cycle: true });
  }
  const groups = new Map();
  for (const g of list) {
    const { root, cycle } = rootOf.get(g);
    if (!groups.has(root)) groups.set(root, { root, cycle, members: [] });
    if (g !== root) groups.get(root).members.push(g);
  }
  return [...groups.values()].sort((a, b) => byRank(a.root, b.root)).map(({ root, cycle, members }) => {
    const gewerkeSorted = [root, ...members.sort(byRank)];
    const c = cfg(root);
    return !cycle && c?.modus === 'n'
      ? { gewerke: gewerkeSorted, modus: 'n', n: c.n }
      : { gewerke: gewerkeSorted, modus: 'offen' };
  });
}

// Stücke aus `ids`, die in der Ablage liegen.
export const nichtGeladen = (plan, ids) => {
  const wanted = new Set(ids);
  return plan.unplaced.filter(u => wanted.has(u.id)).map(u => ({ id: u.id, caseId: u.caseId }));
};

// Arbeitsstand beim Planen: { lkws, placements, unplaced } – Platzierungen tragen `lkw`, die Ablage nicht.
const neuerLkw = (state, truckId, categories, newId) => {
  const lkw = { id: newId(), name: t('LKW {n}', { n: state.lkws.length + 1 }), truckId, categories };
  return { lkw, state: { ...state, lkws: [...state.lkws, lkw] } };
};

// Füllt LKW nacheinander (packAll auf einen leeren LKW, Rest in den nächsten). Bricht ab, wenn ein
// leerer LKW nichts aufnimmt (er wird nicht angelegt), nichts mehr übrig ist oder MAX_LKW erreicht ist.
// `base` = Plan ohne Stücke (Pack-Regeln), `pieces` = Ablage-Einträge ohne `lkw`, `categoriesOf(geladen)`
// liefert die Gewerke des neuen LKW. Gibt { state, rest } zurück.
export function fuelleNacheinander(state, base, pieces, truck, ctx, categoriesOf) {
  let rest = pieces;
  while (rest.length && state.lkws.length < MAX_LKW) {
    const packed = packAll({ ...base, truckId: truck.id, placements: [], unplaced: rest }, { ...ctx, truck });
    if (!packed.placements.length) break; // ein leerer LKW nimmt nichts mehr auf: Endlosschleife verhindern
    const { lkw, state: s } = neuerLkw(state, truck.id, categoriesOf(packed.placements), ctx.newId);
    state = { ...s, placements: [...s.placements, ...packed.placements.map(p => ({ ...p, lkw: lkw.id }))] };
    rest = packed.unplaced.map(withoutLkw);
  }
  return { state, rest };
}

// Feste Anzahl: min(n, MAX_LKW − vorhandene) LKW mit den Gruppen-Gewerken anlegen und die Stücke der
// Gruppe darauf verteilen und packen (packAllLkws auf einem Teilplan). Nicht Passendes: Ablage ohne `lkw`.
function legeFesteAnzahl(state, base, pieces, truck, ctx, n, categories) {
  const count = Math.min(Math.max(0, Math.floor(n) || 0), MAX_LKW - state.lkws.length);
  if (!count) return { state, rest: pieces };
  const fresh = [];
  for (let i = 0; i < count; i++) {
    const r = neuerLkw({ ...state, lkws: [...state.lkws, ...fresh] }, truck.id, categories, ctx.newId);
    fresh.push(r.lkw);
  }
  const sub = packAllLkws({
    ...base, truckId: truck.id, lkws: fresh, placements: [],
    unplaced: pieces.map(p => ({ ...p, lkw: fresh[0].id })),
  }, { ...ctx, truck });
  return {
    state: { ...state, lkws: [...state.lkws, ...fresh], placements: [...state.placements, ...sub.placements] },
    rest: sub.unplaced.map(withoutLkw),
  };
}

// Plant die LKW eines Plans neu (Task 3: verhalten 'neu', art 'je-gewerk'). Alle Stücke – platziert oder
// in der Ablage, alte `lkw` ignoriert – werden je Gruppe auf neu angelegte LKW verteilt; die alten LKW
// entfallen. Stücke mit unbekanntem Case und alles, was nicht passt, bleibt in der Ablage ohne `lkw`.
// Mehr-LKW-Plan, sobald mindestens ein LKW entsteht; sonst Einzel-LKW-Form ohne `lkws` mit leerer Ladung
// (alles in der Ablage, `nichtGeladen` listet es). Unbekanntes `einst.truckId`: Rückfall auf ctx.truck.
export function planeLkws(plan, ctx, einst) {
  // Unbekanntes Fahrzeug: Rückfall auf ctx.truck (wie truckOf in lkw-distribute.js).
  const truck = ctx.truckById?.get(einst.truckId) ?? ctx.truck;
  const all = [...plan.placements.map(placementToUnplaced), ...plan.unplaced].map(withoutLkw);
  const known = all.filter(x => ctx.caseById.has(x.caseId));
  const unknown = all.filter(x => !ctx.caseById.has(x.caseId));
  const { lkws: _l, ...base0 } = plan;
  const base = { ...base0, placements: [], unplaced: [] };
  const gewerke = [...new Set(known.map(x => catOf(ctx.caseById.get(x.caseId))))];
  let state = { lkws: [], placements: [], unplaced: [...unknown] };
  for (const g of gruppenAus(gewerke, einst)) {
    const mine = known.filter(x => g.gewerke.includes(catOf(ctx.caseById.get(x.caseId))));
    const res = g.modus === 'n'
      ? legeFesteAnzahl(state, base, mine, truck, ctx, g.n, g.gewerke)
      : fuelleNacheinander(state, base, mine, truck, ctx,
        placed => g.gewerke.filter(w => placed.some(p => catOf(ctx.caseById.get(p.caseId)) === w)));
    state = { ...res.state, unplaced: [...res.state.unplaced, ...res.rest] };
  }
  // Entsteht kein LKW, bleibt die Einzel-LKW-Form: nichts geladen, alle Stücke in der Ablage ohne `lkw`.
  if (!state.lkws.length) return stamp({ ...base, truckId: truck.id, placements: [], unplaced: state.unplaced });
  return stamp({ ...base, truckId: state.lkws[0].truckId, lkws: state.lkws, placements: state.placements, unplaced: state.unplaced });
}
