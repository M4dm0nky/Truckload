import test from 'node:test';
import assert from 'node:assert/strict';
import { CATEGORIES, colorFor } from '../js/data/categories.js';
import { PRESET_CASES } from '../js/data/preset-cases.js';
import { PRESET_TRUCKS, DEFAULT_TRUCK_ID } from '../js/data/preset-trucks.js';

const unique = xs => new Set(xs).size === xs.length;

test('Farbe pro Gewerk, Fallback Sonstiges', () => {
  assert.equal(colorFor('Licht'), CATEGORIES.find(c => c.name === 'Licht').color);
  assert.equal(colorFor('gibt es nicht'), colorFor('Sonstiges'));
});
test('Case-Vorlagen gültig', () => {
  assert.ok(unique(PRESET_CASES.map(c => c.id)));
  const mega = PRESET_TRUCKS.find(t => t.id === 'preset-mega');
  for (const c of PRESET_CASES) {
    assert.ok(c.builtin && c.id.startsWith('preset-'), c.id);
    assert.ok(c.l > 0 && c.w > 0 && c.h > 0 && c.weight >= 0, c.id);
    assert.ok(CATEGORIES.some(k => k.name === c.category), c.id);
    assert.ok(c.l <= mega.l && c.w <= mega.w && c.h <= mega.h, c.id);
    assert.ok(c.wheelH >= 0 && c.wheelH < c.h, c.id);
  }
});
test('Traverse hat keine Rollen (wheelH 0)', () => {
  const truss = PRESET_CASES.find(c => c.id === 'preset-truss-29-3m');
  assert.equal(truss.wheelH, 0);
});
test('Fahrzeug-Vorlagen gültig', () => {
  assert.ok(unique(PRESET_TRUCKS.map(t => t.id)));
  assert.ok(PRESET_TRUCKS.some(t => t.id === DEFAULT_TRUCK_ID));
  for (const t of PRESET_TRUCKS) assert.ok(t.builtin && t.l > 0 && t.w > 0 && t.h > 0 && t.payload > 0, t.id);
});
