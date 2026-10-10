// Rahmen um die Anwendung: Hinweisbänder (Speicher, blockierte Verbindung, neue Version,
// zweiter Tab, unerwarteter Fehler), Speicherstatus, Versionsanzeige, Druck und
// Service-Worker-Registrierung. Kein Import von js/app.js.
import { APP_VERSION } from '../version.js';
import { buildPrint, buildChecklist, buildUnloadList, buildLabels, pageRuleFor } from '../ui/print.js';

const $ = sel => document.querySelector(sel);

const BLOCKED_TEXT = 'Truckload ist in einem anderen Fenster noch in einer älteren Version geöffnet – bitte dort schließen, dann lädt diese Seite weiter.';
const VERSION_CHANGE_TEXT = 'Neue Version in einem anderen Fenster – bitte neu laden.';

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
    text.textContent = `Unerwarteter Fehler: ${e.reason?.message || String(e.reason)}`;
  });
  repo.setBlockedHandler(() => {
    const el = $('#storage-warning');
    el.hidden = false;
    el.textContent = BLOCKED_TEXT;
  });
  repo.setUnblockedHandler(() => {
    const el = $('#storage-warning');
    if (el.textContent === BLOCKED_TEXT) el.hidden = true;
  });
  repo.setVersionChangeHandler(() => {
    const el = $('#storage-warning');
    el.hidden = false;
    el.textContent = VERSION_CHANGE_TEXT;
  });
}

// Statusanzeige des Autosaves: 'saving' | 'error' | sonst ausgeblendet.
export function setSaveStatus(status, err) {
  const el = $('#save-status');
  if (!el) return;
  if (status === 'saving') {
    el.hidden = false;
    el.classList.remove('error');
    el.textContent = 'Speichert …';
  } else if (status === 'error') {
    el.hidden = false;
    el.classList.add('error');
    el.textContent = `Nicht gespeichert – ${err?.message ?? 'Fehler beim Speichern'}. Bitte über „Sichern“ exportieren.`;
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
  el.textContent = 'Speicher nicht verfügbar — eigene Cases, Fahrzeuge und Ladepläne konnten nicht geladen werden, Änderungen werden nicht gesichert. Über „Importieren“ lässt sich eine Sicherungsdatei laden.';
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
      if (!announced) { announced = true; tabChannel.postMessage('hallo'); }
    };
    tabChannel.postMessage('hallo');
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
function setPrintPage(doc) {
  clearPrintPage();
  const rule = pageRuleFor(doc);
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
  // Die Etikettengröße steht nicht im Store (reine Druckoptik, kein Teil des Plans) und wird
  // deshalb hier direkt ein-/ausgeblendet statt über einen Render-Hook.
  $('#print-doc').onchange = () => {
    $('#print-label-size').hidden = $('#print-doc').value !== 'labels';
  };
  window.addEventListener('afterprint', clearPrintPage);
  $('#print').onclick = () => {
    const s = store.get(), d = derive(s);
    const root = $('#print-root');
    const doc = $('#print-doc').value;
    if (doc === 'checklist') {
      root.className = 'print-root doc-checklist';
      buildChecklist(root, { plan: s.plan, truck: d.truck, result: d.result });
    } else if (doc === 'unload') {
      // Seitenregel (A4 quer) und Spaltenlayout wie die Abhakliste: gleiche Klasse.
      root.className = 'print-root doc-checklist doc-unload';
      buildUnloadList(root, { plan: s.plan, truck: d.truck, result: d.result });
    } else if (doc === 'labels') {
      const size = $('#print-label-size').value;
      root.className = `print-root doc-labels size-${size}`;
      buildLabels(root, { plan: s.plan, truck: d.truck, result: d.result, size });
    } else {
      root.className = 'print-root doc-plan';
      buildPrint(root, { plan: s.plan, truck: d.truck, result: d.result, colorMode: s.caseColors });
    }
    setPrintPage(doc);
    window.print();
  };
}
