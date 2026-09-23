import test from 'node:test';
import assert from 'node:assert/strict';
import { mergeOwnWithBuiltins, normalizeOwnCases, loadAllFallback, mergeImportedBundle, buildImportWinnerItems, sanitizeUpdatedAt, pickLatestPlan } from '../js/store/repo.js';
import { PRESET_CASES } from '../js/data/preset-cases.js';
import { CASE_LIBRARY } from '../js/data/case-library.js';
import { PRESET_TRUCKS } from '../js/data/preset-trucks.js';
import { DOLLY_H, trussDims } from '../js/model/truss.js';

// js/ui/library.js baut aus dem Ergebnis von loadAll() eine `new Map(cases.map(c =>
// [c.id, c]))`, wo bei doppelten IDs der letzte Array-Eintrag gewinnt. Legt der Nutzer
// ein eigenes Case mit derselben ID wie ein Preset oder ein Bibliothekseintrag an, muss
// trotzdem das eigene Case gewinnen – sonst verschwindet es lautlos aus der Bibliothek.
test('mergeOwnWithBuiltins: eigenes Case gewinnt bei ID-Kollision mit Preset und Bibliothek', () => {
  const presetId = PRESET_CASES[0].id;
  const libId = CASE_LIBRARY[0].id;
  const ownPresetClash = { id: presetId, name: 'Mein Case (Preset-ID)', builtin: false };
  const ownLibClash = { id: libId, name: 'Mein Case (Lib-ID)', builtin: false };
  const own = [ownPresetClash, ownLibClash];

  const merged = mergeOwnWithBuiltins(own, [...PRESET_CASES, ...CASE_LIBRARY]);

  const byId = new Map(merged.map(c => [c.id, c]));
  assert.equal(byId.get(presetId), ownPresetClash);
  assert.equal(byId.get(libId), ownLibClash);

  const ids = merged.map(c => c.id);
  assert.equal(new Set(ids).size, ids.length, 'jede ID kommt genau einmal vor');
  assert.equal(merged.length, own.length + PRESET_CASES.length + CASE_LIBRARY.length - 2);
});

test('mergeOwnWithBuiltins: ohne Kollision bleiben alle Cases erhalten', () => {
  const own = [{ id: 'own-1', name: 'Eigenes Case', builtin: false }];
  const merged = mergeOwnWithBuiltins(own, [...PRESET_CASES, ...CASE_LIBRARY]);
  assert.equal(merged.length, own.length + PRESET_CASES.length + CASE_LIBRARY.length);
  assert.ok(merged.includes(own[0]));
});

// Ein vor der Rollbrett-Umstellung gespeichertes eigenes Traversenwagen-Case trägt noch die alte
// Höhe (h nach altem DOLLY_H-Schema) in der Datenbank. Ohne Normalisierung beim Laden wäre der
// gezeichnete Umriss (aus dem gespeicherten c.h) höher als der tatsächlich gezeichnete Stapel (aus
// dem aktuellen DOLLY_H) – sichtbar als Lücke in Seiten-/Rückansicht und 3D. loadAll() muss eigene
// Cases deshalb genauso normalisieren wie der Datei-Import (normalizeCase() in io.js).
test('normalizeOwnCases: eigener Traversenwagen bekommt seine Maße neu aus den Traversen-Parametern', () => {
  const truss = { length: 300, width: 29, count: 4 };
  const current = trussDims(truss);
  const stale = {
    id: 'own-truss', name: 'Alter Wagen', builtin: false, kind: 'truss', truss,
    l: current.l, w: current.w, h: current.h + 5, // veraltete Höhe (z. B. nach altem DOLLY_H-Schema)
    weight: 100, tippable: true, wheelH: 12, dimsInclWheels: true,
  };
  const [normalized] = normalizeOwnCases([stale]);
  assert.equal(normalized.h, current.h);
  assert.equal(normalized.h, DOLLY_H + 2 * truss.width);
  assert.equal(normalized.wheelH, 0);
  assert.equal(normalized.tippable, false);
});

test('normalizeOwnCases: normale (Nicht-Traversen-)Cases bleiben unberührt', () => {
  const own = { id: 'own-case', name: 'Eigenes Case', builtin: false, l: 80, w: 60, h: 60, weight: 40 };
  const [normalized] = normalizeOwnCases([own]);
  assert.equal(normalized, own, 'wird unverändert durchgereicht, keine Kopie/Änderung');
});

