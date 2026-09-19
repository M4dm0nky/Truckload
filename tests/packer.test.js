import test from 'node:test';
import assert from 'node:assert/strict';
import { chooseOrientation, buildStacks, autoPack } from '../js/model/packer.js';
import { validatePlan } from '../js/model/validate.js';
import { mkCase, mkTruck, SPRINTER, plan, byId, counter } from './fixtures.js';

const times = (c, n) => Array.from({ length: n }, () => c);
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
test('Stapel respektieren maxTopLoad', () => {
  const c = mkCase('a', 120, 60, 60, { maxTopLoad: 150 });
  const { stacks } = buildStacks(times(c, 4), mkTruck());
  assert.deepEqual(stacks.map(s => s.items.length), [2, 2]);
});
test('nicht stapelbar → Einzelstapel', () => {
  const c = mkCase('a', 120, 60, 60, { stackable: false });
  assert.equal(buildStacks(times(c, 3), mkTruck()).stacks.length, 3);
});
test('10 Kabelcases: 3 Stapel an der Stirnwand, fehlerfrei', () => {
  const K = mkCase('k', 120, 60, 60);
  const truck = mkTruck();
  const { placements, unplaced } = autoPack(times(K, 10), truck, { newId: counter('p') });
  assert.equal(placements.length, 10);
  assert.deepEqual(unplaced, []);
  assert.ok(placements.every(p => p.x === 0));
  assert.equal(Math.max(...placements.map(p => p.z)), 180);
  assert.deepEqual(placementIssues(validatePlan(plan(placements), byId(K), truck)), []);
});
test('Sprinter mit Radkästen: fehlerfrei, nichts geht verloren', () => {
  const S = mkCase('s', 60, 60, 60);
  const { placements, unplaced } = autoPack(times(S, 40), SPRINTER, { newId: counter('p') });
  assert.equal(placements.length + unplaced.length, 40);
  assert.ok(placements.length > 20);
  assert.deepEqual(placementIssues(validatePlan(plan(placements), byId(S), SPRINTER)), []);
});
test('Stapel wird nie höher als 4 Lagen', () => {
  const c = mkCase('a', 120, 60, 60);
  const { stacks } = buildStacks(times(c, 5), mkTruck());
  assert.deepEqual(stacks.map(s => s.items.length), [4, 1]);
});
test('Case mit nur Lage 1 kommt immer auf den Boden, nie auf ein anderes Case', () => {
  const base = mkCase('base', 120, 60, 60, { layers: [1] });
  const filler = mkCase('filler', 120, 60, 60);
  const { stacks } = buildStacks([filler, filler, base], mkTruck());
  const baseStack = stacks.find(s => s.items.some(it => it.c.id === 'base'));
  assert.equal(baseStack.items[0].c.id, 'base');
});
test('Case, das Lage 1 nicht erlaubt, kommt nur auf bestehende Stapel oder wird unplaced', () => {
  const onlyTop = mkCase('top', 120, 60, 60, { layers: [2] });
  const { stacks: withoutBase, unplaced: withoutBaseUnplaced } = buildStacks([onlyTop], mkTruck());
  assert.equal(withoutBase.length, 0);
  assert.deepEqual(withoutBaseUnplaced.map(c => c.id), ['top']);

  const base = mkCase('base', 120, 60, 60, { layers: [1] });
  const { stacks: withBase, unplaced: withBaseUnplaced } = buildStacks([base, onlyTop], mkTruck());
  assert.deepEqual(withBaseUnplaced, []);
  assert.equal(withBase.length, 1);
  assert.deepEqual(withBase[0].items.map(it => it.c.id), ['base', 'top']);
});
test('Case ohne Lage 1 findet einen später aufgebauten Basis-Stapel (unabhängig von der Eingabereihenfolge)', () => {
  const def = mkCase('def', 120, 60, 60);
  const top2 = mkCase('top2', 120, 60, 60, { layers: [2] });
  const { stacks, unplaced } = buildStacks([def, top2], mkTruck());
  assert.deepEqual(unplaced, []);
  assert.equal(stacks.length, 1);
  assert.deepEqual(stacks[0].items.map(it => it.c.id), ['def', 'top2']);
});
test('Case mit nur Lage 3 landet auf einem 2-hohen Stapel', () => {
  const def = mkCase('def', 120, 60, 60);
  const only3 = mkCase('only3', 120, 60, 60, { layers: [3] });
  const { stacks, unplaced } = buildStacks([def, def, only3], mkTruck());
  assert.deepEqual(unplaced, []);
  assert.equal(stacks.length, 1);
  assert.deepEqual(stacks[0].items.map(it => it.c.id), ['def', 'def', 'only3']);
});
test('Schwer auf leicht: ein 300 kg Case landet nie oben auf einem 30 kg Case gleicher Grundfläche', () => {
  const light = mkCase('light', 120, 60, 60, { weight: 30, layers: [1, 2] });
  const heavy = mkCase('heavy', 120, 60, 60, { weight: 300 });
  const { stacks } = buildStacks([light, heavy], mkTruck());
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
  const { placements } = autoPack([K], mkTruck(), { obstacles, newId: counter('p') });
  assert.equal(placements[0].x, 120);
});
