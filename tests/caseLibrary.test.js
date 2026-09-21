import test from 'node:test';
import assert from 'node:assert/strict';
import { CATEGORIES } from '../js/data/categories.js';
import { PRESET_CASES } from '../js/data/preset-cases.js';
import { CASE_LIBRARY } from '../js/data/case-library.js';
import { checkCase } from '../js/store/io.js';

const unique = xs => new Set(xs).size === xs.length;
const byName = name => CASE_LIBRARY.find(c => c.name === name);

// Die kleinen 19"-Racks ohne Rollen: wheelH ist bei denen 0 statt der sonst
// festen 12 cm, weil sie laut Name und Maßen keine Rollen haben (siehe
// js/data/case-library.js).
const RACKS_OHNE_ROLLEN = new Set([
  '19" 1HE -CAB', '19" 2HE -CAB', '19" 3HE -CAB', '19" 4HE -CAB', '19" 5HE -CAB', '19" 6HE -CAB',
]);

test('genau 137 Cases aus der Liste', () => {
  assert.equal(CASE_LIBRARY.length, 137);
});

test('IDs eindeutig, beginnen mit lib- und kollidieren nicht mit den Vorlagen', () => {
  assert.ok(unique(CASE_LIBRARY.map(c => c.id)));
  assert.ok(CASE_LIBRARY.every(c => c.id.startsWith('lib-')));
  const presetIds = new Set(PRESET_CASES.map(c => c.id));
  assert.ok(CASE_LIBRARY.every(c => !presetIds.has(c.id)));
});

test('jede category kommt in CATEGORIES vor', () => {
  const names = new Set(CATEGORIES.map(c => c.name));
  for (const c of CASE_LIBRARY) assert.ok(names.has(c.category), c.name);
});

test('Maße sind endliche Zahlen > 0 und innerhalb sinnvoller Grenzen', () => {
  for (const c of CASE_LIBRARY) {
    assert.ok(Number.isFinite(c.l) && c.l > 0 && c.l <= 400, c.name);
    assert.ok(Number.isFinite(c.w) && c.w > 0 && c.w <= 250, c.name);
    assert.ok(Number.isFinite(c.h) && c.h > 0 && c.h <= 250, c.name);
  }
});

test('jeder Eintrag besteht checkCase', () => {
  for (const c of CASE_LIBRARY) assert.doesNotThrow(() => checkCase(c), c.name);
});

test('feste Werte je Eintrag', () => {
  for (const c of CASE_LIBRARY) {
    assert.equal(c.builtin, true, c.name);
    assert.equal(c.source, 'liste', c.name);
    assert.equal(c.tippable, true, c.name);
    assert.equal(c.stackable, true, c.name);
    assert.equal(c.maxTopLoad, null, c.name);
    assert.equal(c.stock, null, c.name);
    // Rollenhöhe ist überall 12 cm, außer bei den kleinen 19"-Racks ohne Rollen – die tragen 0.
    assert.equal(c.wheelH, RACKS_OHNE_ROLLEN.has(c.name) ? 0 : 12, c.name);
    assert.equal(c.dimsInclWheels, true, c.name);
    assert.equal(c.layers, undefined, c.name);
    assert.equal(typeof c.company, 'string', c.name);
  }
});

test('kein Eintrag hat ein negatives Gewicht', () => {
  for (const c of CASE_LIBRARY) assert.ok(c.weight >= 0, c.name);
});

test('jeder Eintrag mit Gewicht > 0 trägt „Gewicht geschätzt“ in note oder ist eine der beiden FR10-Zeilen', () => {
  const fr10 = new Set(['FR10 x2 -RentAll', 'FR10 x6 -Motion']);
  for (const c of CASE_LIBRARY) {
    if (c.weight > 0) {
      const isEstimateNote = typeof c.note === 'string' && c.note.includes('Gewicht geschätzt');
      assert.ok(isEstimateNote || fr10.has(c.name), c.name);
    }
  }
});

test('die beiden FR10-Zeilen haben die unveränderten Originalgewichte', () => {
  assert.equal(byName('FR10 x2 -RentAll').weight, 73.52);
  assert.equal(byName('FR10 x6 -Motion').weight, 276);
});

