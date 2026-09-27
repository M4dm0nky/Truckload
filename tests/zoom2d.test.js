import test from 'node:test';
import assert from 'node:assert/strict';
import { zoomAt, panBy, resolveViewBox, MIN_VIEW_W } from '../js/ui/zoom2d.js';

// Zoom/Verschieben der 2D-Ansichten: reine Rechnung auf der viewBox { x, y, w, h }. `full` ist der
// ganze Truck samt Rand – weiter heraus geht es nicht, der Ausschnitt bleibt immer darin.
const FULL = { x: -30, y: -30, w: 1420, h: 308 };
const near = (a, b) => Math.abs(a - b) < 1e-6;

test('zoomAt: Fixpunkt bleibt an Ort und Stelle, Breite und Höhe skalieren gleich', () => {
  const vb = zoomAt(FULL, 2, 400, 100, FULL);
  assert.ok(near(vb.w, 710));
  assert.ok(near(vb.h, 154));
  // Anteil des Fixpunkts im Ausschnitt ist vorher und nachher gleich.
  assert.ok(near((400 - vb.x) / vb.w, (400 - FULL.x) / FULL.w));
  assert.ok(near((100 - vb.y) / vb.h, (100 - FULL.y) / FULL.h));
});

test('zoomAt: nie weiter heraus als der ganze Truck', () => {
  const vb = zoomAt(zoomAt(FULL, 2, 400, 100, FULL), 0.1, 400, 100, FULL);
  assert.deepEqual(vb, FULL);
});

test('zoomAt: nie enger als MIN_VIEW_W', () => {
  const vb = zoomAt(FULL, 1000, 400, 100, FULL);
  assert.ok(near(vb.w, MIN_VIEW_W));
});

test('zoomAt am Rand: Ausschnitt bleibt innerhalb des ganzen Trucks', () => {
  const vb = zoomAt(FULL, 4, FULL.x, FULL.y, FULL);
  assert.ok(vb.x >= FULL.x - 1e-9 && vb.y >= FULL.y - 1e-9);
  assert.ok(vb.x + vb.w <= FULL.x + FULL.w + 1e-9 && vb.y + vb.h <= FULL.y + FULL.h + 1e-9);
});

test('panBy: verschiebt, aber nicht über den Truck hinaus', () => {
  const z = zoomAt(FULL, 4, 700, 124, FULL);
  const moved = panBy(z, 50, 0, FULL);
  assert.ok(near(moved.x, z.x + 50));
  const far = panBy(z, 99999, 99999, FULL);
  assert.ok(near(far.x + far.w, FULL.x + FULL.w));
  assert.ok(near(far.y + far.h, FULL.y + FULL.h));
});

test('panBy: bei vollem Ausschnitt passiert nichts', () => {
  assert.deepEqual(panBy(FULL, 100, 50, FULL), FULL);
});

test('resolveViewBox: ohne Zustand oder bei anderem Truck der ganze Truck, sonst der Zoom', () => {
  assert.deepEqual(resolveViewBox(null, FULL), FULL);
  const z = zoomAt(FULL, 2, 400, 100, FULL);
  assert.deepEqual(resolveViewBox({ full: FULL, vb: z }, FULL), z);
  const other = { x: -30, y: -30, w: 490, h: 238 };
  assert.deepEqual(resolveViewBox({ full: FULL, vb: z }, other), other);
});
