import test from 'node:test';
import assert from 'node:assert/strict';
import { CATEGORIES, colorFor } from '../js/data/categories.js';
import { PRESET_CASES } from '../js/data/preset-cases.js';
import { PRESET_TRUCKS, DEFAULT_TRUCK_ID } from '../js/data/preset-trucks.js';
import { trussDims, isTruss } from '../js/model/truss.js';

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
test('Traversenwagen-Vorlagen sind vom Typ truss mit passenden Maßen', () => {
  const trussCases = PRESET_CASES.filter(isTruss);
  assert.equal(trussCases.length, 27);
  for (const c of trussCases) {
    assert.ok(c.truss && c.truss.length > 0 && c.truss.width > 0 && c.truss.count > 0, c.id);
    const dims = trussDims(c.truss);
    assert.equal(c.l, dims.l, c.id);
    assert.equal(c.w, dims.w, c.id);
    assert.equal(c.h, dims.h, c.id);
    assert.equal(c.tippable, false, c.id);
    assert.deepEqual(c.layers, [1, 2], c.id);
    assert.equal(c.wheelH, 0, c.id);
  }
});
test('Legacy-Traversen-Presets aus V0.2 existieren weiter (für alte Ladepläne)', () => {
  const byId = id => PRESET_CASES.find(c => c.id === id);
  const legacy1 = byId('preset-truss-29-3m');
  const legacy2 = byId('preset-truss-dolly');
  assert.ok(legacy1, 'preset-truss-29-3m fehlt');
  assert.ok(legacy2, 'preset-truss-dolly fehlt');
  assert.equal(legacy1.legacy, true);
  assert.equal(legacy2.legacy, true);
});
test('Fahrzeug-Vorlagen gültig', () => {
  assert.ok(unique(PRESET_TRUCKS.map(t => t.id)));
  assert.ok(PRESET_TRUCKS.some(t => t.id === DEFAULT_TRUCK_ID));
  for (const t of PRESET_TRUCKS) assert.ok(t.builtin && t.l > 0 && t.w > 0 && t.h > 0 && t.payload > 0, t.id);
});
