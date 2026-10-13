import * as db from './db.js';
import { PRESET_CASES } from '../data/preset-cases.js';
import { CASE_LIBRARY } from '../data/case-library.js';
import { PRESET_TRUCKS } from '../data/preset-trucks.js';
import { normalizeCase, mergeById, dropStrayLegacy } from './io.js';
import { stamp } from '../model/stamp.js';
import { composeRecords, withBuiltins, recordsAfterChanges, MEINE_ID, MEINE_NAME, STANDARD_ID } from '../model/collections.js';

// Reicht die db.js-Rückrufe weiter: die App-Schicht importiert db.js nicht selbst, sondern nur
// repo.js.
export const setBlockedHandler = db.setBlockedHandler;
export const setUnblockedHandler = db.setUnblockedHandler;
export const setVersionChangeHandler = db.setVersionChangeHandler;

// Reihenfolge: eigene Cases, dann Vorlagen, dann Bibliothek. Bei einer ID-Kollision gewinnt das
// eigene Case – Presets/Bibliothekseinträge mit dieser ID entfallen. Verbraucher wie
// js/ui/library.js bauen aus dem Ergebnis eine Map nach id, in der der letzte Eintrag gewinnt;
// ohne den Filter würde ein Preset das eigene Case dort stillschweigend überschreiben.
export function mergeOwnWithBuiltins(ownCases, builtinCases) {
  const ownIds = new Set(ownCases.map(c => c.id));
  return [...ownCases, ...builtinCases.filter(b => !ownIds.has(b.id))];
}

// Eigene Traversenwagen-Cases beziehen ihre Maße immer neu aus den Traversen-Parametern (dieselbe
// Normalisierung wie beim Datei-Import, s. `normalizeCase()` in io.js), damit ein früher angelegtes
// Case keinen veralteten `h`-Wert behält, der größer als der gezeichnete Stapel wäre. Normale
// Cases bleiben unberührt (normalizeCase() fasst nur `kind === 'truss'` an); Vorlagen berechnen
// ihre Maße bei jedem Start neu und laufen hier nicht durch.
// Pro Case abgefangen: ein einzelner kaputter Datensatz darf nicht dazu führen, dass loadAll()
// insgesamt scheitert und app.js über loadAllFallback() die GESAMTE eigene Bibliothek verwirft –
// gesunde Cases bleiben normalisiert, das kaputte bleibt unverändert.
// Zusätzlich fällt ein verirrtes `legacy` an eigenen Nicht-`lib-`-Cases weg (dropStrayLegacy, io.js).
export const normalizeOwnCases = cases => cases.map(raw => {
  const c = dropStrayLegacy(raw);
  try { return normalizeCase(c); } catch { return c; }
});

// Ein `updatedAt`, das keine Zeichenkette ist (Zahl oder Date-Objekt aus einem älteren oder
// fremden Datensatz), lässt js/app.js beim Sortieren nach dem neuesten Plan (`.localeCompare`)
// auf Modulebene werfen, außerhalb des try/catch um loadAll() – danach ist die Seite
// unbedienbar. Deshalb wird das Feld beim Laden entfernt, der Rest des Datensatzes bleibt.
//
// Betrifft nicht nur Pläne: io.js weist `checkCase`/`checkTruck` ein solches `updatedAt` ab. Ein
// Case oder Fahrzeug mit Altwert landet unverändert in einer Sicherungsdatei (exportBundle prüft
// nicht) und wäre mit der eigenen Sicherung nicht mehr importierbar. Daher dieselbe Bereinigung
// für alle drei Stores.
export function sanitizeUpdatedAt(records) {
  return records.map(r => {
    if (typeof r?.updatedAt === 'string') return r;
    const { updatedAt, ...rest } = r;
    return rest;
  });
}

// Zusätzliche Absicherung an der eigentlichen Absturzstelle (s. sanitizeUpdatedAt oben): auch
// falls doch einmal ein nicht-zeichenkettiges updatedAt bis hierhin durchrutscht, wirft der
// Vergleich nicht, sondern behandelt es wie „kein Zeitstempel“.
export function pickLatestPlan(plans) {
  const ts = p => (typeof p?.updatedAt === 'string' ? p.updatedAt : '');
  return [...plans].sort((a, b) => ts(b).localeCompare(ts(a)))[0];
}

