import test from 'node:test';
import assert from 'node:assert/strict';
import { CASE_BLACK, COLOR_MODES, caseColors, DETAIL_MIN, CORNER_R, cornerCenters, cornerCenters3d } from '../js/ui/caseStyle.js';
import { mkCase } from './fixtures.js';

const C = mkCase('k', 120, 60, 80, { color: '#ff8800' });

test('schwarz: Korpus schwarz, Streifen in Gewerk-Farbe', () => {
  assert.deepEqual(caseColors(C, 'black'), { body: CASE_BLACK, stripe: '#ff8800' });
});
test('trade: Korpus in Gewerk-Farbe, kein Streifen', () => {
  assert.deepEqual(caseColors(C, 'trade'), { body: '#ff8800', stripe: null });
});
test('unbekannter Modus → schwarz', () => {
  assert.deepEqual(caseColors(C, 'was-auch-immer'), { body: CASE_BLACK, stripe: '#ff8800' });
});
test('COLOR_MODES enthält beide Modi', () => {
  assert.deepEqual(COLOR_MODES, ['black', 'trade']);
});

test('schwarz mit Stück-Farbe: Korpus bleibt schwarz, Streifen in Stück-Farbe (schlägt Gewerkfarbe)', () => {
  assert.deepEqual(caseColors(C, 'black', '#3b7dd8'), { body: CASE_BLACK, stripe: '#3b7dd8' });
});
test('trade mit Stück-Farbe: Korpus in Stück-Farbe (schlägt Gewerkfarbe)', () => {
  assert.deepEqual(caseColors(C, 'trade', '#3b7dd8'), { body: '#3b7dd8', stripe: null });
});
test('ohne itemColor bleibt es beim bisherigen Verhalten (Gewerkfarbe)', () => {
  assert.deepEqual(caseColors(C, 'black', undefined), caseColors(C, 'black'));
  assert.deepEqual(caseColors(C, 'trade', undefined), caseColors(C, 'trade'));
});

// DETAIL_MIN ist die einzige Quelle für 2D und 3D (Befund I3/I4, js/ui/view2d.js und
// js/ui/view3d.js importieren beide von hier). Ohne diesen Test lässt sich der Wert
// unbemerkt verändern und die beiden Ansichten laufen wieder auseinander.
test('DETAIL_MIN hat den dokumentierten Wert (40 cm)', () => {
  assert.equal(DETAIL_MIN, 40);
});

// Kugelecken (Nutzer-Feedback 2026-09-28: „viel zu groß, richtige Bälle – in echt stehen die kaum
// raus“): das gemessene Außenmaß enthält die Ecken schon, also darf keine Ecke darüber hinausragen.
// Mittelpunkte liegen um r nach innen versetzt, die Kugel berührt die Außenkante nur.
test('cornerCenters (2D): 4 Mittelpunkte je um r innerhalb der Kante, nichts ragt hinaus', () => {
  const rect = { u0: 10, v0: 20, u1: 130, v1: 80 };
  const pts = cornerCenters(rect, CORNER_R);
  assert.equal(pts.length, 4);
  for (const [cx, cy] of pts) {
    assert.ok(cx - CORNER_R >= rect.u0 - 1e-9 && cx + CORNER_R <= rect.u1 + 1e-9);
    assert.ok(cy - CORNER_R >= rect.v0 - 1e-9 && cy + CORNER_R <= rect.v1 + 1e-9);
  }
  assert.deepEqual(pts[0], [rect.u0 + CORNER_R, rect.v0 + CORNER_R]);
});

test('cornerCenters3d: 8 Mittelpunkte je um r innerhalb der Box', () => {
  const b = { x0: 0, y0: 0, z0: 12, x1: 120, y1: 60, z1: 80 };
  const pts = cornerCenters3d(b, CORNER_R);
  assert.equal(pts.length, 8);
  for (const p of pts) for (const a of ['x', 'y', 'z']) {
    assert.ok(p[a] - CORNER_R >= b[`${a}0`] - 1e-9 && p[a] + CORNER_R <= b[`${a}1`] + 1e-9, a);
  }
});

test('Eckenradius ist klein (kaum sichtbar über dem Profil, keine Bälle)', () => {
  assert.ok(CORNER_R > 0 && CORNER_R <= 2.5);
});

test('cornerCenters: bei sehr kleinem Rechteck nie über die Mitte hinaus', () => {
  const pts = cornerCenters({ u0: 0, v0: 0, u1: 3, v1: 3 }, CORNER_R);
  for (const [cx, cy] of pts) { assert.ok(cx >= 0 && cx <= 3); assert.ok(cy >= 0 && cy <= 3); }
});
