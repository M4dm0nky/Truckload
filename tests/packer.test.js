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
test('Hindernisse werden umgangen', () => {
  const K = mkCase('k', 120, 60, 60);
  const obstacles = [{ x0: 0, y0: 0, z0: 0, x1: 120, y1: 248, z1: 60 }];
  const { placements } = autoPack([K], mkTruck(), { obstacles, newId: counter('p') });
  assert.equal(placements[0].x, 120);
});
