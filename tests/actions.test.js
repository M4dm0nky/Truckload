import test from 'node:test';
import assert from 'node:assert/strict';
import * as A from '../js/model/actions.js';
import { validatePlan } from '../js/model/validate.js';
import { mkCase, mkTruck, P, plan, byId, counter } from './fixtures.js';

const K = mkCase('k', 120, 60, 60);
const T = mkCase('t', 120, 60, 100, { tippable: true });
const ctx = () => ({ caseById: byId(K, T), truck: mkTruck(), newId: counter('n') });
const find = (pl, id) => pl.placements.find(p => p.id === id);

test('placeCase stapelt per Schwerkraft', () => {
  const pl = A.placeCase(plan([P('a','k',0,0,0)]), 'k', 12, 0, ctx());
  const p = pl.placements.at(-1);
  assert.equal(p.x, 10);
  assert.equal(p.z, 60);
});
test('placeCase aus der Ablage entfernt das Stück dort', () => {
  const pl = A.placeCase(plan([], [{ id: 'u1', caseId: 'k' }]), 'k', 0, 0, ctx(), 'u1');
  assert.equal(pl.unplaced.length, 0);
  assert.equal(pl.placements[0].id, 'u1');
});
test('moveGroup nimmt den Stapel mit', () => {
  const pl = A.moveGroup(plan([P('a','k',0,0,0), P('b','k',0,0,60)]), 'a', 300, 100, ctx());
  assert.deepEqual([find(pl,'b').x, find(pl,'b').y, find(pl,'b').z], [300, 100, 60]);
});
test('moveGroup rastet an Kanten', () => {
  const pl = A.moveGroup(plan([P('a','k',0,0,0), P('b','k',500,0,0)]), 'b', 123, 0, ctx());
  assert.equal(find(pl,'b').x, 120);
});
test('moveGroup ohne Raster (Pfeiltasten mit Shift)', () => {
  const pl = A.moveGroup(plan([P('a','k',0,0,0)]), 'a', 1, 0, ctx(), { grid: 1, edges: false });
  assert.equal(find(pl,'a').x, 1);
});
test('rotate dreht um 90°', () => {
  const pl = A.rotate(plan([P('a','k',0,0,0)]), 'a', ctx());
  assert.equal(find(pl,'a').rot, 90);
});
test('cycleTip nur bei tippbaren Cases', () => {
  assert.equal(find(A.cycleTip(plan([P('a','k',0,0,0)]), 'a', ctx()), 'a').orientation, 'standing');
  assert.equal(find(A.cycleTip(plan([P('a','t',0,0,0)]), 'a', ctx()), 'a').orientation, 'tipLong');
});
test('cycleTip lässt Traversenwagen unverändert (auch bei fälschlich tippable:true)', () => {
  const truss = mkCase('trs', 300, 60, 80, { kind: 'truss', tippable: true });
  const trussCtx = { caseById: byId(K, T, truss), truck: mkTruck(), newId: counter('n') };
  assert.equal(find(A.cycleTip(plan([P('a','trs',0,0,0)]), 'a', trussCtx), 'a').orientation, 'standing');
});
test('toTray und addUnplaced', () => {
  let pl = A.toTray(plan([P('a','k',0,0,0)]), 'a');
  assert.deepEqual(pl.unplaced, [{ id: 'a', caseId: 'k' }]);
  pl = A.addUnplaced(pl, 'k', 3, counter('u'));
  assert.equal(pl.unplaced.length, 4);
  pl = A.removeUnplaced(pl, 'k');
  assert.equal(pl.unplaced.length, 3);
});
test('duplicate setzt daneben', () => {
  const pl = A.duplicate(plan([P('a','k',0,0,0)]), 'a', ctx());
  assert.equal(pl.placements[1].x, 120);
});
test('packAll verlädt alles', () => {
  const pl = A.packAll(plan([P('a','k',700,0,0)], [{ id: 'u1', caseId: 'k' }, { id: 'u2', caseId: 't' }]), ctx());
  assert.equal(pl.placements.length, 3);
  assert.equal(pl.unplaced.length, 0);
});
test('packRest lässt Bestehendes stehen und kollidiert nicht', () => {
  const c = ctx();
  const pl = A.packRest(plan([P('a','k',0,0,0)], [{ id: 'u1', caseId: 'k' }, { id: 'u2', caseId: 'k' }]), c);
  assert.deepEqual(find(pl,'a'), P('a','k',0,0,0));
  assert.equal(pl.placements.length, 3);
  const r = validatePlan(pl, c.caseById, c.truck);
  assert.ok(!r.issues.some(i => i.code === 'collision'));
});
