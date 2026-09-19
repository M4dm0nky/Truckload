import test from 'node:test';
import assert from 'node:assert/strict';
import { DOLLY_H, DOLLY_WIDTHS, TRUSS_PROFILES, trussDims, isTruss } from '../js/model/truss.js';

test('trussDims: 34er (29 cm) passt zu zweit nebeneinander -> 60er Wagen', () => {
  const d = trussDims({ length: 300, width: 29, count: 4 });
  assert.equal(d.l, 300);
  assert.equal(d.w, 60);
  assert.equal(d.h, DOLLY_H + 2 * 29);
});
test('trussDims: 40er (40 cm) passt nicht zweit nebeneinander in 60 -> 80er Wagen', () => {
  const d = trussDims({ length: 300, width: 40, count: 4 });
  assert.equal(d.w, 80);
  assert.equal(d.h, DOLLY_H + 2 * 40);
});
test('trussDims: ungerade Stückzahl wird auf volle Lage aufgerundet', () => {
  const d3 = trussDims({ length: 200, width: 29, count: 3 });
  const d4 = trussDims({ length: 200, width: 29, count: 4 });
  assert.equal(d3.h, d4.h);
  assert.equal(d3.h, DOLLY_H + 2 * 29);
});
test('trussDims: 1 Stück -> nur eine Lage', () => {
  const d = trussDims({ length: 200, width: 29, count: 1 });
  assert.equal(d.h, DOLLY_H + 29);
});
test('DOLLY_WIDTHS enthält 60 und 80', () => {
  assert.deepEqual(DOLLY_WIDTHS, [60, 80]);
});
test('TRUSS_PROFILES enthält 34er (29 cm) und 40er (40 cm)', () => {
  assert.ok(TRUSS_PROFILES.some(p => p.width === 29));
  assert.ok(TRUSS_PROFILES.some(p => p.width === 40));
});
test('isTruss erkennt kind truss', () => {
  assert.equal(isTruss({ kind: 'truss' }), true);
  assert.equal(isTruss({ kind: 'case' }), false);
  assert.equal(isTruss({}), false);
});
