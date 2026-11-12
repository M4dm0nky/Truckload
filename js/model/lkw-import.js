// LKW aus dem Tabellen-Import planen (Plan „Tabellen-Import, Stufe 2 und 3“, Task 3). Reine
// Funktionen; packen tut actions.packAll / lkw-distribute.packAllLkws, hier wird nur gruppiert,
// angelegt und nacheinander gefüllt. Stufe 3 (Task 4) setzt auf `fuelleNacheinander` und `gruppenAus` auf.
import { stamp } from './stamp.js';
import { packAll, packRest, placementToUnplaced } from './actions.js';
import { packAllLkws, eligibleFor, catOf, catRank } from './lkw-distribute.js';
import { lkwsOf, lkwView, mergeLkwView, convertToMulti } from './lkw.js';
import { MAX_LKW } from './limits.js';
import { t } from '../i18n/i18n.js';

export const VERHALTEN = Object.freeze({ NEU: 'neu', HINZU: 'hinzu', ZUSAETZLICH: 'zusaetzlich' });
export const ART = Object.freeze({ JE_GEWERK: 'je-gewerk', WENIGSTE: 'wenigste' });

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

// „So wenige LKW wie möglich“ (Entscheidung 6): nacheinander füllen, Gewerke in CATEGORIES-Reihenfolge.
// getrennt: je Gewerk füllen, der jeweils letzte LKW gilt als nicht voll, sein Inhalt geht in den
// gemeinsamen Rest, der danach (nach Gewerk sortiert) wieder nacheinander gefüllt wird.
function legeWenigste(state, base, pieces, truck, ctx, getrennt) {
  const catOfPiece = x => catOf(ctx.caseById.get(x.caseId));
  const sorted = list => [...list].sort((a, b) => byRank(catOfPiece(a), catOfPiece(b)));
  const catsOf = placed => [...new Set(placed.map(catOfPiece))].sort(byRank);
  let rest = [];
  if (getrennt) {
    for (const g of [...new Set(pieces.map(catOfPiece))].sort(byRank)) {
      const before = state.lkws.length;
      const r = fuelleNacheinander(state, base, pieces.filter(x => catOfPiece(x) === g), truck, ctx, catsOf);
      state = r.state;
      rest.push(...r.rest);
      if (state.lkws.length > before) {
        const last = state.lkws[state.lkws.length - 1];
        rest.push(...state.placements.filter(p => p.lkw === last.id).map(placementToUnplaced).map(withoutLkw));
        state = { ...state, lkws: state.lkws.slice(0, -1), placements: state.placements.filter(p => p.lkw !== last.id) };
      }
    }
  } else rest = pieces;
  return fuelleNacheinander(state, base, sorted(rest), truck, ctx, catsOf);
}

// Neue LKW für `known` anlegen (je Gewerk-Gruppen oder „wenigste“); was nicht passt, kommt ans Ende
// von state.unplaced (ohne `lkw`).
function legeNeue(state, base, known, truck, ctx, einst) {
  const done = res => ({ ...res.state, unplaced: [...res.state.unplaced, ...res.rest] });
  if (einst.art === ART.WENIGSTE) return done(legeWenigste(state, base, known, truck, ctx, !!einst.getrennt));
  const gewerke = [...new Set(known.map(x => catOf(ctx.caseById.get(x.caseId))))];
  for (const g of gruppenAus(gewerke, einst)) {
    const mine = known.filter(x => g.gewerke.includes(catOf(ctx.caseById.get(x.caseId))));
    state = done(g.modus === 'n'
      ? legeFesteAnzahl(state, base, mine, truck, ctx, g.n, g.gewerke)
      : fuelleNacheinander(state, base, mine, truck, ctx,
        placed => g.gewerke.filter(w => placed.some(p => catOf(ctx.caseById.get(p.caseId)) === w))));
  }
  return state;
}

