import test from 'node:test';
import assert from 'node:assert/strict';
import { exportBundle, parseBundle, mergeById, backupFileName } from '../js/store/io.js';
import { APP_VERSION } from '../js/version.js';
import { mkCase, mkTruck, plan, P } from './fixtures.js';

const own = mkCase('own', 120, 60, 60);
const builtin = { ...mkCase('preset-x', 1, 1, 1), builtin: true };
const bundleWith = fields => JSON.stringify({ format: 'truckload', version: 1, ...fields });

test('Export enthält nur eigene Cases/Fahrzeuge und alle Pläne', () => {
  const json = JSON.parse(exportBundle({ cases: [own, builtin], trucks: [mkTruck(), { ...mkTruck(), id: 'b', builtin: true }], plans: [plan([])] }, new Date('2026-09-18T10:00:00Z')));
  assert.equal(json.format, 'truckload');
  assert.equal(json.version, 1);
  assert.equal(json.appVersion, APP_VERSION);
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

test('Ladeplan mit ungültiger Lage wird abgelehnt', () => {
  const p = plan([P('pl1', 'own', 0, 0, 0, { orientation: 'sideways' })]);
  const bad = bundleWith({ cases: [own], trucks: [], plans: [p] });
  assert.throws(() => parseBundle(bad), /ungültige Platzierungen/);
});
test('Ladeplan mit ungültiger Drehung wird abgelehnt', () => {
  const p = plan([P('pl1', 'own', 0, 0, 0, { rot: 45 })]);
  const bad = bundleWith({ cases: [own], trucks: [], plans: [p] });
  assert.throws(() => parseBundle(bad), /ungültige Platzierungen/);
});
test('Ladeplan mit nicht-numerischer Position wird abgelehnt', () => {
  const p = plan([P('pl1', 'own', 'nan', 0, 0)]);
  const bad = bundleWith({ cases: [own], trucks: [], plans: [p] });
  assert.throws(() => parseBundle(bad), /ungültige Platzierungen/);
});
test('Case mit ungültigem maxTopLoad wird abgelehnt', () => {
  const bad = bundleWith({ cases: [{ ...own, maxTopLoad: 'viel' }], trucks: [], plans: [] });
  assert.throws(() => parseBundle(bad), /ungültige Eigenschaften/);
});
test('Case mit negativem wheelH wird abgelehnt', () => {
  const bad = bundleWith({ cases: [{ ...own, wheelH: -1 }], trucks: [], plans: [] });
  assert.throws(() => parseBundle(bad), /ungültige Eigenschaften/);
});
test('Case mit wheelH >= h wird abgelehnt', () => {
  const bad = bundleWith({ cases: [{ ...own, wheelH: own.h }], trucks: [], plans: [] });
  assert.throws(() => parseBundle(bad), /ungültige Eigenschaften/);
});
test('Case ohne wheelH wird akzeptiert (Fallback)', () => {
  const res = parseBundle(bundleWith({ cases: [own], trucks: [], plans: [] }));
  assert.equal(res.cases[0].wheelH, undefined);
});
test('Case mit gültigem wheelH wird akzeptiert', () => {
  const res = parseBundle(bundleWith({ cases: [{ ...own, wheelH: 0 }], trucks: [], plans: [] }));
  assert.equal(res.cases[0].wheelH, 0);
});
test('Case mit wheelH >= h wird akzeptiert, wenn dimsInclWheels: false', () => {
  const res = parseBundle(bundleWith({ cases: [{ ...own, wheelH: own.h, dimsInclWheels: false }], trucks: [], plans: [] }));
  assert.equal(res.cases[0].wheelH, own.h);
});
test('Case mit wheels: "ja" (kein Boolean) wird abgelehnt', () => {
  const bad = bundleWith({ cases: [{ ...own, wheels: 'ja' }], trucks: [], plans: [] });
  assert.throws(() => parseBundle(bad), /ungültige Eigenschaften/);
});
test('Case mit dimsInclWheels: "ja" (kein Boolean) wird abgelehnt', () => {
  const bad = bundleWith({ cases: [{ ...own, dimsInclWheels: 'ja' }], trucks: [], plans: [] });
  assert.throws(() => parseBundle(bad), /ungültige Eigenschaften/);
});
test('Case mit wheels: false wird akzeptiert', () => {
  const res = parseBundle(bundleWith({ cases: [{ ...own, wheels: false }], trucks: [], plans: [] }));
  assert.equal(res.cases[0].wheels, false);
});
test('Fahrzeug mit ungültiger Radkasten-Seite wird abgelehnt', () => {
  const t = mkTruck({ wheelArches: [{ x: 100, l: 50, w: 20, h: 30, side: 'top' }] });
  const bad = bundleWith({ cases: [], trucks: [t], plans: [] });
  assert.throws(() => parseBundle(bad), /ungültige Radkästen/);
});
test('Datei ohne Versionsangabe wird abgelehnt', () => {
  const bad = JSON.stringify({ format: 'truckload', cases: [], trucks: [], plans: [] });
  assert.throws(() => parseBundle(bad), /keine gültige Versionsangabe/);
});
test('Case ohne layers wird akzeptiert (Fallback)', () => {
  const res = parseBundle(bundleWith({ cases: [own], trucks: [], plans: [] }));
  assert.equal(res.cases[0].layers, undefined);
});
test('Case mit gültigen layers wird akzeptiert', () => {
  const res = parseBundle(bundleWith({ cases: [{ ...own, layers: [1, 2] }], trucks: [], plans: [] }));
  assert.deepEqual(res.cases[0].layers, [1, 2]);
});
test('Case mit leeren layers wird abgelehnt', () => {
  const bad = bundleWith({ cases: [{ ...own, layers: [] }], trucks: [], plans: [] });
  assert.throws(() => parseBundle(bad), /ungültige Eigenschaften/);
});
test('Case mit layers außerhalb 1–4 wird abgelehnt', () => {
  const bad = bundleWith({ cases: [{ ...own, layers: [5] }], trucks: [], plans: [] });
  assert.throws(() => parseBundle(bad), /ungültige Eigenschaften/);
});
test('Case mit doppelten layers wird abgelehnt', () => {
  const bad = bundleWith({ cases: [{ ...own, layers: [1, 1] }], trucks: [], plans: [] });
  assert.throws(() => parseBundle(bad), /ungültige Eigenschaften/);
});
test('Case mit gültigen Traversenwagen-Feldern wird akzeptiert', () => {
  const truss = { ...own, kind: 'truss', truss: { length: 300, width: 29, count: 4 } };
  const res = parseBundle(bundleWith({ cases: [truss], trucks: [], plans: [] }));
  assert.deepEqual(res.cases[0].truss, { length: 300, width: 29, count: 4 });
});
test('Case mit kind truss ohne truss-Werte wird abgelehnt', () => {
  const bad = bundleWith({ cases: [{ ...own, kind: 'truss' }], trucks: [], plans: [] });
  assert.throws(() => parseBundle(bad), /Traversenwagen/);
});
test('Case mit kind truss und ungültiger Traversenlänge wird abgelehnt', () => {
  const bad = bundleWith({ cases: [{ ...own, kind: 'truss', truss: { length: 0, width: 29, count: 4 } }], trucks: [], plans: [] });
  assert.throws(() => parseBundle(bad), /Traversenwagen/);
});
test('Case mit unbekanntem kind wird abgelehnt', () => {
  const bad = bundleWith({ cases: [{ ...own, kind: 'sonstwas' }], trucks: [], plans: [] });
  assert.throws(() => parseBundle(bad), /ungültige Eigenschaften/);
});
test('Case ohne kind wird akzeptiert (Fallback case)', () => {
  const res = parseBundle(bundleWith({ cases: [own], trucks: [], plans: [] }));
  assert.equal(res.cases[0].kind, undefined);
});

test('Case mit truss.width über 40 cm wird abgelehnt', () => {
  const bad = bundleWith({ cases: [{ ...own, kind: 'truss', truss: { length: 300, width: 52, count: 4 } }], trucks: [], plans: [] });
  assert.throws(() => parseBundle(bad), /Traversenwagen/);
});
test('Case mit truss und tippable true wird abgelehnt', () => {
  const bad = bundleWith({ cases: [{ ...own, kind: 'truss', truss: { length: 300, width: 29, count: 4 }, tippable: true }], trucks: [], plans: [] });
  assert.throws(() => parseBundle(bad), /Traversenwagen/);
});
test('Case mit truss.count als Bruchzahl wird abgelehnt', () => {
  const bad = bundleWith({ cases: [{ ...own, kind: 'truss', truss: { length: 300, width: 29, count: 2.5 } }], trucks: [], plans: [] });
  assert.throws(() => parseBundle(bad), /Traversenwagen/);
});
test('Case mit truss.count 13 wird abgelehnt', () => {
  const bad = bundleWith({ cases: [{ ...own, kind: 'truss', truss: { length: 300, width: 29, count: 13 } }], trucks: [], plans: [] });
  assert.throws(() => parseBundle(bad), /Traversenwagen/);
});
test('Truss wird beim Import normalisiert (l/w/h, wheelH, tippable)', () => {
  const raw = { ...own, kind: 'truss', truss: { length: 300, width: 29, count: 4 }, l: 1, w: 1, h: 999, wheelH: 12, tippable: false };
  const res = parseBundle(bundleWith({ cases: [raw], trucks: [], plans: [] }));
  const c = res.cases[0];
  assert.equal(c.l, 300);
  assert.equal(c.w, 60);
  assert.equal(c.h, 22 + 2 * 29);
  assert.equal(c.wheelH, 0);
  assert.equal(c.tippable, false);
});

test('Vorlagen (builtin/preset-*) werden beim Import verworfen', () => {
  const presetById = { ...mkCase('preset-y', 10, 10, 10), builtin: false };
  const bad = bundleWith({ cases: [own, builtin, presetById], trucks: [mkTruck(), { ...mkTruck({ id: 'preset-truck' }) }], plans: [] });
  const res = parseBundle(bad);
  assert.deepEqual(res.cases.map(c => c.id), ['own']);
  assert.deepEqual(res.trucks.map(t => t.id), ['t']);
});
