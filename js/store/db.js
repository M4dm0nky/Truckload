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

// Exportiert als kleinste Testnaht: `dbPromise` ist Modulebene und zwischengespeichert, ein Test
// kann open() aber direkt mit einem Fake-`indexedDB` aufrufen. Eine ABGELEHNTE Promise wird
// verworfen (`onerror`, auch ein synchron werfendes `indexedDB.open`), damit der nächste Zugriff
// neu versucht, statt die Sitzung lang denselben Fehler zu liefern. `onblocked` lehnt nie ab; die
// wartende Promise bleibt stehen.
export function open() {
  if (dbPromise) return dbPromise;
  const attempt = dbPromise = new Promise((resolve, reject) => {
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
  });
  attempt.catch(() => { if (dbPromise === attempt) dbPromise = undefined; });
  return attempt;
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

export const getAll = store => run(store, 'readonly', s => s.getAll());
export const put = (store, value) => run(store, 'readwrite', s => s.put(value));
export const del = (store, id) => run(store, 'readwrite', s => s.delete(id));

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
  return writeMany({ puts: items });
}

// Wie putMany, nur zusätzlich mit Löschungen in derselben Transaktion: entweder passiert alles
// (alle Puts und Deletes), oder – wirft ein Aufruf oder lehnt die Datenbank ab – nichts. Gedacht
// für „Firma löschen“, wo Überlagerungen (Puts) und Entfernungen (Deletes) zusammengehören.
// puts: [{ store, value }, …], deletes: [{ store, id }, …]
export function writeMany({ puts = [], deletes = [] } = {}) {
  if (puts.length === 0 && deletes.length === 0) return Promise.resolve();
  return open().then(db => new Promise((resolve, reject) => {
    const storeNames = [...new Set([...puts, ...deletes].map(i => i.store))];
    const tx = db.transaction(storeNames, 'readwrite');
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(txFailure(tx));
    tx.onabort = () => reject(txFailure(tx));
    try {
      for (const { store, value } of puts) tx.objectStore(store).put(value);
      for (const { store, id } of deletes) tx.objectStore(store).delete(id);
    } catch (err) {
      try { tx.abort(); } catch { /* Transaktion ist evtl. schon abgebrochen */ }
      reject(err); // falls onabort aus irgendeinem Grund nicht feuert, trotzdem sicher ablehnen
    }
  }));
}
export async function persist() {
  try { await navigator.storage?.persist?.(); } catch { /* optional */ }
}
