import test from 'node:test';
import assert from 'node:assert/strict';
import { switchPlanState, deletePlanState } from '../js/app/plans.js';

const P = (id, name = id) => ({ id, name });

test('switchPlanState: der bisherige Plan wandert in die Liste, der neue wird aktiv', () => {
  const s = { plan: P('a'), plans: [P('b'), P('c')], selectedId: 'x', mode: '2d' };
  const next = switchPlanState(s, P('b'));
  assert.equal(next.plan.id, 'b');
  assert.deepEqual(next.plans.map(p => p.id), ['a', 'c']);
  assert.equal(next.selectedId, null);
  assert.equal(next.mode, '2d');
});
test('switchPlanState: ohne bisherigen Plan (Startbildschirm) steht kein null in der Liste', () => {
  const s = { plan: null, plans: [P('a'), P('b')], selectedId: null };
  const next = switchPlanState(s, P('a'));
  assert.deepEqual(next.plans.map(p => p.id), ['b']);
  assert.equal(next.plan.id, 'a');
});
test('switchPlanState: ein neuer, unbekannter Plan wird nicht doppelt geführt', () => {
  const s = { plan: P('a'), plans: [P('b')], selectedId: null };
  const next = switchPlanState(s, P('n'));
  assert.deepEqual(next.plans.map(p => p.id), ['a', 'b']);
  assert.equal(next.plan.id, 'n');
});
test('switchPlanState: Wechsel auf den schon aktiven Plan lässt ihn auch in der Liste stehen (bekannte Eigenheit, allPlansOf entdoppelt)', () => {
  const s = { plan: P('a'), plans: [P('b')], selectedId: 'x' };
  const next = switchPlanState(s, s.plan);
  assert.deepEqual(next.plans.map(p => p.id), ['a', 'b']);
  assert.equal(next.plan.id, 'a');
  assert.equal(next.selectedId, null);
});

test('deletePlanState: mit Resten wechselt der Zustand auf den ersten übrigen Plan', () => {
  const s = { plan: P('a'), plans: [P('b'), P('c')], selectedId: 'x' };
  const next = deletePlanState(s);
  assert.equal(next.plan.id, 'b');
  assert.deepEqual(next.plans.map(p => p.id), ['c']);
  assert.equal(next.selectedId, null);
});
test('deletePlanState: der letzte Plan führt zurück zum Startbildschirm (plan: null)', () => {
  const s = { plan: P('a'), plans: [], selectedId: 'x' };
  const next = deletePlanState(s);
  assert.equal(next.plan, null);
  assert.deepEqual(next.plans, []);
  assert.equal(next.selectedId, null);
});
test('deletePlanState: ein Duplikat des aktiven Plans in der Liste verschwindet mit', () => {
  const s = { plan: P('a'), plans: [P('a'), P('b')], selectedId: null };
  const next = deletePlanState(s);
  assert.equal(next.plan.id, 'b');
  assert.deepEqual(next.plans, []);
});
