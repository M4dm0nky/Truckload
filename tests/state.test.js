import test from 'node:test';
import assert from 'node:assert/strict';
import { createStore } from '../js/state.js';

test('undo/redo nur für den Plan', () => {
  const s = createStore({ plan: { v: 1 }, selectedId: null });
  let calls = 0; s.subscribe(() => calls++);
  s.update(st => ({ ...st, plan: { v: 2 } }), { history: true });
  s.update(st => ({ ...st, selectedId: 'x' }));
  assert.equal(s.canUndo(), true);
  s.undo();
  assert.deepEqual(s.get().plan, { v: 1 });
  assert.equal(s.get().selectedId, 'x');
  s.redo();
  assert.deepEqual(s.get().plan, { v: 2 });
  assert.equal(calls, 4);
});
test('checkpoint vor Drag', () => {
  const s = createStore({ plan: { v: 1 } });
  s.checkpoint();
  s.update(st => ({ ...st, plan: { v: 2 } }));
  s.update(st => ({ ...st, plan: { v: 3 } }));
  s.undo();
  assert.deepEqual(s.get().plan, { v: 1 });
});
test('Limit', () => {
  const s = createStore({ plan: { v: 0 } }, { limit: 2 });
  for (let i = 1; i <= 5; i++) s.update(st => ({ ...st, plan: { v: i } }), { history: true });
  s.undo(); s.undo(); s.undo();
  assert.deepEqual(s.get().plan, { v: 3 });
});
test('unverändert → kein Event', () => {
  const s = createStore({ plan: {} });
  let calls = 0; s.subscribe(() => calls++);
  s.update(st => st, { history: true });
  assert.equal(calls, 0);
  assert.equal(s.canUndo(), false);
});
