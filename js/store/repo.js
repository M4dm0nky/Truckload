import * as db from './db.js';
import { PRESET_CASES } from '../data/preset-cases.js';
import { CASE_LIBRARY } from '../data/case-library.js';
import { PRESET_TRUCKS } from '../data/preset-trucks.js';
import { normalizeCase, mergeById } from './io.js';

export const stamp = obj => ({ ...obj, updatedAt: new Date().toISOString() });

// Reihenfolge: eigene Cases, dann Vorlagen, dann Bibliothek. Bei einer ID-Kollision
// gewinnt weiterhin das eigene Case – Presets/Bibliothekseinträge mit dieser ID
// entfallen, statt Duplikate zu erzeugen oder das eigene Case zu verdecken (Verbraucher
// wie js/ui/library.js bauen aus dem Ergebnis eine Map nach id, wo der letzte Eintrag
// gewinnt – ohne diesen Filter würde ein Preset/Bibliothekseintrag mit derselben ID
// das eigene Case dort stillschweigend überschreiben).
export function mergeOwnWithBuiltins(ownCases, builtinCases) {
  const ownIds = new Set(ownCases.map(c => c.id));
  return [...ownCases, ...builtinCases.filter(b => !ownIds.has(b.id))];
}

// Eigene Traversenwagen-Cases beziehen ihre Maße immer neu aus den Traversen-Parametern (dieselbe
// Normalisierung wie beim Datei-Import, s. `normalizeCase()` in io.js) – so bekommt ein vor einer
// Rollbrett-/Höhenänderung angelegtes eigenes Case keinen veralteten `h`-Wert, der dann größer als
// der gezeichnete Stapel wäre. Normale Cases sind davon nicht betroffen, da normalizeCase() nur
// `kind === 'truss'` anfasst; Vorlagen (PRESET_CASES/CASE_LIBRARY) berechnen ihre Maße ohnehin bei
// jedem Start neu und laufen hier nicht mit durch.
// Pro Case abgefangen: ein einzelner kaputter Datensatz (z. B. ein anderweitig
// beschädigtes eigenes Case, das normalizeCase() nicht erwartet) darf nicht dazu führen,
// dass loadAll() insgesamt scheitert und app.js über loadAllFallback() die GESAMTE eigene
// Bibliothek verwirft – gesunde Cases bleiben normalisiert, das kaputte bleibt unverändert
// (Fix-Runde 1, [blocking]). normalizeCase() selbst wirft für die häufigste bekannte
// Ursache (Traversenbreite über der Grenze) inzwischen ohnehin nicht mehr; dieser Fang ist
// die zusätzliche Absicherung gegen unbekannte künftige Fälle.
export const normalizeOwnCases = cases => cases.map(c => {
  try { return normalizeCase(c); } catch { return c; }
});

// Ein `updatedAt`, das keine Zeichenkette ist (z. B. ein vor V 0.7 importierter oder auf
// anderem Weg entstandener Datensatz mit einer Zahl oder einem Date-Objekt), lässt
// js/app.js beim Sortieren nach dem neuesten Plan (`.localeCompare`) auf Modulebene werfen –
// AUSSERHALB des try/catch, das loadAll() dort absichert (Befund „der Absturzpfad ist nur an
// der Grenze geschlossen, nicht an der Absturzstelle“). Danach ist die Seite unbedienbar:
// kein Planwähler, kein Importieren-Handler. Deshalb hier beim Laden bereinigt: das kaputte
// Feld wird entfernt, der restliche Datensatz bleibt unverändert erhalten.
//
// Betrifft nicht nur Pläne: js/store/io.js weist `checkCase`/`checkTruck` ebenso beim
// `updatedAt`-Typ ab. Ein Case oder Fahrzeug mit einem solchen Altwert lief bis V 0.7 durch
// die App, landet damit unverändert in einer Sicherungsdatei (exportBundle prüft nicht) –
// und wäre danach mit der eigenen, gerade erst geschriebenen Sicherung nicht mehr
// importierbar, auch nicht mit der stillen Sicherung vor einem Import (Fix-Runde 2,
// [Critical]). Deshalb wird dieselbe Bereinigung auf alle drei Stores angewendet.
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

