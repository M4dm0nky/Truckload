import test from 'node:test';
import assert from 'node:assert/strict';
import { mergeOwnWithBuiltins, normalizeOwnCases } from '../js/store/repo.js';
import { PRESET_CASES } from '../js/data/preset-cases.js';
import { CASE_LIBRARY } from '../js/data/case-library.js';
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
