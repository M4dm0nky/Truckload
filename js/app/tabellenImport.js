// Verdrahtung „Tabelle importieren“: Dateiwahl, Reiter erkennen, Dialog, Ziel, Übernahme.
// Kein Import von js/app.js; alles Übrige kommt als Parameter (wie bei wirePlans).
import * as A from '../model/actions.js';
import { DEFAULT_TRUCK_ID } from '../data/preset-trucks.js';
import { erkenneReiter, werteZeilen } from '../model/ladeliste.js';
import { uebernimmTabelle } from '../model/tabellen-uebernahme.js';
import { isMultiLkw, lkwsOf, piecesOf } from '../model/lkw.js';
import { planeLkws, nichtGeladen, VERHALTEN } from '../model/lkw-import.js';
import { catOf, catRank } from '../model/lkw-distribute.js';
import { MAX_LKW, NAME_MAX } from '../model/limits.js';
import { readTabellenDateien } from '../store/tabelle-lesen.js';
import { openTabellenImport, openTabellenHilfe, vorlageDatei, entwuerfeAus, nichtGeladenText } from '../ui/tabellen-import.js';
import { multiAddedNotice } from './plans.js';
import { bestandOf, wholeCtxOf } from './core.js';
import { isInStock } from '../model/material.js';
import { capList } from './importExport.js';
import { t, date } from '../i18n/i18n.js';

const $ = sel => document.querySelector(sel);
export const MAX_DATEI_BYTES = 5 * 1024 * 1024;

const REITER_NAME = { cases: () => t('Cases'), traversen: () => t('Traversen'), boxen: () => t('Boxen'), set: () => t('Set') };
const blattName = b => (b.blatt ? `${b.datei} (${b.blatt})` : b.datei);

// Ordnet gelesene Blätter den Reitern zu. Ergebnis: { eintraege, ignoriert: string[], fehler: string|null }.
// Zwei Quellen für denselben Reiter sind ein Fehler (nicht still zusammenführen).
export function ordneBlaetter(blaetter) {
  const quelle = new Map();
  const eintraege = [];
  const ignoriert = [];
  for (const b of blaetter) {
    const kopf = erkenneReiter(b.rows);
    if (kopf.reiter === null) { ignoriert.push(blattName(b)); continue; }
    if (quelle.has(kopf.reiter)) {
      return { eintraege: [], ignoriert, fehler: t('Der Reiter „{reiter}“ kommt zweimal vor: {a} und {b}. Bitte nur eine Quelle je Reiter auswählen.', { reiter: REITER_NAME[kopf.reiter](), a: quelle.get(kopf.reiter), b: blattName(b) }) };
    }
    quelle.set(kopf.reiter, blattName(b));
    try { eintraege.push(...werteZeilen(kopf.reiter, b.rows, kopf)); }
    catch (err) { return { eintraege: [], ignoriert, fehler: `${blattName(b)}: ${err.message}` }; }
  }
  return { eintraege, ignoriert, fehler: null };
}

// ---- LKW-Wahl beim Laden: Vorschau und Übernahme rechnen mit denselben Funktionen ----

const truckByIdOf = s => new Map(bestandOf(s).trucks.map(tk => [tk.id, tk]));
const ctxMitFahrzeugen = (s, newId) => ({ ...wholeCtxOf(s, newId), truckById: truckByIdOf(s) });
const stueckIds = plan => new Set(piecesOf(plan).map(p => p.id));
// Stücke, die seit `vor` dazugekommen sind (in Plan-Reihenfolge).
export const neueStueckIds = (plan, vor) => piecesOf(plan).map(p => p.id).filter(id => !vor.has(id));

// Bericht über den geplanten Stand: je LKW Name, Gewerke, Stückzahl; dazu die Stücke aus `ids` in der Ablage.
export function lkwBericht(plan, ids, caseById) {
  const gewerkVon = caseId => { const c = caseById.get(caseId); return c ? catOf(c) : null; };
  const lkws = lkwsOf(plan).map(l => {
    const mine = plan.placements.filter(p => p.lkw === l.id);
    const gewerke = [...new Set(mine.map(p => gewerkVon(p.caseId)).filter(Boolean))].sort((a, b) => catRank(a) - catRank(b) || (a < b ? -1 : 1));
    return { name: l.name, gewerke, stueck: mine.length };
  });
  const offen = nichtGeladen(plan, ids).filter(x => caseById.has(x.caseId))
    .map(x => ({ name: caseById.get(x.caseId).name, gewerk: catOf(caseById.get(x.caseId)) }));
  return { lkws, nichtGeladen: offen };
}