// Bereinigt alle vier Stores (sanitizeUpdatedAt) und schreibt die dabei geänderten Datensätze in
// EINEM putMany zurück nach IndexedDB; sonst bliebe der Altwert dort stehen und würde bei jedem
// Start erneut bereinigt (und landete unbereinigt in Sicherungen). Ein Schreibfehler wird nur
// geloggt – das Laden darf daran nicht scheitern. `write` ist die Testnaht (db.putMany).
export async function sanitizeAndWriteBack(raw, write = db.putMany) {
  const clean = {};
  const items = [];
  for (const [storeName, records] of Object.entries(raw)) {
    clean[storeName] = sanitizeUpdatedAt(records);
    clean[storeName].forEach((r, i) => { if (r !== records[i]) items.push({ store: storeName, value: r }); });
  }
  if (items.length > 0) {
    try { await write(items); } catch (err) { console.error('Bereinigte Datensätze konnten nicht zurückgeschrieben werden:', err); }
  }
  return clean;
}

// Nur Objekte, `updatedAt` bereinigt: ein null-Eintrag aus fremden Daten darf nichts abbrechen.
const cleanCases = list => sanitizeUpdatedAt((Array.isArray(list) ? list : []).filter(c => c && typeof c === 'object'));

export async function loadAll() {
  await db.persist();
  const [legacyCases, collRecords, trucks, plans, ruleSets] = await Promise.all([
    db.getAll('cases'), db.getAll('collections'), db.getAll('trucks'), db.getAll('plans'), db.getAll('ruleSets'),
  ]);
  const clean = await sanitizeAndWriteBack({ collections: collRecords, trucks, plans, ruleSets });
  let records = clean.collections.filter(r => r.id !== STANDARD_ID);
  // Einmalige Migration (V 0.17.0): eigene Cases des alten Stores `cases` werden „Meine Sammlung“.
  // Der alte Store bleibt als Sicherheitsnetz liegen und wird danach nicht mehr gelesen. Scheitert
  // das Schreiben, läuft die App mit dem berechneten Stand weiter; writeCases baut den Datensatz
  // dann beim nächsten Speichern aus dem alten Store auf (readRecords), es geht nichts verloren.
  if (legacyCases.length > 0 && !records.some(r => r.id === MEINE_ID)) {
    const meine = stamp({ id: MEINE_ID, name: MEINE_NAME, cases: cleanCases(legacyCases) });
    try {
      await db.writeMany({ puts: [{ store: 'collections', value: meine }] });
    } catch (err) {
      console.error('Migration nach „Sammlungen“ nicht gespeichert:', err);
    }
    records = [...records, meine];
  }
  const { collections, cases: stored } = composeRecords(
    records.map(r => ({ ...r, cases: cleanCases(r.cases) })),
  );
  return {
    cases: mergeOwnWithBuiltins(normalizeOwnCases(stored), [...PRESET_CASES, ...CASE_LIBRARY]),
    collections,
    trucks: [...PRESET_TRUCKS, ...clean.trucks],
    plans: clean.plans,
    ruleSets: clean.ruleSets,
  };
}

// Ersatz für loadAll(), wenn IndexedDB nicht erreichbar ist (privates Fenster mit blockiertem
// Speicher, korrupte Datenbank, deaktivierte Site-Daten). Liefert dieselbe Form wie loadAll(), nur
// ohne eigene Daten: die Vorlagen bleiben benutzbar, und über „Importieren“ kann der Nutzer eine
// Sicherung laden, statt vor einer weißen Seite zu stehen.
export function loadAllFallback() {
  return {
    cases: mergeOwnWithBuiltins([], [...PRESET_CASES, ...CASE_LIBRARY]),
    collections: withBuiltins([]),
    trucks: [...PRESET_TRUCKS], plans: [], ruleSets: [],
  };
}

