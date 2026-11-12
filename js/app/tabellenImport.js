// Verdrahtung „Tabelle importieren“: Dateiwahl, Reiter erkennen, Dialog, Ziel, Übernahme.
// Kein Import von js/app.js; alles Übrige kommt als Parameter (wie bei wirePlans).
import * as A from '../model/actions.js';
import { DEFAULT_TRUCK_ID } from '../data/preset-trucks.js';
import { erkenneReiter, werteZeilen, entwurfAus } from '../model/ladeliste.js';
import { uebernimmTabelle } from '../model/tabellen-uebernahme.js';
import { isMultiLkw } from '../model/lkw.js';
import { NAME_MAX } from '../model/limits.js';
import { readTabellenDateien } from '../store/tabelle-lesen.js';
import { openTabellenImport, openTabellenHilfe, vorlageDatei } from '../ui/tabellen-import.js';
import { multiAddedNotice } from './plans.js';
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

// deps: store, editWhole, switchPlan, uid, showAlert, showPrompt, warnIfUnplaced. Liefert { start, hilfe }.
export function wireTabellenImport({ store, editWhole, switchPlan, uid, showAlert, showPrompt, warnIfUnplaced }) {
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
    const res = await openTabellenImport($('#dlg-tabelle'), {
      dateiname: files.map(f => f.name).join(', '),
      eintraege,
      zielAktuell: store.get().plan?.name ?? null,
    });
    if (res) await uebernehmen(res);
  }

  async function uebernehmen({ eintraege, ziel, laden }) {
    // Rote Zeilen haben keinen Entwurf und fallen hier heraus (der Dialog sperrt sonst schon).
    const entwuerfe = eintraege.map(entwurfAus).filter(Boolean);
    let name = null;
    if (ziel === 'new') {
      name = await showPrompt(t('Name des neuen Projekts:'), t('Load {date}', { date: date(new Date()) }), { maxlength: NAME_MAX });
      if (!name?.trim()) return;
      name = name.trim();
    }
    // Vorab auf einem Entwurf des Zielplans prüfen (zu viele Case-Typen): so entsteht kein leerer Plan.
    try { uebernimmTabelle(ziel === 'new' ? A.emptyPlan(uid(), name, DEFAULT_TRUCK_ID) : store.get().plan, entwuerfe, uid); }
    catch (err) { await showAlert(err.message); return; }
    if (ziel === 'new') switchPlan(A.emptyPlan(uid(), name, DEFAULT_TRUCK_ID));
    editWhole(p => uebernimmTabelle(p, entwuerfe, uid));
    if (!entwuerfe.length) return;
    // Mehr-LKW: neues Material ist keinem LKW zugeordnet (wie im Lade-Assistenten).
    if (isMultiLkw(store.get().plan)) { await showAlert(multiAddedNotice()); return; }
    if (laden) {
      // Zweiter Schritt, damit der Kontext die neuen mitgeführten Cases kennt; ohne eigenen
      // Rückgängig-Schritt, ein Rückgängig nimmt beides zurück.
      editWhole((p, c) => A.packRest(p, c), false);
      await warnIfUnplaced();
    }
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
