import test from 'node:test';
import assert from 'node:assert/strict';
import { chooseOrientation, buildStacks, autoPack } from '../js/model/packer.js';
import { validatePlan } from '../js/model/validate.js';
import { wheelFace, DOOR_FACE } from '../js/model/geometry.js';
import { mkCase, mkTruck, SPRINTER, plan, byId } from './fixtures.js';

const mkItem = (c, id, extra = {}) => ({ id, caseId: c.id, c, ...extra });
const items = (c, n, pre = 'i') => Array.from({ length: n }, (_, i) => mkItem(c, `${pre}${i + 1}`));
const placementIssues = r => r.issues.filter(i => i.placementId);

test('nicht tippbar → stehend', () => {
  const c = mkCase('a', 120, 60, 100, { tippable: false });
  assert.equal(chooseOrientation(c, mkTruck()).orientation, 'standing');
});
test('tippbar → getippt, wenn es besser füllt', () => {
  const c = mkCase('a', 120, 60, 100, { tippable: true });
  assert.notEqual(chooseOrientation(c, mkTruck()).orientation, 'standing');
});
test('zu groß → null', () => {
  assert.equal(chooseOrientation(mkCase('a', 2000, 60, 60), mkTruck()), null);
});
test('Auto-Beladung tippt mit Rollen zur Trucktür', () => {
  const c = mkCase('a', 120, 60, 100, { tippable: true });
  const o = chooseOrientation(c, mkTruck());
  assert.notEqual(o.orientation, 'standing');
  assert.equal(wheelFace({ orientation: o.orientation, rot: o.rot }), DOOR_FACE);
});
test('Stapel respektieren maxTopLoad', () => {
  const c = mkCase('a', 120, 60, 60, { maxTopLoad: 150 });
  const { stacks } = buildStacks(items(c, 4), mkTruck());
  assert.deepEqual(stacks.map(s => s.items.length), [2, 2]);
});
test('nicht stapelbar → Einzelstapel', () => {
  const c = mkCase('a', 120, 60, 60, { stackable: false });
  assert.equal(buildStacks(items(c, 3), mkTruck()).stacks.length, 3);
});
test('10 Kabelcases: 3 Stapel an der Stirnwand, fehlerfrei', () => {
  const K = mkCase('k', 120, 60, 60);
  const truck = mkTruck();
  const { placements, unplaced } = autoPack(items(K, 10), truck);
  assert.equal(placements.length, 10);
  assert.deepEqual(unplaced, []);
  assert.ok(placements.every(p => p.x === 0));
  assert.equal(Math.max(...placements.map(p => p.z)), 180);
  assert.deepEqual(placementIssues(validatePlan(plan(placements), byId(K), truck)), []);
});
test('Sprinter mit Radkästen: fehlerfrei, nichts geht verloren', () => {
  const S = mkCase('s', 60, 60, 60);
  const { placements, unplaced } = autoPack(items(S, 40), SPRINTER);
  assert.equal(placements.length + unplaced.length, 40);
  assert.ok(placements.length > 20);
  assert.deepEqual(placementIssues(validatePlan(plan(placements), byId(S), SPRINTER)), []);
});
test('Stapel wird nie höher als 4 Lagen', () => {
  const c = mkCase('a', 120, 60, 60);
  const { stacks } = buildStacks(items(c, 5), mkTruck());
  assert.deepEqual(stacks.map(s => s.items.length), [4, 1]);
});
test('Case mit nur Lage 1 kommt immer auf den Boden, nie auf ein anderes Case', () => {
  const base = mkCase('base', 120, 60, 60, { layers: [1] });
  const filler = mkCase('filler', 120, 60, 60);
  const { stacks } = buildStacks([mkItem(filler, 'f1'), mkItem(filler, 'f2'), mkItem(base, 'b1')], mkTruck());
  const baseStack = stacks.find(s => s.items.some(it => it.c.id === 'base'));
  assert.equal(baseStack.items[0].c.id, 'base');
});
test('Case, das Lage 1 nicht erlaubt, kommt nur auf bestehende Stapel oder wird unplaced', () => {
  const onlyTop = mkCase('top', 120, 60, 60, { layers: [2] });
  const { stacks: withoutBase, unplaced: withoutBaseUnplaced } = buildStacks([mkItem(onlyTop, 'o1')], mkTruck());
  assert.equal(withoutBase.length, 0);
  assert.deepEqual(withoutBaseUnplaced.map(it => it.caseId), ['top']);

  const base = mkCase('base', 120, 60, 60, { layers: [1] });
  const { stacks: withBase, unplaced: withBaseUnplaced } =
    buildStacks([mkItem(base, 'b1'), mkItem(onlyTop, 'o1')], mkTruck());
  assert.deepEqual(withBaseUnplaced, []);
  assert.equal(withBase.length, 1);
  assert.deepEqual(withBase[0].items.map(it => it.c.id), ['base', 'top']);
});
test('Case ohne Lage 1 findet einen später aufgebauten Basis-Stapel (unabhängig von der Eingabereihenfolge)', () => {
  const def = mkCase('def', 120, 60, 60);
  const top2 = mkCase('top2', 120, 60, 60, { layers: [2] });
  const { stacks, unplaced } = buildStacks([mkItem(def, 'd1'), mkItem(top2, 't1')], mkTruck());
  assert.deepEqual(unplaced, []);
  assert.equal(stacks.length, 1);
  assert.deepEqual(stacks[0].items.map(it => it.c.id), ['def', 'top2']);
});
test('Case mit nur Lage 3 landet auf einem 2-hohen Stapel', () => {
  const def = mkCase('def', 120, 60, 60);
  const only3 = mkCase('only3', 120, 60, 60, { layers: [3] });
  const { stacks, unplaced } = buildStacks([mkItem(def, 'd1'), mkItem(def, 'd2'), mkItem(only3, 'o1')], mkTruck());
  assert.deepEqual(unplaced, []);
  assert.equal(stacks.length, 1);
  assert.deepEqual(stacks[0].items.map(it => it.c.id), ['def', 'def', 'only3']);
});
test('Schwer auf leicht: ein 300 kg Case landet nie oben auf einem 30 kg Case gleicher Grundfläche', () => {
  const light = mkCase('light', 120, 60, 60, { weight: 30, layers: [1, 2] });
  const heavy = mkCase('heavy', 120, 60, 60, { weight: 300 });
  const { stacks } = buildStacks([mkItem(light, 'l1'), mkItem(heavy, 'h1')], mkTruck());
  for (const s of stacks) {
    const idx = s.items.findIndex(it => it.c.id === 'heavy');
    if (idx === -1) continue;
    assert.equal(idx, 0, 'heavy muss unten (Lage 1) stehen, nie über light');
  }
  const lightStack = stacks.find(s => s.items.some(it => it.c.id === 'light'));
  const heavyAboveLight = lightStack && lightStack.items.some((it, i) =>
    it.c.id === 'heavy' && lightStack.items.slice(0, i).some(below => below.c.id === 'light'));
  assert.ok(!heavyAboveLight, 'heavy darf nie über light im selben Stapel liegen');
});

