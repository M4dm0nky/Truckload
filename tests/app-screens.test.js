import test from 'node:test';
import assert from 'node:assert/strict';
import { screenOf, SCREEN_PARTS } from '../js/app/screens.js';

const plan = { id: 'p' };

test('screenOf: alle Kombinationen aus materialOpen und plan', () => {
  assert.equal(screenOf({ materialOpen: false, plan: null }), 'start');
  assert.equal(screenOf({ materialOpen: false, plan }), 'plan');
  assert.equal(screenOf({ materialOpen: true, plan: null }), 'material');
  assert.equal(screenOf({ materialOpen: true, plan }), 'material');
});
test('screenOf: fehlendes materialOpen zählt als geschlossen', () => {
  assert.equal(screenOf({ plan: null }), 'start');
  assert.equal(screenOf({ plan }), 'plan');
});
test('SCREEN_PARTS: jede Teilmenge nennt nur ihre eigenen Elemente', () => {
  assert.deepEqual(Object.keys(SCREEN_PARTS).sort(), ['material', 'plan', 'start']);
  assert.deepEqual(SCREEN_PARTS.start, ['start']);
  assert.deepEqual(SCREEN_PARTS.plan, ['header', 'layout']);
  assert.deepEqual(SCREEN_PARTS.material, ['material']);
});
