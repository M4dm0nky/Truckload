import test from 'node:test';
import assert from 'node:assert/strict';
import { groupRows, floorGaps, freeFloorArea } from '../js/model/rows.js';
import { mkTruck } from './fixtures.js';

const B = (x0, x1, y0, y1) => ({ x0, x1, y0, y1 });
const TRUCK = mkTruck({ l: 1360, w: 245 });

// Reihe 1: zwei Stapel 100 breit (Rest 45), Reihe 2 dahinter voll.
const quer = () => [
  B(0, 120, 0, 100), B(0, 120, 100, 200),
  B(120, 240, 0, 100), B(120, 240, 100, 200), B(120, 240, 200, 245),
];

test('groupRows: überlappende x bilden eine Reihe, 1 cm Versatz bleibt eine Reihe', () => {
  assert.equal(groupRows([B(0, 100, 0, 50), B(1, 101, 50, 100)]).length, 1);
  assert.equal(groupRows([B(0, 100, 0, 50), B(100, 200, 0, 50)]).length, 2);
});

test('groupRows: Kette A-B-C ist eine Reihe, Ergebnis nach x0 sortiert mit Grenzen', () => {
  const rows = groupRows([B(200, 300, 0, 50), B(0, 100, 0, 50), B(90, 210, 50, 100)]);
  assert.equal(rows.length, 1);
  assert.deepEqual([rows[0].x0, rows[0].x1, rows[0].boxes.length], [0, 300, 3]);
  const two = groupRows([B(300, 400, 0, 50), B(0, 100, 0, 50)]);
  assert.deepEqual(two.map(r => r.x0), [0, 300]);
  assert.deepEqual(groupRows([]), []);
});

test('floorGaps: 2×100 in 245 mit Reihe dahinter → eine Lücke 45 breit', () => {
  const g = floorGaps(quer(), TRUCK);
  assert.equal(g.length, 1);
  assert.equal(g[0].w, 45);
  assert.equal(g[0].d, 120);
  assert.equal(g[0].row, 1);
});

test('floorGaps: 3×80 in 245 → keine Lücke', () => {
  const boxes = [B(0, 120, 0, 80), B(0, 120, 80, 160), B(0, 120, 160, 240), B(120, 240, 0, 245)];
  assert.deepEqual(floorGaps(boxes, TRUCK), []);
});

test('floorGaps: Lücke nur in der letzten Reihe → keine Lücke', () => {
  const boxes = [B(0, 120, 0, 245), B(120, 240, 0, 100), B(120, 240, 100, 200)];
  assert.deepEqual(floorGaps(boxes, TRUCK), []);
});

test('floorGaps: Längslücke', () => {
  const boxes = [
    B(0, 120, 0, 100), B(0, 80, 100, 200), B(0, 120, 200, 245),
    B(120, 240, 0, 245),
  ];
  const g = floorGaps(boxes, TRUCK);
  assert.equal(g.length, 1);
  assert.equal(g[0].d, 40);
  assert.equal(g[0].w, 100);
});

test('floorGaps: Radkasten zählt nicht', () => {
  const arch = B(0, 120, 200, 245);
  assert.deepEqual(floorGaps(quer(), TRUCK, { obstacles: [arch] }), []);
  // Hindernis deckt 35 von 45 cm ab: Rest 10 < 25, keine Lücke; deckt es nur 15 ab: Rest 30, Lücke
  assert.equal(floorGaps(quer(), TRUCK, { obstacles: [B(0, 120, 200, 235)] }).length, 0);
  assert.equal(floorGaps(quer(), TRUCK, { obstacles: [B(0, 120, 200, 215)] }).length, 1);
});

test('floorGaps: minSize steuert die Schwelle', () => {
  assert.equal(floorGaps(quer(), TRUCK, { minSize: 60 }).length, 0);
});

test('floorGaps: Reihennummer zählt von der Stirnwand', () => {
  const boxes = [B(0, 100, 0, 245), ...quer().map(b => ({ ...b, x0: b.x0 + 100, x1: b.x1 + 100 })),
    B(340, 440, 0, 245)];
  const g = floorGaps(boxes, TRUCK);
  assert.equal(g.length, 1);
  assert.equal(g[0].row, 2);
});

test('freeFloorArea für das 2×100-Beispiel = 45 × 120', () => {
  assert.equal(freeFloorArea(quer(), TRUCK), 45 * 120);
  assert.equal(freeFloorArea(quer(), TRUCK, { obstacles: [B(0, 120, 200, 245)] }), 0);
  assert.equal(freeFloorArea([], TRUCK), 0);
});

test('floorGaps: leerer Streifen zwischen Reihen zählt als Lücke der vorderen Reihe', () => {
  const boxes = [B(0, 120, 0, 245), B(220, 340, 0, 245), B(340, 460, 0, 245)];
  const g = floorGaps(boxes, TRUCK);
  assert.equal(g.length, 1);
  assert.deepEqual([g[0].row, g[0].d, g[0].w, g[0].x0, g[0].x1], [1, 100, 245, 120, 220]);
});

test('floorGaps: Streifen vor der letzten Reihe zählt, hinter ihr nichts', () => {
  const boxes = [B(0, 120, 0, 245), B(220, 340, 0, 245)];
  assert.equal(floorGaps(boxes, TRUCK).length, 1);
});

test('floorGaps: anliegende Reihen haben keinen Streifen; Radkasten im Streifen zählt nicht', () => {
  assert.deepEqual(floorGaps([B(0, 120, 0, 245), B(120, 240, 0, 245), B(240, 360, 0, 245)], TRUCK), []);
  const boxes = [B(0, 120, 0, 245), B(220, 340, 0, 245)];
  assert.deepEqual(floorGaps(boxes, TRUCK, { obstacles: [B(120, 220, 0, 245)] }), []);
});

test('freeFloorArea enthält den Streifen zwischen Reihen', () => {
  const boxes = [B(0, 120, 0, 245), B(220, 340, 0, 245), B(340, 460, 0, 245)];
  assert.equal(freeFloorArea(boxes, TRUCK), 100 * 245);
  assert.equal(freeFloorArea(boxes, TRUCK, { obstacles: [B(120, 220, 0, 45)] }), 100 * 200);
});
