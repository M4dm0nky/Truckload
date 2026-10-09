import * as hostDb from './hostDb.js';

// Läuft Truckload als Tab in NYX, setzt NYX `globalThis.truckloadHost` (docs/nyx-host.md), und
// jeder Zugriff geht dorthin statt an IndexedDB. Geprüft wird je Aufruf, nicht einmal beim
// Laden: NYX setzt den Host per Preload vor allen Skripten, und so bleibt die Wahl ohne
// Modul-Neuladen testbar. Ohne Host ändert sich für die Web-App nichts.
const host = () => globalThis.truckloadHost;

const DB_NAME = 'truckload';
// Version 2 ergänzt den Store ruleSets. onupgradeneeded legt nur fehlende Stores an, vorhandene
// Daten bleiben.
const DB_VERSION = 2;
const STORES = ['cases', 'trucks', 'plans', 'ruleSets'];
let dbPromise;

// Ein VERSION-Bump blockiert, solange ein anderes Fenster/Tab noch eine ältere Verbindung offen
// hält (der Browser feuert dann `onblocked`, nicht `onerror`) – `open()` bliebe sonst für immer
// PENDING, `await repo.loadAll()` löst nie auf, und die Seite steht ohne Erklärung. Bei
// `onblocked` wird deshalb NICHT abgelehnt (ein Fallback sähe wie leere Daten aus, wäre aber nur
// „noch nicht offen“), sondern weiter gewartet und über einen optionalen Rückruf informiert, mit
// dem die Oberfläche einen Hinweis einblendet; feuert danach doch `onsuccess`, sagt ein zweiter
// Rückruf, dass der Hinweis wieder verschwinden darf. Eine geöffnete Verbindung setzt außerdem
// `onversionchange` und schließt sich selbst, statt eine spätere Öffnung zu blockieren – ebenfalls
// mit optionalem Rückruf („Neue Version in einem anderen Fenster – bitte neu laden“).
let blockedHandler = null;
let unblockedHandler = null;
let versionChangeHandler = null;
export const setBlockedHandler = fn => { blockedHandler = fn; };
export const setUnblockedHandler = fn => { unblockedHandler = fn; };
export const setVersionChangeHandler = fn => { versionChangeHandler = fn; };

// Exportiert als kleinste Testnaht: `dbPromise` ist Modulebene und einmalig gespritzt (`??=`),
// ein Test kann open() aber direkt mit einem Fake-`indexedDB` aufrufen.
export function open() {
  if (host()) return Promise.resolve(null);
  return (dbPromise ??= new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      for (const s of STORES) if (!req.result.objectStoreNames.contains(s))
        req.result.createObjectStore(s, { keyPath: 'id' });
    };
    req.onblocked = () => blockedHandler?.();
    req.onsuccess = () => {
      unblockedHandler?.();
      const database = req.result;
      database.onversionchange = () => { versionChangeHandler?.(); database.close(); };
      resolve(database);
    };
    req.onerror = () => reject(req.error);
  }));
}

// Ein abgelehntes/abgebrochenes `tx.error` ist nicht verlässlich gefüllt (in Chrome bei einem
// `tx.abort()` z. B. `null`); wer daraus `err.message` liest, bekommt einen TypeError statt der
// eigentlichen Meldung. Deshalb hier immer ein echtes Error-Objekt.
const txFailure = tx => tx.error ?? new Error('IndexedDB-Transaktion fehlgeschlagen oder abgebrochen');

function run(store, mode, fn) {
  return open().then(db => new Promise((resolve, reject) => {
    const tx = db.transaction(store, mode);
    let req;
    tx.oncomplete = () => resolve(req?.result);
    tx.onerror = () => reject(txFailure(tx));
    tx.onabort = () => reject(txFailure(tx));
    try {
      req = fn(tx.objectStore(store));
    } catch (err) {
      try { tx.abort(); } catch { /* Transaktion ist evtl. schon abgebrochen */ }
      reject(err);
    }
  }));
}

// Ladesperre (nur im Host-Betrieb): Scheitert ein Lesezugriff, zeigt app.js die Ersatzansicht mit
// nur den mitgelieferten Daten. Ein Schreibzugriff dürfte dann nicht mehr durchgehen, denn er
// träfe einen Bestand, den niemand gesehen hat (z. B. Import-Merge gegen leere Daten). Mit
// IndexedDB hatte das die kaputte DB von selbst, beim Host scheitern Lesen und Schreiben
// unabhängig. Die Sperre gilt bis zum Neuladen der Seite, ein neues Modul beginnt ohne sie.
let ladenFehlgeschlagen = false;
const sperre = () => Promise.reject(new Error('Laden aus NYX fehlgeschlagen – Truckload bitte neu laden.'));

export const getAll = store => (host()
  ? hostDb.getAll(host(), store).catch(err => { ladenFehlgeschlagen = true; throw err; })
  : run(store, 'readonly', s => s.getAll()));
export const put = (store, value) => (host()
  ? (ladenFehlgeschlagen ? sperre() : hostDb.put(host(), store, value))
  : run(store, 'readwrite', s => s.put(value)));
export const del = (store, id) => (host()
  ? (ladenFehlgeschlagen ? sperre() : hostDb.del(host(), store, id))
  : run(store, 'readwrite', s => s.delete(id)));

// Schreibt mehrere Datensätze (ggf. über mehrere Object Stores) in EINER Transaktion: entweder
// landen alle drin, oder – lehnt ein `put` ab (Quota, korrupte DB) – wird die ganze Transaktion
// verworfen. Mehrere Transaktionen hätten im Fehlerfall Teilerfolge hinterlassen (Plan
// geschrieben, Case nicht), zu denen ein Rollback der Oberfläche nicht mehr passte.
//
// Wirft `objectStore.put()` SYNCHRON (z. B. QuotaExceededError), sind die zuvor aufgerufenen
// `put()` trotzdem auf der Transaktion eingereiht und committen am Ende, obwohl der Aufruf als
// fehlgeschlagen gilt. Deshalb try/catch um die Schleife und explizites `tx.abort()`.
// items: [{ store, value }, …]
export function putMany(items) {
  if (items.length === 0) return Promise.resolve();
  if (host()) return ladenFehlgeschlagen ? sperre() : hostDb.putMany(host(), items);
  return open().then(db => new Promise((resolve, reject) => {
    const storeNames = [...new Set(items.map(i => i.store))];
    const tx = db.transaction(storeNames, 'readwrite');
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(txFailure(tx));
    tx.onabort = () => reject(txFailure(tx));
    try {
      for (const { store, value } of items) tx.objectStore(store).put(value);
    } catch (err) {
      try { tx.abort(); } catch { /* Transaktion ist evtl. schon abgebrochen */ }
      reject(err); // falls onabort aus irgendeinem Grund nicht feuert, trotzdem sicher ablehnen
    }
  }));
}
export async function persist() {
  if (host()) return;
  try { await navigator.storage?.persist?.(); } catch { /* optional */ }
}