// Fix-Runde 1, [blocking]: ein vor MAX_TRUSS_WIDTH gespeichertes eigenes Traversen-Case mit
// zu großer Breite darf beim Laden weder selbst werfen (s. io.test.js) NOCH die ganze
// Bibliothek mitreißen, wenn andere eigene Cases gesund sind – normalizeOwnCases fängt
// deshalb pro Case ab, statt cases.map(normalizeCase) am ersten Fehler abbrechen zu lassen.
test('normalizeOwnCases: ein kaputtes Traversen-Case (Breite > 40) reißt nicht die ganze Bibliothek mit', () => {
  const brokenTruss = {
    id: 'broken-truss', name: 'Alter breiter Wagen', builtin: false, kind: 'truss',
    truss: { length: 300, width: 45, count: 2 },
    l: 300, w: 90, h: 62, weight: 80, tippable: false, wheelH: 12, dimsInclWheels: true,
  };
  const healthyTruss = {
    id: 'ok-truss', name: 'Gesunder Wagen', builtin: false, kind: 'truss',
    truss: { length: 300, width: 29, count: 4 },
    l: 1, w: 1, h: 999, weight: 50, tippable: false, wheelH: 12, dimsInclWheels: true,
  };
  const plainCase = { id: 'own-case', name: 'Eigenes Case', builtin: false, l: 80, w: 60, h: 60, weight: 40 };

  const result = normalizeOwnCases([brokenTruss, healthyTruss, plainCase]);
  assert.equal(result.length, 3, 'alle drei Cases bleiben erhalten, keins verschwindet');

  const broken = result.find(c => c.id === 'broken-truss');
  assert.equal(broken.l, 300); assert.equal(broken.w, 90); assert.equal(broken.h, 62);

  const healthy = result.find(c => c.id === 'ok-truss');
  const expected = trussDims(healthyTruss.truss);
  assert.equal(healthy.l, expected.l); assert.equal(healthy.w, expected.w); assert.equal(healthy.h, expected.h);

  const plain = result.find(c => c.id === 'own-case');
  assert.equal(plain, plainCase);
});

// --- Daten-11: loadAllFallback() greift, wenn IndexedDB nicht erreichbar ist ---

test('loadAllFallback: liefert nur Vorlagen, keine eigenen Daten, App bleibt bedienbar', () => {
  const data = loadAllFallback();
  assert.deepEqual(data.plans, []);
  assert.deepEqual(data.trucks, PRESET_TRUCKS);
  assert.ok(data.cases.length > 0);
  assert.ok(data.cases.every(c => c.builtin || c.id.startsWith('preset-') || c.id.startsWith('lib-')),
    'ohne erreichbare Datenbank gibt es keine eigenen Cases, nur Vorlagen und Bibliothek');
});

// --- Daten-5: mergeImportedBundle rechnet auf dem übergebenen Zustand, nicht auf einem
// vor await-Grenzen genommenen Schnappschuss ---

test('mergeImportedBundle: neuerer lokaler Plan gewinnt, Datei liefert keinen Gewinner', () => {
  const local = { id: 'p1', name: 'Lokal', updatedAt: '2026-09-21T12:00:00.000Z' };
  const fromFile = { id: 'p1', name: 'Datei', updatedAt: '2026-09-20T12:00:00.000Z' };
  const state = { cases: [], trucks: [], plans: [], plan: local };
  const bundle = { cases: [], trucks: [], plans: [fromFile] };

  const result = mergeImportedBundle(state, bundle);

  assert.equal(result.plan, local, 'lokaler Plan bleibt exakt dieselbe Referenz');
  assert.equal(result.planChanged, false);
  assert.deepEqual(result.winners.plans, [], 'nichts aus der Datei muss geschrieben werden');
});

