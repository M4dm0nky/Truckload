import test from 'node:test';
import assert from 'node:assert/strict';
import { mergeOwnWithBuiltins } from '../js/store/repo.js';
import { PRESET_CASES } from '../js/data/preset-cases.js';
import { CASE_LIBRARY } from '../js/data/case-library.js';

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
