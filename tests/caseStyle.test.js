import test from 'node:test';
import assert from 'node:assert/strict';
import { CASE_BLACK, COLOR_MODES, caseColors, DETAIL_MIN, CORNER_R, cornerCenters, cornerCenters3d, weightRange, weightColor } from '../js/ui/caseStyle.js';
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
test('COLOR_MODES enthält alle drei Modi', () => {
  assert.deepEqual(COLOR_MODES, ['black', 'trade', 'weight']);
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

test('weightRange: Spanne nur über Stücke mit Gewicht', () => {
  const items = [{ c: { weight: 0 } }, { c: { weight: 20 } }, { c: { weight: 100 } }];
  assert.deepEqual(weightRange(items), { min: 20, max: 100 });
});

test('weightRange: ohne Stück mit Gewicht gibt es keine Spanne', () => {
  assert.equal(weightRange([{ c: { weight: 0 } }]), null);
  assert.equal(weightRange([]), null);
});

test('weightColor: 0 kg ist unbekannt und wird neutral grau, nicht „am leichtesten“', () => {
  const grau = weightColor(0, { min: 20, max: 100 });
  assert.equal(grau, weightColor(0, { min: 1, max: 2 }), 'unabhängig von der Spanne derselbe Grauton');
  assert.notEqual(grau, weightColor(20, { min: 20, max: 100 }));
});

test('weightColor: leicht und schwer sind unterschiedlich, Reihenfolge stimmt', () => {
  const r = { min: 20, max: 100 };
  const leicht = weightColor(20, r), mitte = weightColor(60, r), schwer = weightColor(100, r);
  for (const v of [leicht, mitte, schwer]) assert.match(v, /^#[0-9a-f]{6}$/i);
  assert.notEqual(leicht, schwer);
  assert.notEqual(leicht, mitte);
  assert.notEqual(mitte, schwer);
});

test('weightColor: alle gleich schwer (min = max) liefert eine gültige Farbe, keine Division durch null', () => {
  const v = weightColor(50, { min: 50, max: 50 });
  assert.match(v, /^#[0-9a-f]{6}$/i);
});

test('weightColor: ohne Spanne (null) ist alles neutral', () => {
  assert.equal(weightColor(50, null), weightColor(0, null));
});

test('caseColors: Modus weight färbt den Körper wie trade, ohne Streifen', () => {
  const c = { color: '#123456' };
  assert.deepEqual(caseColors(c, 'weight', '#ff0000'), { body: '#ff0000', stripe: null });
});

test('caseColors: Modi schwarz und Gewerk unverändert (Regression)', () => {
  const c = { color: '#123456' };
  assert.deepEqual(caseColors(c, 'trade', '#abcdef'), { body: '#abcdef', stripe: null });
  assert.equal(caseColors(c, 'black', '#abcdef').stripe, '#abcdef');
});
