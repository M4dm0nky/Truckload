import test from 'node:test';
import assert from 'node:assert/strict';
import { screenOf, showScreen, SCREEN_PARTS } from '../js/app/screens.js';

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
test('showScreen: nur die Elemente des gewählten Bildschirms sind sichtbar', () => {
  const mk = () => ({ start: { hidden: false }, header: { hidden: false }, layout: { hidden: false }, material: { hidden: false } });
  const hiddenOf = els => Object.fromEntries(Object.entries(els).map(([k, e]) => [k, e.hidden]));
  const a = mk(); showScreen('start', a);
  assert.deepEqual(hiddenOf(a), { start: false, header: true, layout: true, material: true });
  const b = mk(); showScreen('plan', b);
  assert.deepEqual(hiddenOf(b), { start: true, header: false, layout: false, material: true });
  const c = mk(); showScreen('material', c);
  assert.deepEqual(hiddenOf(c), { start: true, header: true, layout: true, material: false });
});
