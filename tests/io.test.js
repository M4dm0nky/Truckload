import test from 'node:test';
import assert from 'node:assert/strict';
import { exportBundle, parseBundle, mergeById, backupFileName } from '../js/store/io.js';
import { mkCase, mkTruck, plan } from './fixtures.js';

const own = mkCase('own', 120, 60, 60);
const builtin = { ...mkCase('preset-x', 1, 1, 1), builtin: true };

test('Export enthält nur eigene Cases/Fahrzeuge und alle Pläne', () => {
  const json = JSON.parse(exportBundle({ cases: [own, builtin], trucks: [mkTruck(), { ...mkTruck(), id: 'b', builtin: true }], plans: [plan([])] }, new Date('2026-09-18T10:00:00Z')));
  assert.equal(json.format, 'truckload');
  assert.equal(json.version, 1);
  assert.deepEqual(json.cases.map(c => c.id), ['own']);
  assert.deepEqual(json.trucks.map(t => t.id), ['t']);
  assert.equal(json.plans.length, 1);
});
test('Roundtrip', () => {
  const text = exportBundle({ cases: [own], trucks: [], plans: [plan([])] });
  const b = parseBundle(text);
  assert.deepEqual(b.cases, [own]);
  assert.deepEqual(b.plans[0].unplaced, []);
});
test('Fehlerfälle', () => {
  assert.throws(() => parseBundle('kein json'), /kein gültiges JSON/);
  assert.throws(() => parseBundle('{"format":"anders"}'), /Keine Truckload-Datei/);
  assert.throws(() => parseBundle('{"format":"truckload","version":99}'), /neueren Version/);
  const bad = JSON.stringify({ format: 'truckload', version: 1, cases: [{ ...own, l: 0 }] });
  assert.throws(() => parseBundle(bad), /ungültige Maße/);
});
test('Merge: neueres updatedAt gewinnt, Neues kommt dazu', () => {
  const a = { id: '1', v: 'alt', updatedAt: '2026-01-01' };
  const b = { id: '1', v: 'neu', updatedAt: '2026-02-01' };
  const c = { id: '2', v: 'x', updatedAt: '2026-01-01' };
  assert.deepEqual(mergeById([b], [a]), [b]);
  assert.deepEqual(mergeById([a], [b, c]), [b, c]);
});
test('Dateiname', () => assert.equal(backupFileName(new Date('2026-09-18T10:00:00Z')), 'truckload-backup-2026-09-18.json'));
