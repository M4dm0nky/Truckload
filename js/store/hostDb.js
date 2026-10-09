// Speicher über NYX (docs/nyx-host.md): läuft Truckload als Tab in NYX, setzt NYX per Preload
// `globalThis.truckloadHost`, und js/store/db.js reicht jeden Zugriff hierher durch. NYX legt
// Cases, Fahrzeuge und Regelsätze projektübergreifend ab und die Ladepläne in der Projektdatei.
// Truckload merkt davon nichts, Form und Schlüssel der Datensätze bleiben dieselben.
//
// Jede Ablehnung ist ein echtes Error-Objekt – derselbe Grund wie bei txFailure in db.js: ein
// catch-Block, der err.message liest, darf am Fehlerpfad nicht selbst sterben. Auch ein
// synchroner Wurf des Hosts wird zur Ablehnung, sonst liefe er am Autosave vorbei.

const asError = err => {
  if (err instanceof Error) return err;
  const msg = typeof err === 'string' ? err : err?.message ?? err?.error;
  return new Error(msg ? String(msg) : 'NYX-Speicher nicht erreichbar');
};

function call(fn) {
  try {
    return Promise.resolve(fn()).catch(err => { throw asError(err); });
  } catch (err) {
    return Promise.reject(asError(err));
  }
}

// Eine Nicht-Liste ist ein Fehler, kein leerer Bestand: still [] sähe für den Nutzer aus, als
// wären alle Cases oder Pläne gelöscht.
export const getAll = (host, store) => call(() => host.getAll(store)).then(list => {
  if (!Array.isArray(list)) throw new Error(`NYX lieferte für „${store}“ keine Liste`);
  return list;
});
export const put = (host, store, value) => call(() => host.put(store, value)).then(() => undefined);
export const del = (host, store, id) => call(() => host.del(store, id)).then(() => undefined);
export const putMany = (host, items) => call(() => host.putMany(items)).then(() => undefined);