// Rechnet das Ergebnis eines Datei-Imports rein aus dem übergebenen Zustand aus, ohne
// Seiteneffekte. Der Aufrufer (js/app/importExport.js) ruft das synchron innerhalb von
// store.update() auf, damit zwischen Lesen und Schreiben keine await-Grenze liegt: der Stand, mit
// dem gemischt wird, ist exakt der, der im selben Tick in den Store geschrieben wird.
// `plan` ist null, wenn der Import vom Startbildschirm ausgelöst wird (die App startet leer) –
// dann gibt es keinen „aktuellen“ Plan, und pickLatestPlan() entscheidet unter allen Plänen
// (eigene + importierte), welcher geöffnet wird, wie auch loadAll() den zuletzt geänderten Plan
// wählt. Bringt die Sicherung keinen Plan mit, bleibt plan null und der Startbildschirm bestehen.
export function mergeImportedBundle({ cases, trucks, plans, plan, ruleSets = [], collections = withBuiltins([]) }, bundle) {
  // Eine alte, flache Sicherung kennt keine `collectionId`. Gewinnt ihr Case gegen ein lokales,
  // behält es dessen Sammlung (saveImportWinners tut dasselbe auf der Platte), sonst zeigte der
  // Speicher es unter „Meine Sammlung“, während es auf der Platte in der benannten liegt.
  // Neue Cases bleiben ohne `collectionId` (-> „Meine Sammlung“). Die Gewinner kommen aus
  // derselben abgebildeten Liste, damit die Identitätsprüfung unten weiter greift.
  const writableIds = new Set(collections.filter(c => !c.readOnly).map(c => c.id));
  const localHome = new Map(cases.filter(c => c.collectionId && writableIds.has(c.collectionId)).map(c => [c.id, c.collectionId]));
  const bundleCases = bundle.cases.map(c => (c.collectionId === undefined && localHome.has(c.id) ? { ...c, collectionId: localHome.get(c.id) } : c));
  const mergedCases = mergeById(cases, bundleCases);
  // withBuiltins baut neue Objekte; für die Gewinnerprüfung (Identität) zählt das Mischergebnis davor.
  const rawCollections = mergeById(collections.filter(c => !c.readOnly && c.id !== MEINE_ID), bundle.collections ?? []);
  const mergedCollections = withBuiltins(rawCollections);
  const mergedTrucks = mergeById(trucks, bundle.trucks);
  const mergedPlans = mergeById(plan ? [plan, ...plans] : plans, bundle.plans);
  const mergedRuleSets = mergeById(ruleSets, bundle.ruleSets ?? []);
  const nextPlan = plan
    ? (mergedPlans.find(p => p.id === plan.id) ?? plan)
    : (pickLatestPlan(mergedPlans) ?? null);
  return {
    cases: mergedCases,
    collections: mergedCollections,
    trucks: mergedTrucks,
    plans: nextPlan ? mergedPlans.filter(p => p.id !== nextPlan.id) : mergedPlans,
    plan: nextPlan,
    planChanged: nextPlan !== plan,
    ruleSets: mergedRuleSets,
    // Nur die Datensätze, die aus der Datei kommen UND gewonnen haben, müssen nach
    // IndexedDB geschrieben werden – alles andere steht dort schon (oder stand nie drin,
    // weil der lokale Stand gewonnen hat).
    winners: {
      cases: bundleCases.filter(x => mergedCases.find(m => m.id === x.id) === x),
      collections: (bundle.collections ?? []).filter(x => rawCollections.find(m => m.id === x.id) === x),
      trucks: bundle.trucks.filter(x => mergedTrucks.find(m => m.id === x.id) === x),
      plans: bundle.plans.filter(x => mergedPlans.find(m => m.id === x.id) === x),
      ruleSets: (bundle.ruleSets ?? []).filter(x => mergedRuleSets.find(m => m.id === x.id) === x),
    },
  };
}

export const saveTruck = t => db.put('trucks', t);
export const deleteTruck = id => db.del('trucks', id);
export const savePlan = p => db.put('plans', p);
export const deletePlan = id => db.del('plans', id);
export const saveRuleSet = rs => db.put('ruleSets', rs);
export const deleteRuleSet = id => db.del('ruleSets', id);