test('Hindernisse werden umgangen', () => {
  const K = mkCase('k', 120, 60, 60);
  const obstacles = [{ x0: 0, y0: 0, z0: 0, x1: 120, y1: 248, z1: 60 }];
  const { placements } = autoPack([mkItem(K, 'k1')], mkTruck(), { obstacles });
  assert.equal(placements[0].x, 120);
});

test('autoPack übernimmt id, label und Farbe des Stücks statt neuer ID', () => {
  const K = mkCase('k', 120, 60, 60);
  const { placements } = autoPack([mkItem(K, 'stück-1', { label: 'Case A', color: '#ff0000' })], mkTruck());
  assert.equal(placements[0].id, 'stück-1');
  assert.equal(placements[0].label, 'Case A');
  assert.equal(placements[0].color, '#ff0000');
});

test('autoPack: getippte Placements haben die Rollen zur Trucktür (Score-Vorrang + rot-%360-Fix)', () => {
  const c = mkCase('a', 120, 60, 100, { tippable: true });
  const { placements } = autoPack(items(c, 3), mkTruck());
  assert.ok(placements.length > 0);
  for (const p of placements) {
    if (p.orientation === 'standing') continue;
    assert.equal(wheelFace(p), DOOR_FACE,
      `getipptes Placement ${p.id} (rot ${p.rot}) sollte Rollen zur Tür haben`);
  }
});

test('autoPack: unplaced behält seine Einträge (id/label/color) statt sie zu verwerfen', () => {
  const big = mkCase('big', 2000, 60, 60);
  const { unplaced } = autoPack([mkItem(big, 'stück-2', { label: 'Zu groß', color: '#00ff00' })], mkTruck());
  assert.deepEqual(unplaced, [{ id: 'stück-2', caseId: 'big', label: 'Zu groß', color: '#00ff00' }]);
});