test('mergeImportedBundle: neuerer Datei-Stand ersetzt den aktuellen Plan und wird als Gewinner gemeldet', () => {
  const local = { id: 'p1', name: 'Lokal', updatedAt: '2026-09-20T12:00:00.000Z' };
  const fromFile = { id: 'p1', name: 'Datei', updatedAt: '2026-09-21T12:00:00.000Z' };
  const state = { cases: [], trucks: [], plans: [], plan: local };
  const bundle = { cases: [], trucks: [], plans: [fromFile] };

  const result = mergeImportedBundle(state, bundle);

  assert.equal(result.plan, fromFile);
  assert.equal(result.planChanged, true);
  assert.deepEqual(result.winners.plans, [fromFile], 'nur der Gewinner wird zurückgemeldet, damit app.js nur ihn schreibt');
  assert.deepEqual(result.plans, [], 'der neue aktuelle Plan taucht nicht zusätzlich in der Nebenliste auf');
});

test('mergeImportedBundle: rechnet auf dem übergebenen (aktuellen) Zustand, nicht auf einem alten Schnappschuss', () => {
  // Genau der Fehler aus Befund Daten-5: der alte Code bildete mergedPlans aus einem s0,
  // das vor zwei await-Grenzen genommen wurde. Änderte der Nutzer währenddessen den
  // aktuellen Plan (hier simuliert durch einen neueren Zeitstempel als in der Datei),
  // wurde diese Änderung nach dem Import wieder zurückgenommen. mergeImportedBundle bekommt
  // hier bewusst den *neuen* Zustand übergeben, wie es der Store-Updater in app.js tut –
  // die zwischenzeitliche Änderung darf nicht verloren gehen.
  const editedDuringImport = { id: 'p1', name: 'Umbenannt während des Imports', updatedAt: '2026-09-21T12:00:00.500Z' };
  const fromFile = { id: 'p1', name: 'Datei', updatedAt: '2026-09-21T12:00:00.000Z' };
  const state = { cases: [], trucks: [], plans: [], plan: editedDuringImport };
  const bundle = { cases: [], trucks: [], plans: [fromFile] };

  const result = mergeImportedBundle(state, bundle);

  assert.equal(result.plan, editedDuringImport);
  assert.equal(result.planChanged, false);
});

test('mergeImportedBundle: Cases und Fahrzeuge werden unabhängig vom Plan gemischt, Gewinner separat gemeldet', () => {
  const state = {
    cases: [{ id: 'c1', name: 'Lokal', updatedAt: '2026-01-01T00:00:00.000Z' }],
    trucks: [{ id: 't1', name: 'Lokal', updatedAt: '2026-01-01T00:00:00.000Z' }],
    plans: [],
    plan: { id: 'p1', name: 'Plan', updatedAt: '2026-01-01T00:00:00.000Z' },
  };
  const bundle = {
    cases: [{ id: 'c1', name: 'Aus Datei', updatedAt: '2026-06-01T00:00:00.000Z' }, { id: 'c2', name: 'Neu' }],
    trucks: [{ id: 't1', name: 'Lokal (älter)', updatedAt: '2025-01-01T00:00:00.000Z' }],
    plans: [],
  };

  const result = mergeImportedBundle(state, bundle);

  assert.deepEqual(result.winners.cases.map(c => c.id), ['c1', 'c2'], 'c1 gewinnt über den Zeitstempel, c2 ist schlicht neu');
  assert.deepEqual(result.winners.trucks, [], 'älterer Datei-Stand von t1 verliert gegen den lokalen');
  assert.equal(result.cases.find(c => c.id === 'c1').name, 'Aus Datei');
  assert.equal(result.trucks.find(t => t.id === 't1').name, 'Lokal');
});

// --- Abschlussprüfung des Wizard-Plans: Import vom Startbildschirm (kein aktueller Plan) ---
// s.plan ist dort null (Task 1 – die App startet leer statt mit automatisch angelegtem
// Plan). mergeImportedBundle darf dann nicht mehr plan.id dereferenzieren, sondern muss den
// zu öffnenden Plan aus den (eigenen + importierten) Plänen selbst bestimmen.

test('mergeImportedBundle: plan null (Startbildschirm) – Datei mit Plänen öffnet den zuletzt geänderten', () => {
  const older = { id: 'p1', name: 'Älter', updatedAt: '2026-01-01T00:00:00.000Z' };
  const newer = { id: 'p2', name: 'Neuer', updatedAt: '2026-02-01T00:00:00.000Z' };
  const state = { cases: [], trucks: [], plans: [], plan: null };
  const bundle = { cases: [], trucks: [], plans: [older, newer] };

  const result = mergeImportedBundle(state, bundle);

  assert.equal(result.plan, newer, 'der zuletzt geänderte importierte Plan wird geöffnet');
  assert.equal(result.planChanged, true);
  assert.deepEqual(result.plans, [older], 'die übrigen importierten Pläne landen in der Nebenliste');
  assert.deepEqual(result.winners.plans.map(p => p.id).sort(), ['p1', 'p2']);
});

