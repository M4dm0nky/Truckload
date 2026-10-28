// Rahmen um die Anwendung: Hinweisbänder (Speicher, blockierte Verbindung, neue Version,
// zweiter Tab, unerwarteter Fehler), Speicherstatus, Versionsanzeige, Druck und
// Service-Worker-Registrierung. Kein Import von js/app.js.
import { APP_VERSION } from '../version.js';
import {
  buildPrint, buildChecklist, buildUnloadList, buildLabels, pageRuleFor,
  buildPrintAll, buildChecklistAll, buildUnloadListAll, buildLabelsAll,
} from '../ui/print.js';
import { isMultiLkw, lkwsOf, NO_LKW } from '../model/lkw.js';
import { printSectionsOf } from './core.js';
import { druckeMitHost, druckTitel, createDruckSperre } from './hostPrint.js';
import { showAlert } from '../ui/confirmDialog.js';
import { t } from '../i18n/i18n.js';

const $ = sel => document.querySelector(sel);

// Als Funktionen, damit die Sprache beim Anzeigen gilt, nicht beim Laden des Moduls.
const blockedText = () => t('Truckload ist in einem anderen Fenster noch in einer älteren Version geöffnet – bitte dort schließen, dann lädt diese Seite weiter.');
const versionChangeText = () => t('Neue Version in einem anderen Fenster – bitte neu laden.');

// Muss vor dem ersten await der App laufen: der Auffangnetz-Hinweis erfasst so auch Startfehler,
// und die Verbindungs-Rückrufe müssen vor repo.loadAll() stehen, damit der erste
// indexedDB.open() sie schon kennt. Sonst bliebe die Seite bei einem DB_VERSION-Bump ohne
// Erklärung stehen, solange ein anderes Fenster noch eine ältere Version offen hält.
export function installEarlyHandlers(repo) {
  // Eigenes Element, damit der Hinweis keinen wichtigeren Speicher-Hinweis in #storage-warning
  // überschreibt. Fehler, die schon per showAlert gemeldet werden, sind gefangen.
  window.addEventListener('unhandledrejection', e => {
    console.error('Unbehandelte Ablehnung', e.reason);
    const el = document.getElementById('error-banner');
    const text = document.getElementById('error-banner-text');
    if (!el || !text) return;
    el.hidden = false;
    text.textContent = t('Unerwarteter Fehler: {detail}', { detail: e.reason?.message || String(e.reason) });
  });
  repo.setBlockedHandler(() => {
    const el = $('#storage-warning');
    el.hidden = false;
    el.textContent = blockedText();
  });
  repo.setUnblockedHandler(() => {
    const el = $('#storage-warning');
    if (el.textContent === blockedText()) el.hidden = true;
  });
  repo.setVersionChangeHandler(() => {
    const el = $('#storage-warning');
    el.hidden = false;
    el.textContent = versionChangeText();
  });
}

// Statusanzeige des Autosaves: 'saving' | 'error' | sonst ausgeblendet.
export function setSaveStatus(status, err) {
  const el = $('#save-status');
  if (!el) return;
  if (status === 'saving') {
    el.hidden = false;
    el.classList.remove('error');
    el.textContent = t('Speichert …');
  } else if (status === 'error') {
    el.hidden = false;
    el.classList.add('error');
    el.textContent = t('Nicht gespeichert – {detail}. Bitte über „Sichern“ exportieren.', { detail: err?.message ?? t('Fehler beim Speichern') });
  } else {
    el.hidden = true;
    el.classList.remove('error');
    el.textContent = '';
  }
}

// Version sichtbar machen (einzige Quelle: js/version.js).
export function showVersion() {
  $('#app-version').textContent = `V ${APP_VERSION}`;
  document.title = `Truckload V ${APP_VERSION}`;
}

// Die App läuft nach einem Ladefehler mit den Vorlagen weiter, aber der Nutzer muss erfahren,
// dass eigene Daten fehlen und Änderungen nicht gesichert werden.
export function showStorageError(err) {
  if (!err) return;
  const el = $('#storage-warning');
  el.hidden = false;
  el.textContent = t('Speicher nicht verfügbar — eigene Cases, Fahrzeuge und Ladepläne konnten nicht geladen werden, Änderungen werden nicht gesichert. Über „Importieren“ lässt sich eine Sicherungsdatei laden.');
}

