import test from 'node:test';
import assert from 'node:assert/strict';
import { zoomAt, panBy, resolveViewBox, MIN_VIEW_W, classifyWheel, nextScrollMode, SCROLL_MODES, loadScrollMode, saveScrollMode } from '../js/ui/zoom2d.js';

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

// --- zoomFactor und truckzoom-Ereignis (0.14.1) ----------------------------------------------
import { zoomFactor, applyViewBox, zoomBy, zoomIn, resetZoom } from '../js/ui/zoom2d.js';
import { installFakeDom, newSvg } from './fake-svg.js';

function zoomSvg() {
  installFakeDom();
  const svg = newSvg();
  applyViewBox(svg, FULL);
  return svg;
}

test('zoomFactor: ganze Breite / sichtbare Breite, nie unter 1', () => {
  const svg = zoomSvg();
  assert.equal(zoomFactor(svg), 1);
  zoomBy(svg, 2);
  assert.ok(near(zoomFactor(svg), 2));
  zoomBy(svg, 0.1);                    // weiter heraus als alles geht nicht
  assert.equal(zoomFactor(svg), 1);
  resetZoom(svg);
  assert.equal(zoomFactor(svg), 1);
});

test('zoomFactor: svg ohne viewBox-Zustand ergibt 1', () => {
  installFakeDom();
  assert.equal(zoomFactor(newSvg()), 1);
});

test('zoomBy / zoomIn / resetZoom melden die neue Stufe per truckzoom-Ereignis', () => {
  const svg = zoomSvg();
  const seen = [];
  svg.addEventListener('truckzoom', e => seen.push(zoomFactor(svg)));
  zoomIn(svg);
  assert.equal(seen.length, 1);
  assert.ok(near(seen[0], 1.5));
  resetZoom(svg);
  assert.equal(seen.length, 2);
  assert.equal(seen[1], 1);
});

test('truckzoom kommt nur, wenn sich die Breite ändert (Verschieben löst es nicht aus)', () => {
  const svg = zoomSvg();
  zoomBy(svg, 4);
  let n = 0;
  svg.addEventListener('truckzoom', () => n++);
  // Verschieben läuft über set(): simuliert durch Zoom auf gleiche Stufe an anderer Stelle gibt es nicht;
  // hier genügt: ein Zoom, der an der Grenze nichts ändert, meldet nichts.
  zoomBy(svg, 1e9); zoomBy(svg, 1e9);
  assert.equal(n, 1); // das erste erreicht MIN_VIEW_W, das zweite ändert nichts
});

// --- Mausrad oder Trackpad? (Umschalter: auto / zoom / pan) ---
const W = (o) => ({ deltaMode: 0, deltaX: 0, deltaY: 0, wheelDeltaY: 0, ...o });

test('classifyWheel: Maus mit 120er-Schritten = Rad', () => {
  assert.equal(classifyWheel(W({ deltaY: 100, wheelDeltaY: -120 }), {}, 0), 'wheel');
});
test('classifyWheel: Zeilenmodus = Rad', () => {
  assert.equal(classifyWheel(W({ deltaMode: 1, deltaY: 3, deltaX: 2 }), {}, 0), 'wheel');
});
test('classifyWheel: feines Rad (kleine Schritte, wheelDeltaY Vielfaches von 120) = Rad', () => {
  assert.equal(classifyWheel(W({ deltaY: 4, wheelDeltaY: -120 }), {}, 0), 'wheel');
  assert.equal(classifyWheel(W({ deltaY: 4, wheelDeltaY: 0 }), {}, 0), 'pad');
});
test('classifyWheel: bisherige Größenregel bleibt (deltaX 0, |deltaY| >= 50)', () => {
  assert.equal(classifyWheel(W({ deltaY: 60 }), {}, 0), 'wheel');
  assert.equal(classifyWheel(W({ deltaY: 60, deltaX: 1 }), {}, 0), 'pad');
});
test('classifyWheel: Trackpad-Strom mit kleinen Schritten und deltaX = pad', () => {
  const st = {};
  let t = 0;
  for (const [dx, dy] of [[1, 3], [0, 5], [2, 8], [0, 12], [1, 9]]) {
    assert.equal(classifyWheel(W({ deltaX: dx, deltaY: dy, wheelDeltaY: -dy * 3 }), st, t), 'pad');
    t += 16;
  }
});
test('classifyWheel: Einstufung bleibt innerhalb einer Geste (150 ms) stehen', () => {
  const st = {};
  assert.equal(classifyWheel(W({ deltaX: 1, deltaY: 4 }), st, 0), 'pad');
  // Ausläufer: reines deltaY >= 50 mitten in der Geste kippt nicht um
  assert.equal(classifyWheel(W({ deltaY: 55 }), st, 16), 'pad');
  assert.equal(classifyWheel(W({ deltaY: 60, wheelDeltaY: -180 }), st, 32), 'pad');
  const st2 = {};
  assert.equal(classifyWheel(W({ deltaY: 100, wheelDeltaY: -120 }), st2, 0), 'wheel');
  assert.equal(classifyWheel(W({ deltaX: 1, deltaY: 3 }), st2, 100), 'wheel');
});
test('classifyWheel: nach mehr als 150 Pause wird neu eingestuft', () => {
  const st = {};
  assert.equal(classifyWheel(W({ deltaX: 1, deltaY: 4 }), st, 0), 'pad');
  assert.equal(classifyWheel(W({ deltaY: 100, wheelDeltaY: -120 }), st, 400), 'wheel');
  assert.equal(classifyWheel(W({ deltaX: 1, deltaY: 4 }), st, 900), 'pad');
});
test('classifyWheel: Trägheitsausläufer nach dem Wischen bleibt pad', () => {
  const st = {};
  let t = 0;
  for (const dy of [10, 12, 9, 6, 4, 2, 1]) { assert.equal(classifyWheel(W({ deltaY: dy }), st, t), 'pad'); t += 16; }
});

test('Umschalter: reihum auto -> zoom -> pan -> auto', () => {
  assert.deepEqual(SCROLL_MODES, ['auto', 'zoom', 'pan']);
  assert.equal(nextScrollMode('auto'), 'zoom');
  assert.equal(nextScrollMode('zoom'), 'pan');
  assert.equal(nextScrollMode('pan'), 'auto');
  assert.equal(nextScrollMode('quatsch'), 'auto');
});
test('Umschalter: Speicher mit Rückfall, auch wenn localStorage fehlt oder wirft', () => {
  const store = { v: null, getItem() { return this.v; }, setItem(k, v) { this.v = v; } };
  assert.equal(loadScrollMode(store), 'auto');
  saveScrollMode('pan', store);
  assert.equal(loadScrollMode(store), 'pan');
  store.v = 'mist';
  assert.equal(loadScrollMode(store), 'auto');
  const boom = { getItem() { throw new Error('x'); }, setItem() { throw new Error('x'); } };
  assert.equal(loadScrollMode(boom), 'auto');
  assert.doesNotThrow(() => saveScrollMode('zoom', boom));
  assert.equal(loadScrollMode(undefined), 'auto');
});