test('mergeImportedBundle: plan null (Startbildschirm) – eigene gespeicherte Pläne zählen mit', () => {
  const own = { id: 'p1', name: 'Eigener', updatedAt: '2026-03-01T00:00:00.000Z' };
  const fromFile = { id: 'p2', name: 'Aus Datei', updatedAt: '2026-01-01T00:00:00.000Z' };
  const state = { cases: [], trucks: [], plans: [own], plan: null };
  const bundle = { cases: [], trucks: [], plans: [fromFile] };

  const result = mergeImportedBundle(state, bundle);

  assert.equal(result.plan, own, 'der neuere, schon vorhandene Plan gewinnt, obwohl kein Plan aktuell offen war');
  assert.deepEqual(result.plans, [fromFile]);
});

test('mergeImportedBundle: plan null (Startbildschirm) – Datei ohne jeden Plan lässt es beim Startbildschirm', () => {
  const state = { cases: [{ id: 'c1' }], trucks: [], plans: [], plan: null };
  const bundle = { cases: [], trucks: [], plans: [] };

  const result = mergeImportedBundle(state, bundle);

  assert.equal(result.plan, null, 'ohne jeden Plan bleibt es beim Startbildschirm statt zu werfen');
  assert.equal(result.planChanged, false);
  assert.deepEqual(result.plans, []);
});

// --- Fix-Runde 2 (Task 2): die reine Zuordnung „welcher Gewinner gehört in welchen
// Object Store“, die repo.saveImportWinners() an db.putMany() übergibt. Das ist die
// „Zuordnung in saveImportWinners“, die sich ohne IndexedDB mit node --test prüfen lässt -
// der eigentliche Schreibvorgang (db.putMany) braucht echtes IndexedDB und ist nur im
// Browser verifizierbar (siehe CDP-Szenarien im Task-Bericht).

test('buildImportWinnerItems: jeder Gewinner wird seinem eigenen Object Store zugeordnet', () => {
  const winners = {
    cases: [{ id: 'c1' }, { id: 'c2' }],
    trucks: [{ id: 't1' }],
    plans: [{ id: 'p1' }],
  };
  const items = buildImportWinnerItems(winners);
  assert.deepEqual(items, [
    { store: 'cases', value: { id: 'c1' } },
    { store: 'cases', value: { id: 'c2' } },
    { store: 'trucks', value: { id: 't1' } },
    { store: 'plans', value: { id: 'p1' } },
  ]);
});

test('buildImportWinnerItems: leere Gewinnerlisten erzeugen keine Einträge', () => {
  assert.deepEqual(buildImportWinnerItems({ cases: [], trucks: [], plans: [] }), []);
});

// --- Befund „der Absturzpfad ist nur an der Grenze geschlossen, nicht an der
// Absturzstelle“: js/app.js:41 sortierte VOR dem Fix außerhalb des try/catch, das
// repo.loadAll() absichert. Ein `updatedAt`, das keine Zeichenkette ist (z. B. eine Zahl
// aus einem vor V0.7 importierten Datensatz), ließ `.localeCompare()` dort auf
// Modulebene werfen und die ganze Seite unbedienbar machen (kein Planwähler, kein
// Importieren-Handler). Rückbau-Beleg: kommentiert man in repo.js entweder sanitizeUpdatedAt()
// (loadAll gibt den ungefilterten `plans` zurück) ODER die ts()-Absicherung in
// pickLatestPlan() aus (schlicht `p.updatedAt` statt der Typprüfung), wirft einer der beiden
// Tests unten mit „b.localeCompare is not a function“ bzw. ".updatedAt" ist keine Funktion.