// Zweiter Tab: nur erkennen und melden, kein Abgleich der Stände. Jeder Tab meldet sich beim
// Start einmal über den Kanal; ein schon offener Tab antwortet einmal selbst, damit beide
// Seiten den Hinweis sehen, egal wer zuerst da war. Die Schließen-Knöpfe gibt es, damit ein
// Hinweis nicht falsch stehen bleibt, wenn der andere Tab längst zu ist.
export function wireBanners() {
  $('#error-banner-close').onclick = () => { $('#error-banner').hidden = true; };
  $('#tab-warning-close').onclick = () => { $('#tab-warning').hidden = true; };

  if ('BroadcastChannel' in window) {
    const tabChannel = new BroadcastChannel('truckload');
    let announced = false;
    tabChannel.onmessage = () => {
      $('#tab-warning').hidden = false;
      if (!announced) { announced = true; tabChannel.postMessage('hello'); }
    };
    tabChannel.postMessage('hello');
  }
}

// Offline-Betrieb (nur über http/https, nicht über file://). sw.js lädt Netz zuerst und nimmt
// den Offline-Cache nur ohne Netz; `updateViaCache: 'none'` holt auch sw.js selbst nie aus dem
// HTTP-Cache, damit eine neue Version sofort erkannt wird. Übernimmt ein neuer Service Worker,
// lädt die offene Seite einmal neu, statt eine Mischung aus altem und neuem Stand zu zeigen.
// hadController verhindert den Reload beim allerersten Besuch.
export function registerServiceWorker() {
  if (!('serviceWorker' in navigator && location.protocol.startsWith('http'))) return;
  const hadController = !!navigator.serviceWorker.controller;
  navigator.serviceWorker.register('sw.js', { updateViaCache: 'none' }).catch(err => console.warn('Offline-Modus nicht verfügbar:', err));
  let reloaded = false;
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (!hadController || reloaded) return;
    reloaded = true;
    location.reload();
  });
}

// Die Seitenvorschrift hängt an der Druckart (pageRuleFor in js/ui/print.js): Etiketten wollen
// A4 hoch und randlos, Ladeplan und Abhakliste A4 quer. Sie wird NACH dem Druck wieder
// entfernt, sonst druckte der nächste Ladeplan im Hochformat.
function setPrintPage(doc, randUntenMm = null) {
  clearPrintPage();
  const rule = pageRuleFor(doc, { randUntenMm });
  if (!rule) return;
  const el = document.createElement('style');
  el.id = 'print-page';
  el.textContent = rule;
  document.head.appendChild(el);
}
function clearPrintPage() {
  document.getElementById('print-page')?.remove();
}

