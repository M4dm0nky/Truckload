const DB_NAME = 'truckload';
const DB_VERSION = 1;
const STORES = ['cases', 'trucks', 'plans'];
let dbPromise;

function open() {
  return (dbPromise ??= new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      for (const s of STORES) if (!req.result.objectStoreNames.contains(s))
        req.result.createObjectStore(s, { keyPath: 'id' });
    };
    req.onsuccess = () => resolve(req.result);
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
