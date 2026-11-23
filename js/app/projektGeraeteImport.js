// Verdrahtung „Aus Projektdatenbank übernehmen“ (Spec 2026-11-17-nyx-projektgeraete): Geräte von NYX
// holen, Dialog mit dem Schritt „Geräte → Cases“ öffnen, Ergebnis in Bibliothek und Plan schreiben.
// Kein Import von js/app.js; alles Übrige kommt als Parameter (wie bei wireTabellenImport).
// Die Entscheidungen (automatisch öffnen, Abbruch schreibt nichts) stecken in geraeteAbgleich() und
// sind mit Attrappen testbar.
import * as A from '../model/actions.js';
import { stamp } from '../model/stamp.js';
import { DEFAULT_TRUCK_ID } from '../data/preset-trucks.js';
import { CATEGORIES } from '../data/categories.js';
import { umhaengen, stand, uebernimmGeraete, casesZumMerken } from '../model/nyxAbgleich.js';
import { stueckAusName } from '../model/stueckAusName.js';
import { isMultiLkw } from '../model/lkw.js';
import { CASE_LIMITS, NAME_MAX } from '../model/limits.js';
import { isInStock } from '../model/material.js';
import { hatProjektGeraete, ladeProjektGeraete } from '../store/projektGeraete.js';
import { openTabellenImport } from '../ui/tabellen-import.js';
import { allPlansOf } from './core.js';
import { lkwOptsVon, planeNachUebernahme, stueckIds } from './tabellenImport.js';
import { multiAddedNotice } from './plans.js';
import { t, date } from '../i18n/i18n.js';

const $ = sel => document.querySelector(sel);

// Automatisch öffnen: nur solange kein Plan des Projekts (der aktuelle und die gespeicherten) den Abgleich
// schon geöffnet hatte. Truckload startet in NYX auf dem Startbildschirm, ohne gewählten Plan; ein
// Blick nur auf den aktuellen Plan öffnete den Dialog dort bei jedem Start erneut.
export const sollAutomatischOeffnen = s => !allPlansOf(s).some(p => p.nyxAbgleich?.geoeffnet);

// „licht“ → „Licht“; unbekanntes Gewerk → „Sonstiges“, kein Gewerk → „Licht“ (Projektgeräte sind meist Licht).
export function kategorieVon(gewerk) {
  if (typeof gewerk !== 'string' || !gewerk.trim()) return CATEGORIES[0].name; // Licht
  return CATEGORIES.find(k => k.name.toLowerCase() === gewerk.trim().toLowerCase())?.name ?? CATEGORIES.at(-1).name; // Sonstiges
}

// Vorbelegung des Case-Editors für „Neues Case“: Name = Gerätename + „Case“, Gewerk aus NYX,
// Gewicht = Geräte pro Case × gewichtKg (nur wenn NYX es liefert; im Editor änderbar). Geräte pro Case:
// `stueck`, sonst aus dem vorbelegten Namen (stueckAusName), sonst 1.
export function caseEntwurf({ name, gewerk, gewichtKg, stueck }) {
  const kopf = t('{name} Case', { name: '' });
  const basis = String(name ?? '').slice(0, Math.max(NAME_MAX - kopf.length, 1));
  const entwurf = { name: t('{name} Case', { name: basis }), category: kategorieVon(gewerk) };
  if (typeof gewichtKg === 'number' && gewichtKg > 0) {
    const je = Number.isInteger(stueck) && stueck >= 1 ? stueck : stueckAusName(entwurf.name) ?? 1;
    entwurf.weight = Math.min(Math.round(gewichtKg * je * 10) / 10, CASE_LIMITS.weight);
  }
  return entwurf;
}

// Reihenfolge für „Anderes Case suchen“: Treffer zum Text zuerst, dann der Rest alphabetisch.
export function suchReihenfolge(cases, text) {
  const woerter = String(text ?? '').toLowerCase().split(/\s+/).filter(Boolean);
  const trifft = c => woerter.length > 0 && woerter.every(w => c.name.toLowerCase().includes(w));
  const nach = (a, b) => a.name.localeCompare(b.name, 'de');
  return [...cases.filter(trifft).sort(nach), ...cases.filter(c => !trifft(c)).sort(nach)];
}

// Der Ablauf. deps: { store, hat, lade, oeffne(opts) → Ergebnis|null, leererPlan(), markiereGeoeffnet(),
// uebernehmen(res, kontext), showAlert }. Liefert den Ausgang als Text (für Tests und Aufrufer):
// 'no-host' | 'already' | 'error' | 'empty' | 'cancelled' | 'applied'.
// automatisch: nur öffnen, wenn der Plan den Abgleich noch nicht geöffnet hatte und NYX Geräte liefert.
export async function geraeteAbgleich(deps, { automatisch = false } = {}) {
  const { store, showAlert } = deps;
  if (!deps.hat()) return 'no-host';
  if (automatisch && !sollAutomatischOeffnen(store.get())) return 'already';
  let liste;
  try { liste = await deps.lade(); } catch (err) { await showAlert(err.message); return 'error'; }
  if (automatisch && !liste.length) return 'empty';
  const s = store.get();
  // Einmal rechnen: dieselbe alias-Map für stand(), die Reduktion im Dialog und die Übernahme.
  const { cases: geaendert, alias } = umhaengen(liste, s.cases);
  const cases = s.cases.map(c => geaendert.find(g => g.id === c.id) ?? c);
  const basis = s.plan ?? deps.leererPlan();
  const res = await deps.oeffne({
    liste, alias, cases, plan: basis, stand: stand(basis, liste, alias), zielAktuell: s.plan?.name ?? null,
  });
  if (!res) {
    // Abbruch schreibt nichts (neue Cases aus „Neues Case“ sind schon gespeichert). Nur ein vorhandener
    // Plan merkt sich, dass der Dialog einmal offen war; ohne Plan öffnet er sich beim nächsten Start wieder.
    if (store.get().plan) deps.markiereGeoeffnet();
    return 'cancelled';
  }
  await deps.uebernehmen(res, { geaendert, alias });
  return 'applied';
}

