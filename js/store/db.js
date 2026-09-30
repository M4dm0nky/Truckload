const DB_NAME = 'truckload';
// V 2 (0.8.5): Store ruleSets. onupgradeneeded legt nur fehlende Stores an, vorhandene Daten
// bleiben.
const DB_VERSION = 2;
const STORES = ['cases', 'trucks', 'plans', 'ruleSets'];
let dbPromise;

// Ein VERSION-Bump (wie 1→2 in V 0.8.5) blockiert, solange ein anderes Fenster/Tab noch eine
// ältere Verbindung offen hält (Browser feuert dann `onblocked`, nicht `onerror`) — `open()`
// bliebe sonst für immer PENDING, `await repo.loadAll()` in js/app.js löst nie auf, und die
// Seite steht ohne jede Erklärung (Befund F1). Deshalb: bei `onblocked` NICHT ablehnen (ein
// Fallback wie bei echten Fehlern sähe wie leere Daten aus, wäre aber nur „noch nicht offen“) —
// weiter warten und über einen optionalen Rückruf informieren, den js/app.js/repo.js zum
// Einblenden eines Hinweises benutzen kann; feuert danach doch noch `onsuccess`, wird über
// einen zweiten optionalen Rückruf mitgeteilt, dass der Hinweis wieder verschwinden darf.
// Für künftige Version-Bumps setzt eine erfolgreich geöffnete Verbindung außerdem
// `onversionchange`, damit sie sich selbst schließt statt eine spätere Öffnung zu blockieren —
// ebenfalls mit optionalem Rückruf, damit js/app.js „Neue Version in einem anderen Fenster –
// bitte neu laden“ anzeigen kann.
let blockedHandler = null;
let unblockedHandler = null;
let versionChangeHandler = null;
export const setBlockedHandler = fn => { blockedHandler = fn; };
export const setUnblockedHandler = fn => { unblockedHandler = fn; };
export const setVersionChangeHandler = fn => { versionChangeHandler = fn; };

// Exportiert als kleinste Testnaht (Befund F1): `dbPromise` ist Modulebene und einmalig
// gespritzt (`??=`), ein Test kann open() aber direkt mit einem Fake-`indexedDB` aufrufen,
// ohne den ganzen Umweg über getAll()/eine Fake-Transaktion zu bauen.
export function open() {
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

// Ein abgelehntes/abgebrochenes `tx.error` ist nicht verlässlich gefüllt (in Chrome bei
// einem `tx.abort()` z. B. `null`) – wer daraus `err.message` liest, bekommt eine
// TypeError statt der eigentlichen Fehlermeldung, und ein `catch`-Block, der genau darauf
// eine Meldung bauen wollte, stirbt selbst mit einer unbehandelten Exception (Befund: „der
// Fehlerpfad stirbt am Fehler“). Deshalb hier immer ein echtes Error-Objekt.
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

// Schreibt mehrere Datensätze (ggf. über mehrere Object Stores hinweg) in EINER einzigen
// Transaktion: entweder landen alle drin, oder – lehnt ein `put` ab (Quota, korrupte DB) –
// wird die ganze Transaktion verworfen und KEINER davon landet in der Datenbank. Ohne das
// hätte ein Import mit drei unabhängigen `put`-Aufrufen (je Store eine eigene Transaktion)
// im Fehlerfall Teilerfolge hinterlassen können: der Plan schon geschrieben, das Case nicht
// – die Datenbank wäre dann in einem Zustand gewesen, den weder der Stand vor noch nach dem
// Import je hatte, und ein Rollback der Oberfläche auf den alten Stand hätte nicht mehr zur
// Datenbank gepasst (Befund: „Teil-Import lässt Store und Datenbank auseinanderlaufen“).
//
// Wirft `objectStore.put()` SYNCHRON (z. B. QuotaExceededError bei manchen Engines/großen
// Werten), sind die vorher in derselben Schleife schon aufgerufenen `put()` trotzdem als
// Request auf der Transaktion eingereiht – ohne ein explizites `tx.abort()` committen die
// beim natürlichen Transaktionsende trotzdem, obwohl der Aufruf insgesamt als
// fehlgeschlagen gilt (Befund: „putMany ist nicht alles-oder-nichts, wenn put() synchron
// wirft“ – belegt mit `dbHatCase: true` trotz zurückgerolltem Store). Deshalb: try/catch
// um die Schleife, im Fehlerfall explizit abbrechen.
// items: [{ store, value }, …]
export function putMany(items) {
  if (items.length === 0) return Promise.resolve();
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
  try { await navigator.storage?.persist?.(); } catch { /* optional */ }
}