// Gespeicherte Sammlungs-Datensätze. Fehlt „meine“ (Migration noch nicht geschrieben), entsteht er
// aus dem alten Store `cases`, damit ein Schreibvorgang nie nur einen Teil des Bestands anlegt.
async function readRecords() {
  const [records, legacy] = await Promise.all([db.getAll('collections'), db.getAll('cases')]);
  // Wie in loadAll(): nur Objekte als Cases, `updatedAt` bereinigt; sonst wirft jeder Schreibvorgang
  // an einem Datensatz mit einem null-Case.
  const real = records.filter(r => r.id !== STANDARD_ID).map(r => ({ ...r, cases: cleanCases(r.cases) }));
  if (real.some(r => r.id === MEINE_ID) || legacy.length === 0) return real;
  return [...real, { id: MEINE_ID, name: MEINE_NAME, cases: cleanCases(legacy) }];
}

// Alle Case-Schreibvorgänge laufen hier durch, in EINEM writeMany (alles oder nichts).
// upserts: Cases mit `collectionId`; removeIds: entfallende Cases; touchIds: Sammlungen, deren
// Datensatz ohne Case-Änderung neu geschrieben wird (Name, Oberebene, neu angelegt);
// deleteCollectionIds: Datensätze, die verschwinden. `collections` ist die Meta-Liste nach der
// Änderung (Name und Oberebene kommen von dort).
export async function writeCases({ upserts = [], removeIds = [], touchIds = [], deleteCollectionIds = [], collections }) {
  if (!upserts.length && !removeIds.length && !touchIds.length && !deleteCollectionIds.length) return;
  const gone = new Set(deleteCollectionIds);
  // Gelöschte Datensätze verschwinden als Ganzes; sie dürfen nicht in recordsAfterChanges laufen:
  // ein Case, das daraus in eine andere Sammlung wandert (Überlagerung), würde dort den alten
  // Datensatz berühren, dessen Meta schon fehlt.
  const records = (await readRecords()).filter(r => !gone.has(r.id));
  const puts = recordsAfterChanges(records, collections, { upserts, removeIds, touchIds }, stamp)
    .filter(r => !gone.has(r.id))
    .map(value => ({ store: 'collections', value }));
  const deletes = deleteCollectionIds.map(id => ({ store: 'collections', id }));
  await db.writeMany({ puts, deletes });
}

// Die reine Zuordnung „welcher Gewinner gehört in welchen Object Store“ – ohne IndexedDB,
// deshalb mit node --test prüfbar. Gewinner eines Imports ohne die Cases (die gehen über
// writeCases/recordsAfterChanges).
export function buildImportWinnerItems(winners) {
  return [
    ...winners.trucks.map(value => ({ store: 'trucks', value })),
    ...winners.plans.map(value => ({ store: 'plans', value })),
    ...(winners.ruleSets ?? []).map(value => ({ store: 'ruleSets', value })),
  ];
}

// Schreibt die Gewinner eines Imports (siehe mergeImportedBundle) in EINER Transaktion: alle oder
// keiner. Cases und Sammlungen gehen als Datensätze; `collections` ist die Meta-Liste nach dem
// Mischen (Pflicht).
export async function saveImportWinners(winners, collections) {
  if (!Array.isArray(collections)) throw new Error('saveImportWinners: Sammlungsliste fehlt.');
  const known = new Set(collections.filter(c => !c.readOnly).map(c => c.id));
  const records = await readRecords();
  // Ohne bekannte `collectionId` (alte Sicherung) bleibt ein Case in der Sammlung, in der es lokal
  // schon liegt; nur ein wirklich neues kommt nach „Meine Sammlung“.
  const homeOf = new Map();
  for (const r of records) for (const c of r.cases ?? []) if (c && !homeOf.has(c.id)) homeOf.set(c.id, r.id);
  const upserts = winners.cases.map(c => {
    const home = homeOf.get(c.id);
    const id = c.collectionId && known.has(c.collectionId) ? c.collectionId
      : (home && known.has(home) ? home : MEINE_ID);
    return { ...c, collectionId: id };
  });
  const touchIds = (winners.collections ?? []).map(c => c.id).filter(id => known.has(id));
  const caseWrites = recordsAfterChanges(records, collections, { upserts, touchIds }, stamp)
    .map(value => ({ store: 'collections', value }));
  const puts = [...caseWrites, ...buildImportWinnerItems(winners)];
  if (!puts.length) return;
  return db.writeMany({ puts });
}
