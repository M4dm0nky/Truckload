import test from 'node:test';
import assert from 'node:assert/strict';
import { CATEGORIES } from '../js/data/categories.js';
import { PRESET_CASES } from '../js/data/preset-cases.js';
import { CASE_LIBRARY } from '../js/data/case-library.js';
import { checkCase } from '../js/store/io.js';

const unique = xs => new Set(xs).size === xs.length;
const byName = name => CASE_LIBRARY.find(c => c.name === name);

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
    assert.equal(c.weight, 0, c.name);
    assert.equal(c.tippable, true, c.name);
    assert.equal(c.stackable, true, c.name);
    assert.equal(c.maxTopLoad, null, c.name);
    assert.equal(c.stock, null, c.name);
    assert.equal(c.wheelH, 12, c.name);
    assert.equal(c.dimsInclWheels, true, c.name);
    assert.equal(c.layers, undefined, c.name);
    assert.equal(typeof c.company, 'string', c.name);
  }
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

test('Stichprobe: 19" 6HE -CAB hat die gerechnete Höhe (6 x 4,45 + 14)', () => {
  const c = byName('19" 6HE -CAB');
  assert.ok(c);
  assert.equal(c.h, 40.5);
  assert.equal(c.l, 60);
  assert.equal(c.w, 60);
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
