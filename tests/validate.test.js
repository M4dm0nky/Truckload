import test from 'node:test';
import assert from 'node:assert/strict';
import { validatePlan, archBoxes } from '../js/model/validate.js';
import { mkCase, mkTruck, SPRINTER, P, plan, byId } from './fixtures.js';

const K = mkCase('k', 120, 60, 60);
const codes = (r, id) => (r.byPlacement.get(id) ?? []).map(i => i.code).sort();
const planCodes = r => r.issues.filter(i => !i.placementId).map(i => i.code);

test('leerer Plan', () => {
  const r = validatePlan(plan([]), byId(K), mkTruck());
  assert.deepEqual(r.issues, []);
  assert.equal(r.totals.weight, 0);
  assert.equal(r.totals.cog, null);
});
test('Kollision auf beiden Cases', () => {
  const r = validatePlan(plan([P('a','k',0,0,0), P('b','k',60,0,0)]), byId(K), mkTruck());
  assert.deepEqual(codes(r,'a'), ['collision']);
  assert.deepEqual(codes(r,'b'), ['collision']);
});
test('über den Laderaum hinaus', () => {
  const r = validatePlan(plan([P('a','k',1300,0,0)]), byId(K), mkTruck());
  assert.deepEqual(codes(r,'a'), ['outOfBounds']);
});
test('schwebt ohne Auflage', () => {
  const r = validatePlan(plan([P('a','k',0,0,60)]), byId(K), mkTruck());
  assert.deepEqual(codes(r,'a'), ['unsupported']);
});
test('sauber gestapelt: keine Probleme, Last unten', () => {
  // y=94 → mittig (Mitte 124), sonst meldet die Prüfung „einseitig"
  const r = validatePlan(plan([P('a','k',0,94,0), P('b','k',0,94,60)]), byId(K), mkTruck());
  assert.deepEqual(r.issues, []);
  assert.equal(r.load.get('a'), 100);
});
test('halbe Auflage reicht nicht', () => {
  const r = validatePlan(plan([P('a','k',0,0,0), P('b','k',60,0,60)]), byId(K), mkTruck());
  assert.deepEqual(codes(r,'b'), ['unsupported']);
});
test('auf nicht stapelbarem Case', () => {
  const N = mkCase('n', 120, 60, 60, { stackable: false });
  const r = validatePlan(plan([P('a','n',0,0,0), P('b','k',0,0,60)]), byId(K, N), mkTruck());
  assert.deepEqual(codes(r,'b'), ['notStackable']);
});
test('Überlast wird durchgereicht', () => {
  const W = mkCase('w', 120, 60, 60, { maxTopLoad: 150 });
  const r = validatePlan(plan([P('a','w',0,0,0), P('b','k',0,0,60), P('c','k',0,0,120)]), byId(K, W), mkTruck());
  assert.equal(r.load.get('a'), 200);
  assert.deepEqual(codes(r,'a'), ['overload']);
});
test('getippt, obwohl nicht tippbar', () => {
  const r = validatePlan(plan([P('a','k',0,0,0,{ orientation: 'tipLong' })]), byId(K), mkTruck());
  assert.deepEqual(codes(r,'a'), ['notTippable']);
});
test('Radkasten', () => {
  assert.equal(archBoxes(SPRINTER).length, 2);
  const S = mkCase('s', 60, 60, 60);
  const r = validatePlan(plan([P('a','s',220,0,0)]), byId(S), SPRINTER);
  assert.deepEqual(codes(r,'a'), ['arch']);
});
test('zu schwer', () => {
  const r = validatePlan(plan([P('a','k',0,0,0), P('b','k',0,60,0)]), byId(K), mkTruck({ payload: 150 }));
  assert.ok(planCodes(r).includes('tooHeavy'));
});
test('einseitige Ladung', () => {
  const r = validatePlan(plan([P('a','k',0,0,0)]), byId(K), mkTruck());
  assert.ok(planCodes(r).includes('imbalance'));
});
test('fehlender Case-Typ', () => {
  const r = validatePlan(plan([P('a','weg',0,0,0)]), byId(K), mkTruck());
  assert.deepEqual(codes(r,'a'), ['missingCase']);
});
test('Kennzahlen und Reihenfolge', () => {
  const r = validatePlan(plan([P('hinten','k',120,0,0), P('vorn','k',0,0,0)]), byId(K), mkTruck());
  assert.equal(r.totals.weight, 200);
  assert.equal(r.totals.cog.x, 120);
  assert.equal(r.totals.loadMeters, 2.4);
  assert.equal(r.sequence.get('vorn'), 1);
  assert.equal(r.sequence.get('hinten'), 2);
});