// Schreibt das Ergebnis des Dialogs ganz oder gar nicht: erst alles rechnen (neuer Plan, zu merkende Cases),
// dann die Cases in EINEM Schreibvorgang (saveCases meldet Fehler selbst), erst danach den Plan (bei Bedarf
// neu angelegt), dann beim „Laden“ die LKW-Verteilung. Wirft die Rechnung oder lehnt das Schreiben ab,
// bleibt alles unberührt, auch kein leerer neuer Plan. kontext: { geaendert, alias } (umhaengen).
// Die Bibliothek wird erst hier gelesen: im Dialog angelegte Cases („Neues Case“) gehören dazu.
export async function uebernimmErgebnis({ store, editWhole, switchPlan, uid, showAlert, saveCases }, res, { geaendert, alias }) {
  const zuSpeichern = casesZumMerken(store.get().cases, geaendert, res).map(c => ({ ...c, builtin: false }));
  const caseById = new Map([...store.get().cases, ...zuSpeichern].map(c => [c.id, c]));
  const vorhanden = store.get().plan;
  let neuerPlan = null;
  try {
    neuerPlan = uebernimmGeraete(
      vorhanden ?? A.emptyPlan(uid(), t('Load {date}', { date: date(new Date()) }), DEFAULT_TRUCK_ID),
      res, uid, caseById, alias);
  } catch (err) { await showAlert(err.message); return false; }
  if (zuSpeichern.length && !await saveCases(zuSpeichern)) return false;
  if (vorhanden) {
    const vor = stueckIds(store.get().plan);
    editWhole((p, c) => uebernimmGeraete(p, res, uid, c.caseById, alias));
    if (res.laden) await planeNachUebernahme({ store, editWhole, uid, showAlert }, res.lkw, vor);
  } else {
    switchPlan(neuerPlan);
    if (res.laden) await planeNachUebernahme({ store, editWhole, uid, showAlert }, res.lkw, new Set());
  }
  if (!res.laden && res.zuordnungen.length && isMultiLkw(store.get().plan)) await showAlert(multiAddedNotice());
  return true;
}

// deps: store, editWhole, switchPlan, uid, showAlert, saveCases, newCaseForWizard, showPick.
// Liefert { start, auto, knopfZeigen }.
export function wireProjektGeraete({ store, editWhole, switchPlan, uid, showAlert, saveCases, newCaseForWizard, showPick }) {
  let laeuft = false;

  async function sucheCase(text) {
    const cases = suchReihenfolge(store.get().cases.filter(c => isInStock(c)), text);
    if (!cases.length) { await showAlert(t('Keine passende Box vorhanden.')); return null; }
    const id = await showPick(t('Welches Case?'), cases.map(c => ({ value: c.id, label: c.name + (c.company ? ` – ${c.company}` : '') })), { suche: true });
    return id == null ? null : cases.find(c => c.id === id) ?? null;
  }
  // Das neue Case landet sofort in „Meine Sammlung“ (Spec), auch wenn der Dialog danach abgebrochen wird.
  const neuesCase = v => newCaseForWizard(caseEntwurf(v), { mode: 'fixed', company: '' });

  const oeffne = opts => openTabellenImport($('#dlg-tabelle'), {
    trussDlg: $('#dlg-truss'), dollyDlg: $('#dlg-dolly'), dollyBasen: [], bibliothekCases: [],
    dateiname: '', eintraege: [], zielAktuell: opts.zielAktuell,
    ...lkwOptsVon({ store, uid }, opts.alias),
    geraete: { liste: opts.liste, stand: opts.stand, cases: opts.cases, alias: opts.alias, plan: opts.plan },
    sucheCase, neuesCase,
  });

  const deps = {
    store, showAlert, hat: hatProjektGeraete, lade: ladeProjektGeraete, oeffne,
    uebernehmen: (res, kontext) => uebernimmErgebnis({ store, editWhole, switchPlan, uid, showAlert, saveCases }, res, kontext),
    leererPlan: () => A.emptyPlan(uid(), '', DEFAULT_TRUCK_ID),
    markiereGeoeffnet: () => editWhole(p => (p.nyxAbgleich?.geoeffnet ? p : stamp({ ...p, nyxAbgleich: { nichtLaden: [], ...p.nyxAbgleich, geoeffnet: true } })), false),
  };

  async function lauf(opts) {
    if (laeuft) return 'busy';
    laeuft = true;
    try { return await geraeteAbgleich(deps, opts); } finally { laeuft = false; }
  }
  const start = () => lauf({});
  const auto = () => lauf({ automatisch: true });

  const knopf = $('#geraete-btn');
  if (knopf) { knopf.hidden = !hatProjektGeraete(); knopf.onclick = start; }
  return { start, auto };
}
