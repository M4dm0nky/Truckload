import test from 'node:test';
import assert from 'node:assert/strict';
import { mergeOwnWithBuiltins, normalizeOwnCases, loadAllFallback, mergeImportedBundle } from '../js/store/repo.js';
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