// deps: store, derive.
export function wirePrint({ store, derive }) {
  // Die Etikettengröße und der Druckumfang stehen nicht im Store (reine Druckoptik, kein Teil des
  // Plans) und werden deshalb hier direkt ein-/ausgeblendet statt über einen Render-Hook.
  $('#print-doc').onchange = () => {
    $('#print-label-size').hidden = $('#print-doc').value !== 'labels';
  };
  // Der Umschalter „dieser LKW / alle LKW“ gilt nur bei Mehr-LKW-Plänen.
  // Beim Planwechsel springt der Umfang auf „dieser LKW“ zurück (sonst druckte der nächste
  // Mehr-LKW-Plan unbemerkt alles).
  let scopePlanId = null;
  const syncScope = s => {
    $('#print-scope').hidden = !(s.plan && isMultiLkw(s.plan));
    const id = s.plan?.id ?? null;
    if (id !== scopePlanId) { scopePlanId = id; $('#print-scope').value = 'one'; }
  };
  store.subscribe(syncScope);
  syncScope(store.get());
  window.addEventListener('afterprint', clearPrintPage);
  // Der Host-Druck ist asynchron (PDF in NYX). Ein zweiter Klick währenddessen baute #print-root
  // unter dem laufenden Druck neu auf und räumte dessen Seitenregel weg – deshalb abweisen, bis
  // der erste fertig ist. window.print() blockiert ohnehin, dort greift die Sperre nie.
  const sperre = createDruckSperre();
  $('#print').onclick = () => {
    if (sperre.laeuft) return;
    const s = store.get(), d = derive(s);
    const root = $('#print-root');
    const doc = $('#print-doc').value;
    const multi = isMultiLkw(s.plan);
    // „Dieser LKW“ nennt den gewählten LKW wie „alle LKW“ (Name im Kopf und auf den Etiketten);
    // Ein-LKW-Pläne: undefined, Markup unverändert.
    const lkw = multi ? lkwsOf(s.plan).find(l => l.id === d.activeLkw) : undefined;
    const all = multi && $('#print-scope').value === 'all';
    // Eigene Entscheidung: Im Reiter „Ohne LKW“ gibt es kein Fahrzeug und damit keine Zeichnung.
    // „Dieser LKW“ druckt dort nur den Abschnitt „Ohne LKW“ (Stücke ohne Ladenummer, nicht geladen),
    // so wie er bei „alle LKW“ als letzter Abschnitt steht – statt wie früher die Stücke auf dem
    // Fahrzeug des ersten LKW darzustellen.
    const onFree = multi && !all && d.activeLkw === NO_LKW;
    if (all || onFree) {
      const { sections, free } = printSectionsOf(s);
      const parts = onFree ? [] : sections;
      if (!parts.length && !free) return;
      if (doc === 'checklist') {
        root.className = 'print-root doc-checklist doc-all';
        buildChecklistAll(root, parts, { free });
      } else if (doc === 'unload') {
        root.className = 'print-root doc-checklist doc-unload doc-all';
        buildUnloadListAll(root, parts, { free });
      } else if (doc === 'labels') {
        const size = $('#print-label-size').value;
        root.className = `print-root doc-labels size-${size}`;
        buildLabelsAll(root, parts, { free });
      } else {
        root.className = 'print-root doc-plan doc-all';
        buildPrintAll(root, parts, { colorMode: s.caseColors, free });
      }
    } else if (doc === 'checklist') {
      root.className = 'print-root doc-checklist';
      buildChecklist(root, { plan: d.view, truck: d.truck, result: d.result, lkw });
    } else if (doc === 'unload') {
      // Seitenregel (A4 quer) und Spaltenlayout wie die Abhakliste: gleiche Klasse.
      root.className = 'print-root doc-checklist doc-unload';
      buildUnloadList(root, { plan: d.view, truck: d.truck, result: d.result, lkw });
    } else if (doc === 'labels') {
      const size = $('#print-label-size').value;
      root.className = `print-root doc-labels size-${size}`;
      buildLabels(root, { plan: d.view, truck: d.truck, result: d.result, size, lkw });
    } else {
      root.className = 'print-root doc-plan';
      buildPrint(root, { plan: d.view, truck: d.truck, result: d.result, colorMode: s.caseColors, lkw });
    }
    const host = globalThis.truckloadHost;
    if (host?.print) {
      const lkwName = onFree ? t('Ohne LKW') : lkw?.name;
      sperre.lauf(() => druckeMitHost({
        host, doc, titel: druckTitel(doc, { plan: s.plan, truck: d.truck, lkwName, alle: all }),
        einsetzen: (kopf, abschluss) => {
          // HTML von NYX (gleiches Haus, eigenes Protokoll), eigene Container ohne Truckload-Klassen
          const k = document.createElement('div'); k.className = 'host-print-kopf'; k.innerHTML = kopf;
          const a = document.createElement('div'); a.className = 'host-print-abschluss'; a.innerHTML = abschluss;
          root.prepend(k); root.append(a);
          return () => { k.remove(); a.remove(); };
        },
        setPage: setPrintPage,
        clearPage: clearPrintPage,
        zeigeFehler: m => showAlert(t('Drucken fehlgeschlagen: {detail}', { detail: m })),
      }));
      return;
    }
    setPrintPage(doc);
    window.print();
  };
}
