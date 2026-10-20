import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { PRESET_CASES } from '../js/data/preset-cases.js';
import { CASE_LIBRARY } from '../js/data/case-library.js';
import { checkCase } from '../js/store/io.js';

const file = name => JSON.parse(readFileSync(new URL(`../data/${name}.json`, import.meta.url), 'utf8'));

test('standard.json: Format, ID, 201 Vorlagen mit preset-ID, alle mitgeliefert', () => {
  const f = file('standard');
  assert.equal(f.format, 'truckload-collection');
  assert.equal(f.id, 'standard');
  assert.equal(f.cases.length, 201);
  assert.ok(f.cases.every(c => c.builtin === true && c.id.startsWith('preset-')));
  assert.equal(new Set(f.cases.map(c => c.id)).size, 201);
});

test('meine.json: 137 Listen-Cases mit lib-ID, alle mitgeliefert', () => {
  const f = file('meine');
  assert.equal(f.id, 'meine');
  assert.equal(f.cases.length, 137);
  assert.ok(f.cases.every(c => c.builtin === true && c.id.startsWith('lib-')));
  assert.equal(new Set(f.cases.map(c => c.id)).size, 137);
});

test('Die Module PRESET_CASES und CASE_LIBRARY liefern genau den Inhalt der Dateien', () => {
  assert.deepEqual(PRESET_CASES, file('standard').cases);
  assert.deepEqual(CASE_LIBRARY, file('meine').cases);
});

// Hersteller-Vorlagen (Licht, Pulte, Racks) stehen ab Index 57
const neue = () => file('standard').cases.slice(57);

test('neue Hersteller-Vorlagen: jede besteht checkCase', () => {
  const n = neue();
  assert.equal(n.length, 144);
  for (const c of n) assert.doesNotThrow(() => checkCase(c), c.id);
});

test('neue Hersteller-Vorlagen: Beispielwerte', () => {
  const byId = Object.fromEntries(neue().map(c => [c.id, c]));
  const a = byId['preset-elation-dartz-360-6-pack-road-case-loaded'];
  assert.deepEqual([a.l, a.w, a.h, a.weight], [112.8, 57.4, 82.8, 128.4]);
  const b = byId['preset-digico-quantum338-flightcase'];
  assert.deepEqual([b.l, b.w, b.h, b.weight], [171.7, 64.2, 114.4, 198]);
});

test('neue Hersteller-Vorlagen: Gewicht unbekannt ist 0, und 0 trägt die Notiz', () => {
  const n = neue();
  assert.ok(n.some(c => c.weight === 0));
  for (const c of n) {
    assert.equal(c.note === 'Gewicht unbekannt', c.weight === 0, c.id);
  }
});

test('neue Hersteller-Vorlagen: alle 72 Robe-Vorlagen haben Gewicht 0', () => {
  const robe = neue().filter(c => c.name.startsWith('Robe '));
  assert.equal(robe.length, 72);
  assert.ok(robe.every(c => c.weight === 0));
});

test('neue Hersteller-Vorlagen: Eigenschaften', () => {
  assert.ok(neue().every(c => c.tippable === true && c.wheelH === 13 && c.dimsInclWheels === true));
});

test('neue Hersteller-Vorlagen: deutsche Namen', () => {
  const n = neue();
  const verboten = [/Top Loader/, /Road Case/, /flightcase/, /\bSingle\b/, /\bDual\b/, /\bPack\b/, /\bloaded\b/, /™/, /®/];
  for (const c of n) for (const re of verboten) assert.ok(!re.test(c.name), `${c.name} ~ ${re}`);
  const names = new Set(n.map(c => c.name));
  for (const x of ['Robe Einzel-Toploader-Case Pointe', 'Elation DARTZ 360 6er Roadcase - bestückt', 'DiGiCo QUANTUM338 Flightcase'])
    assert.ok(names.has(x), x);
});