export async function loadAll() {
  await db.persist();
  const [cases, trucks, plans] = await Promise.all([db.getAll('cases'), db.getAll('trucks'), db.getAll('plans')]);
  const ownCases = normalizeOwnCases(sanitizeUpdatedAt(cases));
  const mergedCases = mergeOwnWithBuiltins(ownCases, [...PRESET_CASES, ...CASE_LIBRARY]);
  return {
    cases: mergedCases,
    trucks: [...PRESET_TRUCKS, ...sanitizeUpdatedAt(trucks)],
    plans: sanitizeUpdatedAt(plans),
  };
}

// Ersatz für loadAll(), wenn IndexedDB nicht erreichbar ist (privates Fenster mit
// blockiertem Speicher, korrupte Datenbank, deaktivierte Site-Daten – Befund Daten-11).
// Liefert dieselbe Form wie loadAll(), nur ohne eigene Daten: die Vorlagen bleiben
// benutzbar, und über „Importieren“ kann der Nutzer eine Sicherung laden, statt vor einer
// weißen Seite zu stehen.
export function loadAllFallback() {
  return { cases: mergeOwnWithBuiltins([], [...PRESET_CASES, ...CASE_LIBRARY]), trucks: [...PRESET_TRUCKS], plans: [] };
}

// Rechnet das Ergebnis eines Datei-Imports rein aus dem übergebenen Zustand aus, ohne
// Seiteneffekte. app.js ruft das synchron innerhalb von store.update() auf, damit der
// Lese-dann-Schreiben-Ablauf keine Lücke über eine await-Grenze hinweg hat (Befund Daten-5):
// der Stand, mit dem gemischt wird, ist exakt der, der im selben Tick auch in den Store
// geschrieben wird – zwischenzeitliche Änderungen des Nutzers (die dieselbe Store-Referenz
// verändert hätten) sind darin schon enthalten.
export function mergeImportedBundle({ cases, trucks, plans, plan }, bundle) {
  const mergedCases = mergeById(cases, bundle.cases);
  const mergedTrucks = mergeById(trucks, bundle.trucks);
  const mergedPlans = mergeById([plan, ...plans], bundle.plans);
  const nextPlan = mergedPlans.find(p => p.id === plan.id) ?? plan;
  return {
    cases: mergedCases,
    trucks: mergedTrucks,
    plans: mergedPlans.filter(p => p.id !== nextPlan.id),
    plan: nextPlan,
    planChanged: nextPlan !== plan,
    // Nur die Datensätze, die aus der Datei kommen UND gewonnen haben, müssen nach
    // IndexedDB geschrieben werden – alles andere steht dort schon (oder stand nie drin,
    // weil der lokale Stand gewonnen hat).
    winners: {
      cases: bundle.cases.filter(x => mergedCases.find(m => m.id === x.id) === x),
      trucks: bundle.trucks.filter(x => mergedTrucks.find(m => m.id === x.id) === x),
      plans: bundle.plans.filter(x => mergedPlans.find(m => m.id === x.id) === x),
    },
  };
}

export const saveCase = c => db.put('cases', c);
export const deleteCase = id => db.del('cases', id);
export const saveTruck = t => db.put('trucks', t);
export const deleteTruck = id => db.del('trucks', id);
export const savePlan = p => db.put('plans', p);
export const deletePlan = id => db.del('plans', id);

// Die reine Zuordnung „welcher Gewinner gehört in welchen Object Store“ – ohne IndexedDB,
// deshalb mit node --test prüfbar (anders als der eigentliche Schreibvorgang, der echtes
// IndexedDB braucht und nur im Browser verifiziert werden kann).
export function buildImportWinnerItems(winners) {
  return [
    ...winners.cases.map(value => ({ store: 'cases', value })),
    ...winners.trucks.map(value => ({ store: 'trucks', value })),
    ...winners.plans.map(value => ({ store: 'plans', value })),
  ];
}

// Schreibt die Gewinner eines Imports (siehe mergeImportedBundle) in EINER Transaktion:
// entweder landen alle drin, oder – schlägt einer der Schreibvorgänge fehl – keiner.
// Unabhängige db.put()-Aufrufe je Datensatz könnten sonst teilweise erfolgreich sein, bevor
// der Gesamtvorgang als fehlgeschlagen gilt – die Datenbank stünde dann auf einem Stand, den
// weder ein Rollback der Oberfläche auf den Vor-Import-Zustand noch der Import selbst je
// vorgesehen hatte (Befund: „Teil-Import lässt Store und Datenbank auseinanderlaufen“).
export function saveImportWinners(winners) {
  return db.putMany(buildImportWinnerItems(winners));
}
