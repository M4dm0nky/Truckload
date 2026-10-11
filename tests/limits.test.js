import test from 'node:test';
import assert from 'node:assert/strict';
import { CASE_LIMITS, TRUSS_LIMITS, MAX_LABEL, MAX_FIRM, MAX_RULESET_NAME, NAME_MAX, COORD_MAX, layersValid } from '../js/model/limits.js';
import { MAX_TRUSS_WIDTH } from '../js/model/truss.js';
import { PRESET_TRUCKS } from '../js/data/preset-trucks.js';

test('TRUSS_LIMITS.width entspricht der abgeleiteten MAX_TRUSS_WIDTH', () => {
  assert.equal(TRUSS_LIMITS.width, MAX_TRUSS_WIDTH);
});

test('Grenzwerte behalten ihre bisherigen Zahlen', () => {
  assert.deepEqual(CASE_LIMITS, { l: 2000, w: 2000, h: 2000, weight: 50000, wheelH: 200, maxTopLoad: 50000, stock: 9999 });
  assert.deepEqual(TRUSS_LIMITS, { length: 1000, width: 40, standingWidth: 200, count: 12, wagonW: 200 });
  assert.equal(MAX_LABEL, 40);
  assert.equal(MAX_FIRM, 80);
  assert.equal(MAX_RULESET_NAME, 80);
});

test('layersValid: gültige Lagen', () => {
  assert.equal(layersValid([1]), true);
  assert.equal(layersValid([1, 2, 3, 4]), true);
  assert.equal(layersValid([3, 1]), true);
});

test('layersValid: leer, doppelt, außerhalb 1–4, keine Ganzzahl, kein Array', () => {
  assert.equal(layersValid([]), false);
  assert.equal(layersValid([1, 1]), false);
  assert.equal(layersValid([0]), false);
  assert.equal(layersValid([5]), false);
  assert.equal(layersValid([1.5]), false);
  assert.equal(layersValid(undefined), false);
  assert.equal(layersValid('1'), false);
});

test('NAME_MAX entspricht dem maxlength der Namensfelder (Case, Fahrzeug, Ladeplan)', () => {
  assert.equal(NAME_MAX, 80);
});

test('COORD_MAX: mindestens das Doppelte der größten mitgelieferten Fahrzeugabmessung', () => {
  const largest = Math.max(...PRESET_TRUCKS.flatMap(t => [t.l, t.w, t.h]));
  assert.ok(COORD_MAX >= 2 * largest, `${COORD_MAX} < 2 × ${largest}`);
  assert.equal(COORD_MAX, 2 * largest);
});