// Ganzer Ablauf auf einer Kopie (der Store bleibt unberührt): Tabelle übernehmen, dann LKW planen.
// Liefert { plan, bericht }. Die Vorschau ruft genau das; die Übernahme geht dieselben Schritte über editWhole.
export function rechneLkwImport(s, res, newId) {
  const { entwuerfe } = entwuerfeAus(res.eintraege);
  const vor = stueckIds(s.plan);
  const mit = uebernimmTabelle(s.plan, entwuerfe, newId, res.gebaut);
  const s2 = { ...s, plan: mit };
  const neu = neueStueckIds(mit, vor);
  const ctx = ctxMitFahrzeugen(s2, newId);
  const plan = planeLkws(mit, ctx, { ...res.lkw, neu });
  const ids = res.lkw.verhalten === VERHALTEN.NEU ? piecesOf(plan).map(p => p.id) : neu;
  return { plan, bericht: lkwBericht(plan, ids, ctx.caseById) };
}

// deps: store, editWhole, switchPlan, uid, showAlert, showPrompt. Liefert { start, hilfe }.
export function wireTabellenImport({ store, editWhole, switchPlan, uid, showAlert, showPrompt }) {
  const input = $('#tabelle-datei');

  async function verarbeite(files) {
    const zuGross = files.find(f => f.size > MAX_DATEI_BYTES);
    if (zuGross) { await showAlert(t('Die Datei „{name}“ ist größer als 5 MB und wird nicht gelesen.', { name: zuGross.name })); return; }
    let blaetter;
    try {
      blaetter = await readTabellenDateien(await Promise.all(files.map(async f => ({ name: f.name, buf: await f.arrayBuffer() }))));
    } catch (err) {
      await showAlert(t('Die Datei konnte nicht gelesen werden: {fehler}', { fehler: err.message }));
      return;
    }
    const { eintraege, ignoriert, fehler } = ordneBlaetter(blaetter);
    if (fehler) { await showAlert(fehler); return; }
    if (ignoriert.length) {
      await showAlert(t('Nicht erkannt und ignoriert (Kopfzeile passt zu keinem Reiter der Vorlage): {liste}', { liste: ignoriert.join(', ') }));
    }
    if (!eintraege.length) {
      if (!ignoriert.length) await showAlert(t('In der Tabelle wurden keine Zeilen gefunden.'));
      return;
    }
    // Name und Trockenlauf VOR dem Schließen: Abbrechen/leerer Name/zu viele Case-Typen lassen den
    // Dialog mit allen Korrekturen offen.
    let name = null;
    const bestaetige = async res => {
      if (res.ziel === 'new') {
        const eingabe = await showPrompt(t('Name des neuen Projekts:'), t('Load {date}', { date: date(new Date()) }), { maxlength: NAME_MAX });
        if (!eingabe?.trim()) return false;
        name = eingabe.trim();
      }
      // Vorab auf einem Entwurf des Zielplans prüfen (zu viele Case-Typen): so entsteht kein leerer Plan.
      try { uebernimmTabelle(res.ziel === 'new' ? A.emptyPlan(uid(), name, DEFAULT_TRUCK_ID) : store.get().plan, entwuerfeAus(res.eintraege).entwuerfe, uid, res.gebaut); }
      catch (err) { await showAlert(err.message); return false; }
      return true;
    };
    // Grundboxen (Dolly-Abfrage) und Bibliothek für Pre-Rig-Vorlagen: nur lesen, der Import schreibt nie hinein.
    const bestand = bestandOf(store.get()).cases;
    const res = await openTabellenImport($('#dlg-tabelle'), {
      trussDlg: $('#dlg-truss'),
      dollyDlg: $('#dlg-dolly'),
      dollyBasen: bestand.filter(c => c.dollyPrompt && isInStock(c)),
      bibliothekCases: bestand,
      dateiname: files.map(f => f.name).join(', '),
      eintraege,
      zielAktuell: store.get().plan?.name ?? null,
      ...lkwOpts(),
      bestaetige,
    });
    if (res) await uebernehmen(res, name);
  }

  // Angaben für den LKW-Schritt (Stand beim Öffnen des Dialogs).
  function lkwOpts() {
    const s = store.get();
    const plan = s.plan;
    const b = bestandOf(s);
    const caseById = new Map(b.cases.map(c => [c.id, c]));
    const zaehler = new Map();
    for (const p of plan ? piecesOf(plan) : []) {
      const c = caseById.get(p.caseId);
      if (c) zaehler.set(catOf(c), (zaehler.get(catOf(c)) ?? 0) + 1);
    }
    return {
      zielHatLkw: !!plan && (isMultiLkw(plan) || plan.placements.length > 0),
      freieLkw: Math.max(MAX_LKW - lkwsOf(plan).length, 0),
      fahrzeuge: b.trucks.map(({ id, name }) => ({ id, name })),
      vorhandeneGewerke: [...zaehler].map(([name, stueck]) => ({ name, stueck })),
      // Rechnet auf einer Kopie; Ziel „neu“ auf einem leeren Plan. Ändert den Store nicht.
      vorschau: async res => {
        const basis = res.ziel === 'new' ? A.emptyPlan(uid(), '', DEFAULT_TRUCK_ID) : store.get().plan;
        return rechneLkwImport({ ...store.get(), plan: basis }, res, uid).bericht;
      },
    };
  }

  // Zeilen, die wegen roter Befunde fehlen, werden genannt (Zahl und die ersten Namen).
  const ausgelassenText = ausgelassen => {
    const liste = capList(ausgelassen.map(e => `${e.zeile ?? '+'}: ${e.werte.name || e.werte.typ || '?'}`)).join(', ');
    return ausgelassen.length === 1
      ? t('1 Zeile mit Fehlern wurde nicht übernommen: {liste}', { liste })
      : t('{n} Zeilen mit Fehlern wurden nicht übernommen: {liste}', { n: ausgelassen.length, liste });
  };

  async function uebernehmen({ eintraege, ziel, laden, gebaut, lkw }, name) {
    const { entwuerfe, ausgelassen } = entwuerfeAus(eintraege);
    if (ziel === 'new') switchPlan(A.emptyPlan(uid(), name, DEFAULT_TRUCK_ID));
    const vor = stueckIds(store.get().plan);
    editWhole(p => uebernimmTabelle(p, entwuerfe, uid, gebaut));
    if (ausgelassen.length) await showAlert(ausgelassenText(ausgelassen));
    if (!entwuerfe.length && !gebaut.stuecke.length) return;
    if (!laden) {
      // Mehr-LKW: neues Material ist keinem LKW zugeordnet (wie im Lade-Assistenten).
      if (isMultiLkw(store.get().plan)) await showAlert(multiAddedNotice());
      return;
    }
    // Zweiter Schritt, damit der Kontext die neuen mitgeführten Cases kennt; ohne eigenen
    // Rückgängig-Schritt, ein Rückgängig nimmt beides zurück. Dieselben Funktionen wie die Vorschau.
    const neu = neueStueckIds(store.get().plan, vor);
    editWhole((p, c) => planeLkws(p, { ...c, truckById: truckByIdOf(store.get()) }, { ...lkw, neu }), false);
    const s = store.get();
    const ids = lkw.verhalten === VERHALTEN.NEU ? piecesOf(s.plan).map(p => p.id) : neu;
    const text = nichtGeladenText(lkwBericht(s.plan, ids, wholeCtxOf(s, uid).caseById).nichtGeladen);
    if (text) await showAlert(text);
  }

  input.onchange = () => {
    const files = [...input.files];
    input.value = ''; // dieselbe Datei darf erneut gewählt werden
    if (files.length) verarbeite(files);
  };
  const start = () => input.click();
  const hilfe = () => openTabellenHilfe($('#dlg-tabelle-hilfe'));

  const knopf = $('#tabelle-btn');
  if (knopf) knopf.onclick = start;
  const hilfeKnopf = $('#tabelle-hilfe');
  if (hilfeKnopf) hilfeKnopf.onclick = hilfe;
  const vorlage = $('#tabelle-vorlage');
  if (vorlage) vorlage.href = vorlageDatei();

  return { start, hilfe };
}