// „Nur hinzufügen“ (Entscheidung 7): keine neuen LKW. Je LKW in Listenreihenfolge werden ihm die neuen
// Stücke angeboten, für die er nach eligibleFor (Regel von distributeLkws) zulässig ist (packRest).
// Was nirgends passt, bleibt ohne `lkw` in der Ablage. `p` ist ein Mehr-LKW-Plan.
function fuegeHinzu(p, ctx, neuIds) {
  const lkws = lkwsOf(p);
  const isNew = u => neuIds.has(u.id) && ctx.caseById.has(u.caseId);
  p = { ...p, unplaced: p.unplaced.map(u => (isNew(u) ? withoutLkw(u) : u)) };
  for (const l of lkws) {
    const truck = ctx.truckById?.get(l.truckId) ?? ctx.truck;
    if (!truck) continue;
    const offered = p.unplaced.filter(u => isNew(u) && !u.lkw
      && eligibleFor(u, ctx.caseById.get(u.caseId), lkws, ctx).list.some(x => x.id === l.id));
    if (!offered.length) continue;
    const view = lkwView(p, l.id);
    const res = packRest({ ...view, unplaced: offered }, { ...ctx, truck });
    const before = new Set(view.placements.map(q => q.id));
    const taken = new Set(res.placements.filter(q => !before.has(q.id)).map(q => q.id));
    if (!taken.size) continue;
    p = mergeLkwView({ ...p, unplaced: p.unplaced.filter(u => !taken.has(u.id)) }, l.id, { ...view, placements: res.placements });
  }
  return stamp(p);
}

// Plant die LKW eines Plans (Task 3/4). `einst.verhalten`:
// - 'neu': alle Stücke – platziert oder in der Ablage, alte `lkw` ignoriert – werden nach
//   `einst.art` (je Gewerk / wenigste) auf neu angelegte LKW verteilt; die alten LKW entfallen. Entsteht kein
//   LKW, bleibt die Einzel-LKW-Form ohne `lkws` mit leerer Ladung (alles in der Ablage, ohne `lkw`).
// - 'zusaetzlich': vorhandene LKW und Platzierungen bleiben unverändert (Ein-LKW-Plan wird vorher
//   Mehr-LKW-Plan); nur die Stücke aus `einst.neu` (IDs, in der Ablage) kommen auf neue LKW (MAX_LKW zählt
//   die vorhandenen mit). Was nicht passt, bleibt ohne `lkw` in der Ablage; es entfällt nie etwas Vorhandenes.
// - 'hinzu': keine neuen LKW, die Stücke aus `einst.neu` gehen an vorhandene LKW (fuegeHinzu).
// `einst.verhalten` ist Pflicht (kein stilles Vorgabeverhalten; unbekannte Werte werfen). Unbekanntes `einst.truckId`: Rückfall auf ctx.truck (wie truckOf in lkw-distribute.js).
export function planeLkws(plan, ctx, einst) {
  const truck = ctx.truckById?.get(einst.truckId) ?? ctx.truck;
  const verhalten = einst.verhalten;
  // Entwicklerfehler, kein Nutzertext: ein Tippfehler darf nie still den verwerfenden Zweig nehmen.
  if (!Object.values(VERHALTEN).includes(verhalten)) throw new Error(`planeLkws: unbekanntes verhalten ${JSON.stringify(verhalten)}`);
  if (einst.art !== undefined && !Object.values(ART).includes(einst.art)) throw new Error(`planeLkws: unbekannte art ${JSON.stringify(einst.art)}`);
  if (verhalten !== VERHALTEN.NEU) {
    const p = convertToMulti(plan, ctx.newId);
    const neuIds = new Set(einst.neu ?? []);
    if (verhalten === VERHALTEN.HINZU) return fuegeHinzu(p, ctx, neuIds);
    const { lkws: _l, ...base0 } = p;
    const base = { ...base0, placements: [], unplaced: [] };
    const isNew = u => neuIds.has(u.id) && ctx.caseById.has(u.caseId);
    const known = p.unplaced.filter(isNew).map(withoutLkw);
    const state = legeNeue({ lkws: p.lkws, placements: p.placements, unplaced: p.unplaced.filter(u => !isNew(u)) },
      base, known, truck, ctx, einst);
    return stamp({ ...base, truckId: p.truckId, lkws: state.lkws, placements: state.placements, unplaced: state.unplaced });
  }
  const all = [...plan.placements.map(placementToUnplaced), ...plan.unplaced].map(withoutLkw);
  const known = all.filter(x => ctx.caseById.has(x.caseId));
  const unknown = all.filter(x => !ctx.caseById.has(x.caseId));
  const { lkws: _l, ...base0 } = plan;
  const base = { ...base0, placements: [], unplaced: [] };
  const state = legeNeue({ lkws: [], placements: [], unplaced: [...unknown] }, base, known, truck, ctx, einst);
  // Entsteht kein LKW, bleibt die Einzel-LKW-Form: nichts geladen, alle Stücke in der Ablage ohne `lkw`.
  if (!state.lkws.length) return stamp({ ...base, truckId: truck.id, placements: [], unplaced: state.unplaced });
  return stamp({ ...base, truckId: state.lkws[0].truckId, lkws: state.lkws, placements: state.placements, unplaced: state.unplaced });
}