test('Stichprobe: Mac Ultra x2 -CAB', () => {
  const c = byName('Mac Ultra x2 -CAB');
  assert.ok(c);
  assert.equal(c.l, 150);
  assert.equal(c.w, 60);
  assert.equal(c.h, 100);
  assert.equal(c.category, 'Licht');
  assert.equal(c.content, 'Martin');
  assert.equal(c.company, 'CAB');
});

test('Stichprobe: Atomic 3000 x4 no wheels -CAB hat wheels: false', () => {
  const c = byName('Atomic 3000 x4 no wheels -CAB');
  assert.ok(c);
  assert.equal(c.wheels, false);
});

test('Stichprobe: 19" 6HE -CAB hat die gemessene Höhe aus der Quelle, nicht die gerechnete', () => {
  const c = byName('19" 6HE -CAB');
  assert.ok(c);
  assert.equal(c.h, 32);
  assert.equal(c.l, 60);
  assert.equal(c.w, 60);
});

test('Stichprobe: 19" 2HE -CAB hat die gemessene Höhe aus der Quelle, nicht die gerechnete', () => {
  const c = byName('19" 2HE -CAB');
  assert.ok(c);
  assert.equal(c.h, 15);
  assert.equal(c.l, 60);
  assert.equal(c.w, 60);
});

test('gefüllte Maße aus der Quelle werden nie durch eine Rack-Formel überschrieben', () => {
  // Regressionstest für den Fehler, bei dem gemessene Rack-Höhen (2 HE, 6 HE)
  // verworfen und durch h = HE * 4,45 + Aufschlag ersetzt wurden. Die vier
  // tatsächlich gerechneten Racks (1, 4, 5, 16 HE) dürfen dagegen nicht mit den
  // gemessenen Werten der 2/3/6-HE-Racks kollidieren.
  const gemessen = { '19" 2HE -CAB': 15, '19" 3HE -CAB': 19, '19" 6HE -CAB': 32 };
  for (const [name, h] of Object.entries(gemessen)) {
    assert.equal(byName(name).h, h, name);
  }
  const gerechnet = ['19" 1HE -CAB', '19" 4HE -CAB', '19" 5HE -CAB', '19" 16HE on wheels-CAB'];
  for (const name of gerechnet) {
    const c = byName(name);
    assert.ok(c, name);
    assert.ok(!Object.values(gemessen).includes(c.h), `${name} darf keinen der gemessenen Werte tragen`);
  }
});

test('Stichprobe: 19" 1HE -CAB hat die aus den drei gemessenen Racks abgeleitete Höhe', () => {
  const c = byName('19" 1HE -CAB');
  assert.ok(c);
  assert.equal(c.h, 10.1);
  assert.equal(c.l, 60);
  assert.equal(c.w, 60);
});

test('kleine 19" -Racks (1-6 HE) haben keine Rollen, der 16-HE-Eintrag „on wheels“ schon', () => {
  for (const name of RACKS_OHNE_ROLLEN) {
    const c = byName(name);
    assert.ok(c, name);
    assert.equal(c.wheels, false, name);
    assert.equal(c.wheelH, 0, name);
  }
  const mitRollen = byName('19" 16HE on wheels-CAB');
  assert.ok(mitRollen);
  assert.notEqual(mitRollen.wheels, false);
  assert.equal(mitRollen.wheelH, 12);
});

test('die fünf unbrauchbaren Rigging-Zeilen fehlen', () => {
  const gone = [
    'Motorsteuerung (Koffer -BBM',
    'Bolzenkoffer -BBM',
    'FD34 x2 -CAB',
    'HOF BOLT -CAB',
    'Dolly "Drohne" -CAB',
  ];
  for (const name of gone) assert.equal(byName(name), undefined, name);
});

test('Firmenschreibweise ist zusammengeführt (motion/Motion, RentALL/RentAll)', () => {
  const companies = new Set(CASE_LIBRARY.map(c => c.company));
  assert.ok(!companies.has('motion'));
  assert.ok(!companies.has('RentALL'));
  assert.ok(companies.has('Motion'));
  assert.ok(companies.has('RentAll'));
});