test('sanitizeUpdatedAt: ein Datensatz mit nicht-zeichenkettigem updatedAt wird bereinigt (Feld entfernt), der Rest bleibt erhalten', () => {
  const bad = { id: 'p1', name: 'Kaputt', updatedAt: 12345 };
  const ok = { id: 'p2', name: 'Gesund', updatedAt: '2026-09-21T12:00:00.000Z' };
  const [sanitizedBad, sanitizedOk] = sanitizeUpdatedAt([bad, ok]);
  assert.equal('updatedAt' in sanitizedBad, false, 'das kaputte Feld wird entfernt, nicht nur überschrieben');
  assert.equal(sanitizedBad.id, 'p1');
  assert.equal(sanitizedBad.name, 'Kaputt');
  assert.equal(sanitizedOk, ok, 'ein gesunder Datensatz bleibt unverändert (dieselbe Referenz)');
});

// Befund N1 der Abschluss-Review: sanitizeUpdatedAt() bereinigte in Fix-Runde 2 nur `plans`,
// nicht `cases`/`trucks` – obwohl js/store/io.js `updatedAt` bei allen drei Typen gleich
// streng prüft. Ein Case oder Fahrzeug mit einem nicht-zeichenkettigen `updatedAt` (aus der
// Zeit vor der V0.7-Prüfung) lief unverändert durch die App und landete unverändert in der
// eigenen Sicherungsdatei – die dann beim Wiedereinlesen (auch der stillen Sicherung vor
// einem Import) selbst abgelehnt wurde. loadAll() muss dieselbe Bereinigung auf alle drei
// Object Stores anwenden.
test('sanitizeUpdatedAt greift gleichermaßen auf Case- und Fahrzeug-Datensätze (Befund N1)', () => {
  const badCase = { id: 'c1', name: 'Altes Case', updatedAt: 12345 };
  const okCase = { id: 'c2', name: 'Gesund', updatedAt: '2026-01-01T00:00:00.000Z' };
  const [sanitizedCase] = sanitizeUpdatedAt([badCase, okCase]);
  assert.equal('updatedAt' in sanitizedCase, false);

  const badTruck = { id: 't1', name: 'Alter Truck', updatedAt: new Date() };
  const [sanitizedTruck] = sanitizeUpdatedAt([badTruck]);
  assert.equal('updatedAt' in sanitizedTruck, false);
});

test('pickLatestPlan: wählt den Plan mit dem neuesten Zeitstempel', () => {
  const older = { id: 'p1', updatedAt: '2026-01-01T00:00:00.000Z' };
  const newer = { id: 'p2', updatedAt: '2026-09-21T00:00:00.000Z' };
  assert.equal(pickLatestPlan([older, newer]), newer);
});

test('pickLatestPlan: wirft nicht, wenn ein updatedAt keine Zeichenkette ist (Absturzstelle selbst abgesichert)', () => {
  const broken = { id: 'p1', updatedAt: 12345 };
  const withTimestamp = { id: 'p2', updatedAt: '2026-01-01T00:00:00.000Z' };
  assert.doesNotThrow(() => pickLatestPlan([broken, withTimestamp]));
  // Ein Plan ohne verlässlichen Zeitstempel gewinnt nicht gegen einen mit Zeitstempel.
  assert.equal(pickLatestPlan([broken, withTimestamp]), withTimestamp);
});

test('buildImportWinnerItems: nur die tatsächlichen Gewinner landen in der Liste, nicht alle Cases/Fahrzeuge/Pläne', () => {
  // Regression gegen eine naheliegende Verwechslung: buildImportWinnerItems bekommt
  // absichtlich schon das `winners`-Ergebnis von mergeImportedBundle übergeben, nicht den
  // gesamten gemischten Bestand - sonst würde jeder Import den kompletten lokalen Stand
  // erneut in die Datenbank schreiben, statt nur das, was tatsächlich aus der Datei kam.
  const state = { cases: [{ id: 'local', updatedAt: '2026-01-01T00:00:00.000Z' }], trucks: [], plans: [], plan: { id: 'p', updatedAt: '2026-01-01T00:00:00.000Z' } };
  const bundle = { cases: [{ id: 'new-from-file' }], trucks: [], plans: [] };
  const merge = mergeImportedBundle(state, bundle);
  const items = buildImportWinnerItems(merge.winners);
  assert.deepEqual(items.map(i => i.value.id), ['new-from-file'], 'nur das neue Case aus der Datei, nicht das lokale');
});
