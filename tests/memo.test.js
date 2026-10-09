import test from 'node:test';
import assert from 'node:assert/strict';
import { memoLast } from '../js/model/memo.js';

test('memoLast: gleiche Referenzen → gleiches Ergebnis ohne Neuberechnung', () => {
  let calls = 0;
  const f = memoLast((a, b) => { calls++; return { a, b }; });
  const x = {}, y = {};
  const r1 = f(x, y), r2 = f(x, y);
  assert.equal(r1, r2); assert.equal(calls, 1);
});
test('memoLast: eine geänderte Referenz → neu rechnen', () => {
  let calls = 0;
  const f = memoLast(a => { calls++; return [a]; });
  const x = {}, y = {};
  f(x); f(y); f(y);
  assert.equal(calls, 2);
});
test('memoLast: andere Anzahl Argumente zählt als Änderung', () => {
  let calls = 0;
  const f = memoLast((...a) => { calls++; return a.length; });
  f(1); f(1, 2);
  assert.equal(calls, 2);
});
